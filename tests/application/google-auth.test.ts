import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthUseCases } from '../../src/application/use-cases/auth';
import { createExternalUser, createPasswordUser } from '../../src/domain/users/user';
import type { ExternalIdentityVerifier } from '../../src/application/ports/services';
import { FileDataStore } from '../../src/infrastructure/persistence/file/file-data-store';
import { GoogleIdentityVerifier } from '../../src/infrastructure/auth/google-identity-verifier';
import { assertMatchingCsrfToken } from '../../src/infrastructure/http/forms';
import { CryptoRecoveryTokenService } from '../../src/infrastructure/security/recovery-token-service';

const directories: string[] = [];

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'google-auth-'));
  directories.push(directory);
  const store = new FileDataStore(join(directory, 'database.json'));
  let now = '2026-09-28T12:00:00.000Z';
  let nextId = 0;
  let identity = {
    provider: 'google' as const,
    subject: 'google-subject-1',
    email: 'google@example.com',
    emailVerified: true,
    displayName: 'Usuario Google',
  };
  const verifier: ExternalIdentityVerifier = {
    provider: 'google',
    verifyIdToken: async () => identity,
  };
  const passwords = {
    hash: async (password: string) => `hash:${password}`,
    verify: async (password: string, encodedHash?: string) => encodedHash === `hash:${password}`,
  };
  const auth = new AuthUseCases(
    store,
    passwords,
    { now: () => now },
    { next: () => `user-${nextId += 1}` },
    new CryptoRecoveryTokenService(),
    null,
    'https://gym.example',
    verifier,
  );
  return {
    auth,
    store,
    setIdentity: (next: typeof identity) => { identity = next; },
    setNow: (next: string) => { now = next; },
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('autenticación con Google', () => {
  it('crea un perfil completo sin guardar contraseña ni token de Google', async () => {
    const { auth, store } = await fixture();
    const result = await auth.authenticateWithExternalIdentity('id-token');
    expect(result.kind).toBe('profile-required');
    if (result.kind !== 'profile-required') throw new Error('Se esperaba completar el perfil.');

    const user = await auth.completeExternalRegistration({
      pending: result.pending,
      birthDate: '1992-05-10',
      sex: 'prefiero no decirlo',
    });
    expect(user).toMatchObject({
      email: 'google@example.com',
      identityProviders: ['google'],
    });
    const stored = await store.findById(user.id);
    expect(stored?.emailVerifiedAt).toBe('2026-09-28T12:00:00.000Z');
    expect(stored?.identities).toEqual([expect.objectContaining({
      provider: 'google',
      subject: 'google-subject-1',
    })]);
    expect(JSON.stringify(stored)).not.toContain('id-token');
    expect(JSON.stringify(stored)).not.toContain('credentialHash');
  });

  it('reconoce una identidad Google vinculada y devuelve el mismo usuario', async () => {
    const { auth, store } = await fixture();
    await store.create(createExternalUser({
      id: 'google-user',
      provider: 'google',
      subject: 'google-subject-1',
      name: 'Usuario Google',
      email: 'google@example.com',
      birthDate: '1992-05-10',
      sex: 'prefiero no decirlo',
      now: '2026-09-28T12:00:00.000Z',
    }));

    await expect(auth.authenticateWithExternalIdentity('id-token')).resolves.toMatchObject({
      kind: 'authenticated',
      user: { id: 'google-user' },
    });
  });

  it('exige vinculación autenticada si el correo ya pertenece a una cuenta local', async () => {
    const { auth, store } = await fixture();
    await store.create({
      ...createPasswordUser({
        id: 'local-user',
        name: 'Usuario Local',
        email: 'google@example.com',
        passwordHash: 'hash:Clave-segura1',
        birthDate: '1990-01-01',
        sex: 'prefiero no decirlo',
        now: '2026-09-28T12:00:00.000Z',
      }),
      emailVerifiedAt: '2026-09-28T12:00:00.000Z',
    });

    await expect(auth.authenticateWithExternalIdentity('id-token'))
      .rejects.toMatchObject({ code: 'EXTERNAL_ACCOUNT_LINK_REQUIRED' });
    await expect(auth.linkExternalIdentity('local-user', 'id-token')).resolves.toMatchObject({
      id: 'local-user',
      identityProviders: ['password', 'google'],
    });
    await expect(auth.authenticateWithExternalIdentity('id-token')).resolves.toMatchObject({
      kind: 'authenticated',
      user: { id: 'local-user' },
    });
  });

  it('rechaza completar un perfil pendiente después de su vencimiento', async () => {
    const { auth, setNow } = await fixture();
    const result = await auth.authenticateWithExternalIdentity('id-token');
    if (result.kind !== 'profile-required') throw new Error('Se esperaba completar el perfil.');
    setNow('2026-09-28T12:10:01.000Z');

    await expect(auth.completeExternalRegistration({
      pending: result.pending,
      birthDate: '1992-05-10',
      sex: 'mujer',
    })).rejects.toMatchObject({ code: 'EXTERNAL_PROFILE_EXPIRED' });
  });

  it('impide vincular una identidad que ya pertenece a otro perfil', async () => {
    const { auth, store } = await fixture();
    await store.create(createExternalUser({
      id: 'owner',
      provider: 'google',
      subject: 'google-subject-1',
      name: 'Propietario',
      email: 'owner@example.com',
      birthDate: '1990-01-01',
      sex: 'hombre',
      now: '2026-09-28T12:00:00.000Z',
    }));
    await store.create({
      ...createPasswordUser({
        id: 'other',
        name: 'Otro usuario',
        email: 'other@example.com',
        passwordHash: 'hash:Clave-segura1',
        birthDate: '1990-01-01',
        sex: 'hombre',
        now: '2026-09-28T12:00:00.000Z',
      }),
      emailVerifiedAt: '2026-09-28T12:00:00.000Z',
    });

    await expect(auth.linkExternalIdentity('other', 'id-token'))
      .rejects.toMatchObject({ code: 'EXTERNAL_IDENTITY_CONFLICT' });
  });
});

describe('protección CSRF de la vinculación', () => {
  it('acepta únicamente el token completo emitido para la sesión', () => {
    expect(() => assertMatchingCsrfToken('token-seguro', 'token-seguro')).not.toThrow();
    expect(() => assertMatchingCsrfToken('token-seguro', 'token-distinto')).toThrow();
    expect(() => assertMatchingCsrfToken(undefined, 'token-seguro')).toThrow();
  });
});

describe('verificador oficial de Google', () => {
  it('rechaza credenciales mal formadas sin exponer detalles del proveedor', async () => {
    const verifier = new GoogleIdentityVerifier('cliente.apps.googleusercontent.com');
    await expect(verifier.verifyIdToken('credencial-inválida'))
      .rejects.toMatchObject({ code: 'EXTERNAL_IDENTITY_INVALID' });
  });
});
