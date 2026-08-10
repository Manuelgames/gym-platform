import type { APIRoute } from 'astro';
import {
  SPECIALIST_REQUEST_ACTIONS,
  type SpecialistRequestAction,
} from '../../../../domain/specialists/specialist';
import { DomainValidationError } from '../../../../domain/shared/errors';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Ejecuta una transición autorizada y vuelve al tablero correspondiente al actor. */
export const POST: APIRoute = async ({ request, locals }) => {
  let destination = '/app/mi-trabajo';
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    const action = readTextField(form, 'action', { maxRawLength: 16 });
    if (!SPECIALIST_REQUEST_ACTIONS.includes(action as SpecialistRequestAction)) {
      throw new DomainValidationError('action', 'La acción no es válida.');
    }
    if (action === 'cancel') destination = '/app/especialistas';
    await getApplication().actOnSpecialistRequest(
      user.id,
      readTextField(form, 'requestId', { maxRawLength: 80 }),
      action as SpecialistRequestAction,
    );
    return redirectAfterPost(request, destination, { updated: action });
  } catch (error) {
    return redirectEndpointError(request, destination, error);
  }
};
