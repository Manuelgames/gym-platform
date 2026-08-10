import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { readEditableDietForm } from '../../../../infrastructure/http/diet-forms';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import {
  redirectAfterPost,
  redirectEndpointError,
  requireAuthenticatedUser,
} from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Guarda una dieta únicamente desde una asesoría nutricional aceptada. */
export const POST: APIRoute = async ({ request, locals }) => {
  let requestId = '';
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request, 256 * 1024);
    requestId = readTextField(form, 'requestId', { maxRawLength: 100 }).trim();
    await getApplication().saveSpecialistDiet(user.id, requestId, readEditableDietForm(form));
    return redirectAfterPost(request, `/app/mi-trabajo/nutricion/${encodeURIComponent(requestId)}`, {
      saved: 'specialist',
    });
  } catch (error) {
    const fallback = requestId
      ? `/app/mi-trabajo/nutricion/${encodeURIComponent(requestId)}`
      : '/app/mi-trabajo';
    return redirectEndpointError(request, fallback, error);
  }
};
