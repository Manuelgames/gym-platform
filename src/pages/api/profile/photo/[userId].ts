import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { requireAuthenticatedUser } from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Permite a una cuenta autenticada ver la fotografía vigente de otra cuenta. */
export const GET: APIRoute = async ({ locals, params }) => {
  const viewer = requireAuthenticatedUser(locals.user);
  const userId = params.userId?.trim() ?? '';
  if (!userId) return new Response('No encontrado', { status: 404 });
  const media = await getApplication().getProfilePhoto(viewer.id, userId);
  if (!media) return new Response('No encontrado', { status: 404 });
  return new Response(media.bytes as BodyInit, {
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(media.bytes.byteLength),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
