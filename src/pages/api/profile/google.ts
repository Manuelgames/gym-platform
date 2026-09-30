import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import {
  assertMatchingCsrfToken,
  assertTrustedFormOrigin,
  readServerForm,
  readTextField,
} from '../../../infrastructure/http/forms';
import {
  redirectAfterPost,
  redirectEndpointError,
  requireAuthenticatedUser,
} from '../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter } from '../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Vincula Google al usuario resuelto por la sesión; nunca acepta un userId del formulario. */
export const POST: APIRoute = async ({ request, locals, session, clientAddress }) => {
  try {
    const environment = loadAstroServerEnvironment();
    assertTrustedFormOrigin(request, environment.appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request, 16 * 1024);
    const csrfToken = readTextField(form, 'csrfToken', { maxRawLength: 512 });
    const expectedCsrfToken = await session?.get('googleLinkCsrf');
    session?.delete('googleLinkCsrf');
    assertMatchingCsrfToken(expectedCsrfToken, csrfToken);
    const limiter = getAuthRateLimiter();
    const lease = limiter.consume(`google-link:${clientAddress}`, AUTH_RATE_LIMITS.googleIp);
    await getApplication().linkExternalIdentity(
      user.id,
      readTextField(form, 'credential', { maxRawLength: 8192 }),
    );
    limiter.release(lease);
    return redirectAfterPost(request, '/app/perfil', { updated: 'google' });
  } catch (error) {
    return redirectEndpointError(request, '/app/perfil', error);
  }
};
