import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { readEditableDietForm } from '../../../../infrastructure/http/diet-forms';
import { assertTrustedFormOrigin, readServerForm } from '../../../../infrastructure/http/forms';
import {
  redirectAfterPost,
  redirectEndpointError,
  requireAuthenticatedUser,
} from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Guarda la dieta escrita por su propio propietario. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request, 256 * 1024);
    await getApplication().saveManualDiet(user.id, readEditableDietForm(form));
    return redirectAfterPost(request, '/app/dieta', { tab: 'manual', saved: 'manual' });
  } catch (error) {
    return redirectEndpointError(request, '/app/dieta?tab=manual', error);
  }
};
