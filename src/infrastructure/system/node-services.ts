import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from '../../application/ports/services';

/** Reloj UTC del proceso Node. */
export class SystemClock implements Clock {
  /** Devuelve un instante ISO 8601. */
  now(): string {
    return new Date().toISOString();
  }
}

/** Generador criptográfico de UUID para entidades persistentes. */
export class CryptoIdGenerator implements IdGenerator {
  /** Genera un UUID v4 mediante el CSPRNG de Node. */
  next(): string {
    return randomUUID();
  }
}
