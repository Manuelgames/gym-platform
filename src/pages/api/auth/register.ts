import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireWritableSession } from '../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter } from '../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Registra credenciales, rota la sesión y conserva en ella únicamente userId. */
export const POST: APIRoute = async ({ request, session, clientAddress }) => {
  try {
    const environment = loadAstroServerEnvironment();
    assertTrustedFormOrigin(request, environment.appOrigin);
    getAuthRateLimiter().consume(`register:${clientAddress}`, AUTH_RATE_LIMITS.register);
    const writableSession = requireWritableSession(session);
    const form = await readServerForm(request);
    const user = await getApplication().register({
      name: readTextField(form, 'name', { maxRawLength: 80 }),
      email: readTextField(form, 'email', { maxRawLength: 254 }),
      password: readTextField(form, 'password', { maxRawLength: 128 }),
      birthDate: readTextField(form, 'birthDate', { maxRawLength: 10 }),
      sex: readTextField(form, 'sex', { maxRawLength: 32 }),
    });
    // Esperamos la rotación antes de responder para no perder la nueva cookie.
    await writableSession.regenerate();
    writableSession.set('userId', user.id, { ttl: environment.sessionTtlSeconds });
    return redirectAfterPost(request, '/app');
  } catch (error) {
    return redirectEndpointError(request, '/registro', error);
  }
};
