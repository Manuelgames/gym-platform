import type { APIRoute } from 'astro';
import { getApplication } from '../../../../infrastructure/composition/container';
import { requireAuthenticatedUser } from '../../../../infrastructure/http/responses';

export const prerender = false;

/** Sirve solo archivos que continúan referenciados y solo a usuarios autorizados. */
export const GET: APIRoute = async ({ locals, params }) => {
  const user = requireAuthenticatedUser(locals.user);
  const mediaId = params.mediaId?.trim() ?? '';
  if (!mediaId) return new Response('No encontrado', { status: 404 });
  const media = await getApplication().getSpecialistMedia(user.id, mediaId);
  if (!media) return new Response('No encontrado', { status: 404 });
  const encodedName = encodeURIComponent(media.originalName);
  const disposition = media.mimeType === 'application/pdf' ? 'attachment' : 'inline';
  return new Response(media.bytes as BodyInit, {
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(media.bytes.byteLength),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
