import { ApplicationError } from '../../application/errors';
import type { PublicUser } from '../../application/facade';
import { DomainValidationError } from '../../domain/shared/errors';
import { RateLimitExceededError } from '../security/rate-limiter';

/** Construye un redirect 303 de patrón POST/Redirect/GET y desactiva caché. */
export function redirectAfterPost(
  request: Request,
  pathname: string,
  query: Record<string, string> = {},
): Response {
  const destination = new URL(pathname, request.url);
  for (const [key, value] of Object.entries(query)) destination.searchParams.set(key, value);
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${destination.pathname}${destination.search}`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Exige que Astro Sessions esté configurado antes de crear una cuenta. */
export function requireWritableSession<T>(
  session: T,
): NonNullable<T> {
  if (!session) {
    throw new ApplicationError('SESSION_UNAVAILABLE', 'Astro Sessions no está configurado.');
  }
  return session as NonNullable<T>;
}

/** Obtiene el propietario autenticado exclusivamente desde `locals`. */
export function requireAuthenticatedUser(user: PublicUser | null): PublicUser {
  if (!user) {
    throw new ApplicationError('USER_NOT_FOUND', 'No existe un usuario autenticado.');
  }
  return user;
}

function publicError(error: unknown): { error: string; field?: string } {
  if (error instanceof RateLimitExceededError) {
    return { error: 'rate-limited' };
  }
  if (error instanceof DomainValidationError) {
    return { error: 'validation', field: error.field };
  }
  if (error instanceof ApplicationError) {
    switch (error.code) {
      case 'EMAIL_ALREADY_REGISTERED': return { error: 'email-registered' };
      case 'EMAIL_VERIFICATION_UNAVAILABLE': return { error: 'email-verification-unavailable' };
      case 'EMAIL_VERIFICATION_INVALID': return { error: 'email-verification-invalid' };
      case 'EMAIL_NOT_VERIFIED': return { error: 'email-not-verified' };
      case 'INVALID_CREDENTIALS': return { error: 'invalid-credentials' };
      case 'CURRENT_PASSWORD_INVALID': return { error: 'current-password-invalid', field: 'currentPassword' };
      case 'PASSWORD_CHANGE_UNAVAILABLE': return { error: 'password-change-unavailable' };
      case 'RECOVERY_UNAVAILABLE': return { error: 'recovery-unavailable' };
      case 'RESET_LINK_INVALID': return { error: 'reset-link-invalid' };
      case 'PROFILE_UPDATE_CONFLICT': return { error: 'profile-update-conflict' };
      case 'ROUTINE_EXERCISE_NOT_FOUND': return { error: 'exercise-not-found' };
      case 'ROUTINE_PLAN_NOT_FOUND': return { error: 'routine-plan-not-found' };
      case 'TRAINING_RELATION_REQUIRED': return { error: 'training-relation-required' };
      case 'CALORIE_CALCULATION_NOT_FOUND': return { error: 'calculation-not-found' };
      case 'CALORIE_PROFILE_REQUIRED': return { error: 'calorie-profile-required' };
      case 'DIET_PLAN_NOT_FOUND': return { error: 'diet-plan-not-found' };
      case 'NUTRITION_RELATION_REQUIRED': return { error: 'nutrition-relation-required' };
      case 'USER_NOT_FOUND': return { error: 'authentication-required' };
      case 'SESSION_UNAVAILABLE': return { error: 'session-unavailable' };
      case 'SPECIALIST_PROFILE_ALREADY_EXISTS': return { error: 'specialist-profile-exists' };
      case 'SPECIALIST_PROFILE_NOT_FOUND': return { error: 'specialist-not-found' };
      case 'SPECIALIST_ROLE_UNAVAILABLE': return { error: 'specialist-role-unavailable' };
      case 'SPECIALIST_SELF_REQUEST': return { error: 'specialist-self-request' };
      case 'SPECIALIST_REQUEST_CONFLICT': return { error: 'specialist-request-conflict' };
      case 'SPECIALIST_REQUEST_NOT_FOUND': return { error: 'specialist-request-not-found' };
    }
  }
  return { error: 'unexpected' };
}

/** Traduce errores conocidos sin filtrar mensajes, hashes, rutas o datos personales. */
export function redirectEndpointError(
  request: Request,
  pathname: string,
  error: unknown,
  query: Record<string, string> = {},
): Response {
  const safe = publicError(error);
  if (safe.error === 'unexpected') console.error('Error inesperado en endpoint.', error);
  const response = redirectAfterPost(request, pathname, {
    ...query,
    error: safe.error,
    ...(safe.field ? { field: safe.field } : {}),
  });
  if (error instanceof RateLimitExceededError) {
    response.headers.set('Retry-After', String(error.retryAfterSeconds));
  }
  return response;
}
