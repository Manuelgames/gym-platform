import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { StoredMediaReference } from '../../../domain/shared/media';
import type { MediaContent, MediaStorage, MediaUpload } from '../../../application/ports/services';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** Almacena archivos administrados fuera del JSON y de `public/`. */
export class LocalMediaStore implements MediaStorage {
  private readonly directory: string;

  constructor(directory: string) {
    this.directory = resolve(directory);
  }

  /** Escribe con permisos privados y una extensión derivada del MIME validado. */
  async save(id: string, upload: MediaUpload, now: string): Promise<StoredMediaReference> {
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) throw new Error('Identificador de medio no seguro.');
    const extension = EXTENSIONS[upload.mimeType];
    if (!extension) throw new Error('Tipo de medio no soportado.');
    const storageKey = `${id}.${extension}`;
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, storageKey);
    const handle = await open(path, 'wx', 0o600);
    let completed = false;
    try {
      await handle.writeFile(upload.bytes);
      await handle.sync();
      completed = true;
    } finally {
      await handle.close();
      if (!completed) await unlink(path).catch(() => undefined);
    }
    return {
      id,
      storageKey,
      originalName: upload.originalName.trim(),
      mimeType: upload.mimeType,
      sizeBytes: upload.bytes.byteLength,
      createdAt: now,
    };
  }

  /** Lee solo claves simples ya autorizadas mediante una referencia persistida. */
  async read(reference: StoredMediaReference): Promise<MediaContent | null> {
    if (basename(reference.storageKey) !== reference.storageKey) return null;
    try {
      const bytes = await readFile(join(this.directory, reference.storageKey));
      return {
        bytes: new Uint8Array(bytes),
        mimeType: reference.mimeType,
        originalName: reference.originalName,
      };
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  /** Elimina únicamente un archivo cuya referencia ya fue autorizada. */
  async delete(reference: StoredMediaReference): Promise<void> {
    if (basename(reference.storageKey) !== reference.storageKey) return;
    await unlink(join(this.directory, reference.storageKey)).catch((error: unknown) => {
      if (!isMissingFile(error)) throw error;
    });
  }
}
