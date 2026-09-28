import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertTrustedFormOrigin } from '../../src/infrastructure/http/forms';

async function typescriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  }));
  return nested.flat();
}

describe('protección de formularios detrás del proxy', () => {
  it('acepta únicamente el Origin público configurado', () => {
    expect(() => assertTrustedFormOrigin(
      new Request('http://internal.railway:8080/api/auth/register', {
        method: 'POST',
        headers: { Origin: 'https://gym.example' },
      }),
      'https://gym.example/',
    )).not.toThrow();

    expect(() => assertTrustedFormOrigin(
      new Request('http://internal.railway:8080/api/auth/register', {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
      }),
      'https://gym.example',
    )).toThrow(expect.objectContaining({ field: 'form' }));
  });

  it('mantiene la validación explícita en todos los endpoints POST', async () => {
    const files = await typescriptFiles(join(process.cwd(), 'src', 'pages', 'api'));
    const unprotected: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (source.includes('export const POST') && !source.includes('assertTrustedFormOrigin(')) {
        unprotected.push(file);
      }
    }
    expect(unprotected).toEqual([]);
  });
});
