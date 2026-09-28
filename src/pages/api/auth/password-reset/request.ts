import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError } from '../../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter, rateLimitSubject } from '../../../../infrastructure/security/rate-limiter';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const form = await readServerForm(request);
    const email = readTextField(form, 'email', { maxRawLength: 254 });
    const limiter = getAuthRateLimiter();
    limiter.consume(`recovery-ip:${clientAddress}`, AUTH_RATE_LIMITS.recoveryIp);
    limiter.consume(`recovery-account:${rateLimitSubject(email)}`, AUTH_RATE_LIMITS.recoveryAccount);
    await getApplication().requestPasswordReset(email);
    return redirectAfterPost(request, '/recuperar-contrasena', { sent: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/recuperar-contrasena', error);
  }
};
