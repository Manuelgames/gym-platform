import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm } from '../../../../infrastructure/http/forms';
import { readEditableRoutineForm } from '../../../../infrastructure/http/routine-forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Guarda la rutina escrita por su propietario. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request, 256 * 1024);
    await getApplication().saveManualRoutine(user.id, readEditableRoutineForm(form));
    return redirectAfterPost(request, '/app/rutina', { tab: 'manual', saved: 'manual' });
  } catch (error) {
    return redirectEndpointError(request, '/app/rutina?tab=manual', error);
  }
};
