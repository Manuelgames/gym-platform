import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readNumberField, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../infrastructure/http/responses';

export const prerender = false;

/** Añade un ejercicio al userId resuelto por middleware, nunca al enviado por el cliente. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    await getApplication().addRoutineExercise(user.id, {
      day: readTextField(form, 'day', { maxRawLength: 16 }),
      muscle: readTextField(form, 'muscle', { maxRawLength: 24 }),
      name: readTextField(form, 'name', { maxRawLength: 80 }),
      sets: readNumberField(form, 'sets'),
      reps: readTextField(form, 'reps', { maxRawLength: 20 }),
      notes: readTextField(form, 'notes', { optional: true, maxRawLength: 240 }),
    });
    return redirectAfterPost(request, '/app/rutina', { saved: '1' });
  } catch (error) {
    return redirectEndpointError(request, '/app/rutina', error);
  }
};
