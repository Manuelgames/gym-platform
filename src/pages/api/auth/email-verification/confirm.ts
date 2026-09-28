import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError } from '../../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter } from '../../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Consume el enlace de un solo uso; el usuario inicia sesión por separado. */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  let userId = '';
  let token = '';
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    getAuthRateLimiter().consume(
      `verification-confirm:${clientAddress}`,
      AUTH_RATE_LIMITS.verificationConfirmIp,
    );
    const form = await readServerForm(request);
    userId = readTextField(form, 'userId', { maxRawLength: 64 });
    token = readTextField(form, 'token', { maxRawLength: 256 });
    await getApplication().verifyEmail(userId, token);
    return redirectAfterPost(request, '/iniciar-sesion', { verified: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/verificar-correo', error, {
      ...(userId ? { userId } : {}),
      ...(token ? { token } : {}),
    });
  }
};
