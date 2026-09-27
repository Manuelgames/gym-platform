import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendBezierCurve,
  clip,
  closePath,
  endPath,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  type PDFDocument,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';

const WATERMARK_SIZE = 20;
const WATERMARK_RADIUS = 10;
const WATERMARK_OPACITY = 0.055;

/**
 * Resuelve el recurso tanto durante el desarrollo como en la salida standalone
 * de Astro, donde los archivos de `public` se copian a `dist/client`.
 */
async function readBrandLogo(): Promise<Uint8Array> {
  const moduleDirectory = fileURLToPath(new URL('.', import.meta.url));
  const candidates = [
    resolve(process.cwd(), 'public/assets/logosintexto.png'),
    resolve(process.cwd(), 'dist/client/assets/logosintexto.png'),
    resolve(process.cwd(), 'client/assets/logosintexto.png'),
    resolve(moduleDirectory, '../../../public/assets/logosintexto.png'),
    resolve(moduleDirectory, '../../client/assets/logosintexto.png'),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  throw new Error('No se pudo localizar el logotipo para generar el PDF.');
}

/** Incrusta una sola copia del logo, reutilizable en todas las páginas. */
export async function embedBrandWatermark(document: PDFDocument): Promise<PDFImage> {
  return document.embedPng(await readBrandLogo());
}

/** Dibuja el logo detrás del contenido, centrado y con opacidad de marca de agua. */
export function drawBrandWatermark(page: PDFPage, logo: PDFImage): void {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const x = (pageWidth - WATERMARK_SIZE) / 2;
  const y = (pageHeight - WATERMARK_SIZE) / 2;
  const centerX = x + WATERMARK_RADIUS;
  const centerY = y + WATERMARK_RADIUS;
  const controlOffset = WATERMARK_RADIUS * 0.5522847498;

  // Un radio CSS de 15 px sobre una caja de 20 px se limita a 10 px.
  page.pushOperators(
    pushGraphicsState(),
    moveTo(centerX + WATERMARK_RADIUS, centerY),
    appendBezierCurve(
      centerX + WATERMARK_RADIUS,
      centerY + controlOffset,
      centerX + controlOffset,
      centerY + WATERMARK_RADIUS,
      centerX,
      centerY + WATERMARK_RADIUS,
    ),
    appendBezierCurve(
      centerX - controlOffset,
      centerY + WATERMARK_RADIUS,
      centerX - WATERMARK_RADIUS,
      centerY + controlOffset,
      centerX - WATERMARK_RADIUS,
      centerY,
    ),
    appendBezierCurve(
      centerX - WATERMARK_RADIUS,
      centerY - controlOffset,
      centerX - controlOffset,
      centerY - WATERMARK_RADIUS,
      centerX,
      centerY - WATERMARK_RADIUS,
    ),
    appendBezierCurve(
      centerX + controlOffset,
      centerY - WATERMARK_RADIUS,
      centerX + WATERMARK_RADIUS,
      centerY - controlOffset,
      centerX + WATERMARK_RADIUS,
      centerY,
    ),
    closePath(),
    clip(),
    endPath(),
  );
  page.drawImage(logo, {
    x,
    y,
    width: WATERMARK_SIZE,
    height: WATERMARK_SIZE,
    opacity: WATERMARK_OPACITY,
  });
  page.pushOperators(popGraphicsState());
}
