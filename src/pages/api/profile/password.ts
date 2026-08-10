import type { APIRoute } from 'astro';
import { ApplicationError } from '../../../application/errors';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import {
  redirectAfterPost,
  redirectEndpointError,
  requireAuthenticatedUser,
  requireWritableSession,
} from '../../../infrastructure/http/responses';
import {
  AUTH_RATE_LIMITS,
  getAuthRateLimiter,
  rateLimitSubject,
} from '../../../infrastructure/security/rate-limiter';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, session }) => {
  try {
    const environment = loadAstroServerEnvironment();
    assertTrustedFormOrigin(request, environment.appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    if (locals.accessMode === 'demo') {
      throw new ApplicationError('PASSWORD_CHANGE_UNAVAILABLE', 'La contraseña demo no puede modificarse.');
    }
    const writableSession = requireWritableSession(session);
    const form = await readServerForm(request);
    const limiter = getAuthRateLimiter();
    const lease = limiter.consume(
      `profile-password:${rateLimitSubject(user.id)}`,
      AUTH_RATE_LIMITS.passwordChange,
    );
    await getApplication().changePassword(user.id, {
      currentPassword: readTextField(form, 'currentPassword', { maxRawLength: 128 }),
      newPassword: readTextField(form, 'newPassword', { maxRawLength: 128 }),
      passwordConfirmation: readTextField(form, 'passwordConfirmation', { maxRawLength: 128 }),
    });
    limiter.release(lease);
    await writableSession.regenerate();
    writableSession.set('userId', user.id, { ttl: environment.sessionTtlSeconds });
    return redirectAfterPost(request, '/app/perfil', { updated: 'password' });
  } catch (error) {
    return redirectEndpointError(request, '/app/perfil', error);
  }
};
