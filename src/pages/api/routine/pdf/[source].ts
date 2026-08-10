import type { APIRoute } from 'astro';
import { ROUTINE_PLAN_SOURCES, type RoutinePlanSource } from '../../../../domain/routine/routine';
import { getApplication } from '../../../../infrastructure/composition/container';
import { requireAuthenticatedUser } from '../../../../infrastructure/http/responses';
import { createRoutinePdf } from '../../../../infrastructure/pdf/routine-pdf';

export const prerender = false;

/** Descarga una modalidad de rutina perteneciente al usuario autenticado. */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = requireAuthenticatedUser(locals.user);
  const source = params.source ?? '';
  if (!ROUTINE_PLAN_SOURCES.includes(source as RoutinePlanSource)) {
    return new Response('Modalidad no válida.', { status: 404 });
  }
  try {
    const plan = await getApplication().getRoutineForDownload(user.id, source as RoutinePlanSource);
    const bytes = await createRoutinePdf(plan, { clientName: user.name });
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rutina-${source}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new Response('La rutina solicitada no existe.', { status: 404 });
  }
};
