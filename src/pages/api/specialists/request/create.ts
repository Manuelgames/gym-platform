import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Solicita un rol sin aceptar userId ni especialista desde una fuente confiable ajena. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    const role = readTextField(form, 'role', { maxRawLength: 24 });
    await getApplication().requestSpecialist(
      user.id,
      readTextField(form, 'specialistProfileId', { maxRawLength: 80 }),
      role,
    );
    return redirectAfterPost(request, '/app/especialistas', { requested: role });
  } catch (error) {
    return redirectEndpointError(request, '/app/especialistas', error);
  }
};
