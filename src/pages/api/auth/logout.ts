import type { APIRoute } from 'astro';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError } from '../../../infrastructure/http/responses';

export const prerender = false;

/** Destruye tanto la cookie como el registro del driver de Astro Sessions. */
export const POST: APIRoute = async ({ request, session }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    session?.destroy();
    return redirectAfterPost(request, '/');
  } catch (error) {
    return redirectEndpointError(request, '/', error);
  }
};
