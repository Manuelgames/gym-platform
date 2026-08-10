/** Referencia persistente a un archivo cuyos bytes viven fuera del documento de datos. */
export interface StoredMediaReference {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/** Formatos raster seguros admitidos para fotografías dentro de la aplicación. */
export const PROFILE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProfileImageMimeType = (typeof PROFILE_IMAGE_MIME_TYPES)[number];
