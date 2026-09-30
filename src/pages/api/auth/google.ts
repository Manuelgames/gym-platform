import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import {
  assertTrustedFormOrigin,
  assertMatchingCsrfToken,
  readServerForm,
  readTextField,
} from '../../../infrastructure/http/forms';
import {
  redirectAfterPost,
  redirectEndpointError,
  requireWritableSession,
} from '../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter } from '../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Intercambia una identidad Google verificada por una sesión o un perfil pendiente. */
export const POST: APIRoute = async ({ request, session, clientAddress }) => {
  try {
    const environment = loadAstroServerEnvironment();
    assertTrustedFormOrigin(request, environment.appOrigin, {
      allowedOrigins: ['https://accounts.google.com'],
      allowMissingOrigin: true,
    });
    const form = await readServerForm(request, 16 * 1024);
    const csrfToken = readTextField(form, 'csrfToken', { maxRawLength: 512 });
    const expectedCsrfToken = await session?.get('googleAuthCsrf');
    session?.delete('googleAuthCsrf');
    assertMatchingCsrfToken(expectedCsrfToken, csrfToken);
    const limiter = getAuthRateLimiter();
    const lease = limiter.consume(`google-ip:${clientAddress}`, AUTH_RATE_LIMITS.googleIp);
    const result = await getApplication().authenticateWithExternalIdentity(
      readTextField(form, 'credential', { maxRawLength: 8192 }),
    );
    limiter.release(lease);

    const writableSession = requireWritableSession(session);
    await writableSession.regenerate();
    writableSession.delete('userId');
    writableSession.delete('sessionVersion');
    writableSession.delete('pendingExternalRegistration');

    if (result.kind === 'authenticated') {
      writableSession.set('userId', result.user.id, { ttl: environment.sessionTtlSeconds });
      writableSession.set('sessionVersion', result.user.sessionVersion, { ttl: environment.sessionTtlSeconds });
      return redirectAfterPost(request, '/app');
    }

    writableSession.set('pendingExternalRegistration', result.pending, { ttl: 10 * 60 });
    return redirectAfterPost(request, '/completar-perfil-google');
  } catch (error) {
    return redirectEndpointError(request, '/iniciar-sesion', error);
  }
};
