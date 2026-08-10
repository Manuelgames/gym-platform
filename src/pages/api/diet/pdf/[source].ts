import type { APIRoute } from 'astro';
import { DIET_PLAN_SOURCES, type DietPlanSource } from '../../../../domain/diet/diet';
import { getApplication } from '../../../../infrastructure/composition/container';
import { requireAuthenticatedUser } from '../../../../infrastructure/http/responses';
import { createDietPdf } from '../../../../infrastructure/pdf/diet-pdf';

export const prerender = false;

/** Descarga la modalidad solicitada del usuario autenticado como PDF A4. */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = requireAuthenticatedUser(locals.user);
  const source = params.source ?? '';
  if (!DIET_PLAN_SOURCES.includes(source as DietPlanSource)) {
    return new Response('Modalidad no válida.', { status: 404 });
  }
  try {
    const application = getApplication();
    const [plan, calorieHistory] = await Promise.all([
      application.getDietForDownload(user.id, source as DietPlanSource),
      application.getCalories(user.id),
    ]);
    const calculation = calorieHistory.find((item) => item.id === plan.calorieCalculationId)
      ?? calorieHistory[0]
      ?? null;
    const bytes = await createDietPdf(plan, {
      clientName: user.name,
      age: calculation?.age ?? null,
      weightKg: calculation?.weightKg ?? null,
      heightCm: calculation?.heightCm ?? null,
    });
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="dieta-${source}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('La dieta todavía no está disponible.', { status: 404 });
  }
};
