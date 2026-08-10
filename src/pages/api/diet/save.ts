import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readNumberField, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../infrastructure/http/responses';

export const prerender = false;

/** Crea o reemplaza el plan vigente del usuario autenticado. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    await getApplication().saveDiet(user.id, {
      goal: readTextField(form, 'goal', { maxRawLength: 16 }),
      preference: readTextField(form, 'preference', { maxRawLength: 16 }),
      meals: readNumberField(form, 'meals'),
    });
    return redirectAfterPost(request, '/app/dieta', { tab: 'ai', saved: 'ai' });
  } catch (error) {
    return redirectEndpointError(request, '/app/dieta', error);
  }
};
