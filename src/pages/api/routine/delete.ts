import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../infrastructure/http/responses';

export const prerender = false;

/** Elimina por id y propietario de sesión; un id ajeno se trata como inexistente. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    await getApplication().deleteRoutineExercise(
      user.id,
      readTextField(form, ['exerciseId', 'id'], { maxRawLength: 64 }),
    );
    return redirectAfterPost(request, '/app/rutina', { deleted: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/app/rutina', error);
  }
};
