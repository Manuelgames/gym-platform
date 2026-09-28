import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError } from '../../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter, rateLimitSubject } from '../../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Reenvía la confirmación con una respuesta genérica para no enumerar cuentas. */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const form = await readServerForm(request);
    const email = readTextField(form, 'email', { maxRawLength: 254 });
    const limiter = getAuthRateLimiter();
    limiter.consume(`verification-ip:${clientAddress}`, AUTH_RATE_LIMITS.verificationIp);
    limiter.consume(
      `verification-account:${rateLimitSubject(email)}`,
      AUTH_RATE_LIMITS.verificationAccount,
    );
    await getApplication().requestEmailVerification(email);
    return redirectAfterPost(request, '/confirmar-correo', { sent: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/confirmar-correo', error);
  }
};
