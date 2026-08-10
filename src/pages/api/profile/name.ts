import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../infrastructure/http/responses';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    await getApplication().updateProfileName(
      user.id,
      readTextField(form, 'name', { maxRawLength: 80 }),
    );
    return redirectAfterPost(request, '/app/perfil', { updated: 'name' });
  } catch (error) {
    return redirectEndpointError(request, '/app/perfil', error);
  }
};
