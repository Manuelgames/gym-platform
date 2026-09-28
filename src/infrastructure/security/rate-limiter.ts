import { createHash } from 'node:crypto';

/** Regla de intentos permitidos dentro de una ventana móvil. */
export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

/** Error seguro que permite informar cuándo reintentar. */
export class RateLimitExceededError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Se superó el límite temporal de intentos.');
    this.name = 'RateLimitExceededError';
  }
}

/** Reserva identificable que puede liberarse después de un login correcto. */
export interface RateLimitLease {
  key: string;
  attemptId: number;
}

interface Attempt {
  id: number;
  timestamp: number;
}

/**
 * Limitador en memoria para proteger el costoso flujo scrypt en una instancia.
 *
 * No sustituye un limitador distribuido cuando se despliegan varias réplicas;
 * el puerto HTTP permite cambiarlo sin tocar autenticación ni dominio.
 */
export class InMemoryRateLimiter {
  private readonly attempts = new Map<string, Attempt[]>();
  private operations = 0;
  private nextAttemptId = 1;

  /** Consume un intento o lanza un error con tiempo de reintento. */
  consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitLease {
    const threshold = now - rule.windowMs;
    const active = (this.attempts.get(key) ?? []).filter(
      (attempt) => attempt.timestamp > threshold,
    );
    if (active.length >= rule.limit) {
      const retryAt = (active[0]?.timestamp ?? now) + rule.windowMs;
      throw new RateLimitExceededError(Math.max(1, Math.ceil((retryAt - now) / 1000)));
    }
    const attemptId = this.nextAttemptId;
    this.nextAttemptId += 1;
    active.push({ id: attemptId, timestamp: now });
    this.attempts.set(key, active);

    this.operations += 1;
    if (this.operations % 100 === 0) this.prune(now);
    return { key, attemptId };
  }

  /** Libera exactamente el intento reservado, sin borrar fallos concurrentes. */
  release(lease: RateLimitLease): void {
    const active = this.attempts.get(lease.key);
    if (!active) return;
    const retained = active.filter((attempt) => attempt.id !== lease.attemptId);
    if (retained.length) this.attempts.set(lease.key, retained);
    else this.attempts.delete(lease.key);
  }

  private prune(now: number): void {
    const oldestUsefulTimestamp = now - 60 * 60 * 1000;
    for (const [key, attempts] of this.attempts) {
      const active = attempts.filter((attempt) => attempt.timestamp > oldestUsefulTimestamp);
      if (active.length) this.attempts.set(key, active);
      else this.attempts.delete(key);
    }
  }
}

type GlobalRateLimiter = typeof globalThis & {
  __romanColosseumAuthRateLimiter__?: InMemoryRateLimiter;
};

/** Devuelve el limitador único del proceso, también durante HMR. */
export function getAuthRateLimiter(): InMemoryRateLimiter {
  const container = globalThis as GlobalRateLimiter;
  container.__romanColosseumAuthRateLimiter__ ??= new InMemoryRateLimiter();
  return container.__romanColosseumAuthRateLimiter__;
}

/** Seudonimiza correos usados como bucket; el mapa no retiene PII directa. */
export function rateLimitSubject(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/** Reglas conservadoras para autenticación por contraseña y scrypt. */
export const AUTH_RATE_LIMITS = Object.freeze({
  loginIp: { limit: 30, windowMs: 15 * 60 * 1000 },
  loginAccount: { limit: 8, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordChange: { limit: 8, windowMs: 15 * 60 * 1000 },
  recoveryIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  recoveryAccount: { limit: 3, windowMs: 60 * 60 * 1000 },
  resetIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  verificationIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  verificationAccount: { limit: 3, windowMs: 60 * 60 * 1000 },
  verificationConfirmIp: { limit: 20, windowMs: 15 * 60 * 1000 },
});
