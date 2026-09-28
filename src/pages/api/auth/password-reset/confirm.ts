import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError } from '../../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter } from '../../../../infrastructure/security/rate-limiter';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let userId = '';
  let token = '';
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    getAuthRateLimiter().consume(`reset-ip:${clientAddress}`, AUTH_RATE_LIMITS.resetIp);
    const form = await readServerForm(request);
    userId = readTextField(form, 'userId', { maxRawLength: 64 });
    token = readTextField(form, 'token', { maxRawLength: 64 });
    await getApplication().resetPassword(
      userId, token,
      readTextField(form, 'newPassword', { maxRawLength: 128 }),
      readTextField(form, 'passwordConfirmation', { maxRawLength: 128 }),
    );
    return redirectAfterPost(request, '/iniciar-sesion', { reset: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/restablecer-contrasena', error, { userId, token });
  }
};
