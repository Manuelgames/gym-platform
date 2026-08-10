import { PROFILE_IMAGE_MIME_TYPES } from '../domain/shared/media';
import { DomainValidationError } from '../domain/shared/errors';
import type { MediaUpload } from './ports/services';

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function isWebp(bytes: Uint8Array): boolean {
  return bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

/** Valida metadatos, límite y firma real de una fotografía antes de persistirla. */
export function assertProfileImageUpload(
  upload: MediaUpload,
  field: string,
  maximumBytes: number,
): void {
  if (!upload.originalName.trim() || upload.originalName.length > 180 || /[\r\n\0]/.test(upload.originalName)) {
    throw new DomainValidationError(field, 'El nombre del archivo no es válido.');
  }
  if (upload.bytes.byteLength < 8 || upload.bytes.byteLength > maximumBytes) {
    throw new DomainValidationError(field, `La imagen debe pesar como máximo ${maximumBytes / 1024 / 1024} MB.`);
  }
  if (!PROFILE_IMAGE_MIME_TYPES.includes(upload.mimeType as never)) {
    throw new DomainValidationError(field, 'La fotografía debe ser JPEG, PNG o WebP.');
  }
  const validSignature = upload.mimeType === 'image/jpeg'
    ? bytesStartWith(upload.bytes, [0xff, 0xd8, 0xff])
    : upload.mimeType === 'image/png'
      ? bytesStartWith(upload.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : isWebp(upload.bytes);
  if (!validSignature) {
    throw new DomainValidationError(field, 'El contenido no corresponde a una imagen válida.');
  }
}
