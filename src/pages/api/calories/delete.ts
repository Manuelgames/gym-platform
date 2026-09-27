import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../infrastructure/http/responses';

export const prerender = false;

/** Elimina un registro por id y por el propietario obtenido de la sesión. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    await getApplication().deleteCalorieCalculation(
      user.id,
      readTextField(form, ['calculationId', 'id'], { maxRawLength: 64 }),
    );
    return redirectAfterPost(request, '/app/calculadora', { deleted: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/app/calculadora', error);
  }
};
