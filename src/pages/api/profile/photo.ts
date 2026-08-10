import type { APIRoute } from 'astro';
import { USER_PROFILE_PHOTO_LIMITS } from '../../../domain/users/user';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readFileField, readServerForm } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../infrastructure/http/responses';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request, USER_PROFILE_PHOTO_LIMITS.totalFormBytes);
    const file = readFileField(form, 'photo');
    if (!file) throw new Error('La fotografía requerida no fue leída.');
    await getApplication().updateProfilePhoto(user.id, {
      originalName: file.name,
      mimeType: file.type.toLowerCase(),
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return redirectAfterPost(request, '/app/perfil', { updated: 'photo' });
  } catch (error) {
    return redirectEndpointError(request, '/app/perfil', error);
  }
};
