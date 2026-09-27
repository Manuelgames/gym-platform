import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readNumberField, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Genera o reemplaza la rutina automática del usuario autenticado. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    await getApplication().generateRoutine(user.id, {
      goal: readTextField(form, 'goal', { maxRawLength: 32 }),
      level: readTextField(form, 'level', { maxRawLength: 24 }),
      location: readTextField(form, 'location', { maxRawLength: 24 }),
      sessionDurationMinutes: readNumberField(form, 'sessionDurationMinutes'),
      restDaysCount: readNumberField(form, 'restDaysCount'),
      limitations: readTextField(form, 'limitations', { optional: true, maxRawLength: 500 }),
    });
    return redirectAfterPost(request, '/app/rutina', { tab: 'ai', saved: 'ai' });
  } catch (error) {
    return redirectEndpointError(request, '/app/rutina?tab=ai', error);
  }
};
