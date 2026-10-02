import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireAuthenticatedUser } from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Elimina una versión anterior; el caso de uso protege siempre la versión vigente. */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    assertTrustedFormOrigin(request, loadAstroServerEnvironment().appOrigin);
    const user = requireAuthenticatedUser(locals.user);
    const form = await readServerForm(request);
    const source = await getApplication().deleteRoutinePlanFromHistory(
      user.id,
      readTextField(form, 'planId', { maxRawLength: 128 }),
    );
    return redirectAfterPost(request, '/app/rutina', { tab: source, historyDeleted: source });
  } catch (error) {
    const tab = new URL(request.url).searchParams.get('tab') === 'manual' ? 'manual' : 'ai';
    return redirectEndpointError(request, `/app/rutina?tab=${tab}`, error);
  }
};
