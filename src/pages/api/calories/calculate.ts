import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readNumberField, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../infrastructure/http/responses';

export const prerender = false;

/** Calcula y guarda un resultado reproducible bajo el userId de sesión. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    await getApplication().calculateCalories(user.id, {
      age: readNumberField(form, 'age'),
      sex: readTextField(form, 'sex', { maxRawLength: 8 }),
      weightKg: readNumberField(form, ['weight', 'weightKg']),
      heightCm: readNumberField(form, ['height', 'heightCm']),
      activityFactor: readNumberField(form, ['activity', 'activityFactor']),
    });
    return redirectAfterPost(request, '/app/calculadora', { calculated: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/app/calculadora', error);
  }
};
