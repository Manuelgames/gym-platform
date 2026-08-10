import type { APIRoute } from 'astro';
import { SPECIALIST_UPLOAD_LIMITS } from '../../../../domain/specialists/specialist';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import {
  assertTrustedFormOrigin,
  readFileField,
  readFileFields,
  readServerForm,
  readTextField,
  readTextFields,
} from '../../../../infrastructure/http/forms';
import {
  redirectAfterPost,
  redirectEndpointError,
  requireAuthenticatedUser,
} from '../../../../infrastructure/http/responses';

export const prerender = false;

async function upload(file: File) {
  return {
    originalName: file.name,
    mimeType: file.type.toLowerCase(),
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

/** Registra perfil y archivos privados para el propietario resuelto en middleware. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request, SPECIALIST_UPLOAD_LIMITS.totalFormBytes);
    const photo = readFileField(form, 'photo');
    if (!photo) throw new Error('La fotografía requerida no fue leída.');
    const certificateFiles = readFileFields(
      form,
      'certificates',
      SPECIALIST_UPLOAD_LIMITS.certificateCount,
    );
    await getApplication().registerSpecialist(user.id, {
      presentation: readTextField(form, 'presentation', { maxRawLength: 800 }),
      experience: readTextField(form, 'experience', { maxRawLength: 2_000 }),
      roles: readTextFields(form, 'roles', { maxItems: 2, maxRawLength: 24 }),
      photo: await upload(photo),
      certificates: await Promise.all(certificateFiles.map(upload)),
    });
    return redirectAfterPost(request, '/app/mi-trabajo', { registered: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/app/especialistas', error);
  }
};
