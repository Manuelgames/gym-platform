import type { APIRoute } from 'astro';
import { ApplicationError } from '../../../../application/errors';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import {
  redirectAfterPost,
  redirectEndpointError,
  requireWritableSession,
} from '../../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter } from '../../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Completa los datos que Google no entrega y crea la cuenta interna. */
export const POST: APIRoute = async ({ request, session, clientAddress }) => {
  try {
    const environment = loadAstroServerEnvironment();
    assertTrustedFormOrigin(request, environment.appOrigin);
    const writableSession = requireWritableSession(session);
    const pending = await writableSession.get('pendingExternalRegistration');
    if (!pending) throw new ApplicationError('EXTERNAL_PROFILE_EXPIRED', 'No existe un perfil pendiente.');
    getAuthRateLimiter().consume(`google-complete:${clientAddress}`, AUTH_RATE_LIMITS.register);
    const form = await readServerForm(request);
    const user = await getApplication().completeExternalRegistration({
      pending,
      birthDate: readTextField(form, 'birthDate', { maxRawLength: 10 }),
      sex: readTextField(form, 'sex', { maxRawLength: 32 }),
    });
    await writableSession.regenerate();
    writableSession.delete('pendingExternalRegistration');
    writableSession.set('userId', user.id, { ttl: environment.sessionTtlSeconds });
    writableSession.set('sessionVersion', user.sessionVersion, { ttl: environment.sessionTtlSeconds });
    return redirectAfterPost(request, '/app');
  } catch (error) {
    return redirectEndpointError(request, '/completar-perfil-google', error);
  }
};
