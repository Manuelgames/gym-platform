import { describe, expect, it } from 'vitest';
import { ProfileUseCases } from '../../src/application/use-cases/profile';
import type { UserRepository } from '../../src/application/ports/repositories';
import type { MediaStorage, PasswordHasher } from '../../src/application/ports/services';
import type { StoredMediaReference } from '../../src/domain/shared/media';
import { DomainValidationError } from '../../src/domain/shared/errors';
import { createPasswordUser, type IdentityProvider, type User } from '../../src/domain/users/user';

const now = '2026-08-06T12:00:00.000Z';

class MemoryUsers implements UserRepository {
  constructor(readonly users: User[]) {}
  async findById(id: string) { return structuredClone(this.users.find((user) => user.id === id) ?? null); }
  async findByEmail(email: string) { return structuredClone(this.users.find((user) => user.email === email) ?? null); }
  async findByIdentity(provider: IdentityProvider, subject: string) {
    return structuredClone(this.users.find((user) => user.identities.some(
      (identity) => identity.provider === provider && identity.subject === subject,
    )) ?? null);
  }
  async create(user: User) { this.users.push(structuredClone(user)); return true; }
  async update(user: User, expectedUpdatedAt: string) {
    const index = this.users.findIndex((candidate) => candidate.id === user.id);
    if (index < 0 || this.users[index]!.updatedAt !== expectedUpdatedAt) return false;
    this.users[index] = structuredClone(user);
    return true;
  }
}

class MemoryMedia implements MediaStorage {
  readonly files = new Map<string, { reference: StoredMediaReference; bytes: Uint8Array }>();
  readonly deleted: string[] = [];
  async save(id: string, upload: { originalName: string; mimeType: string; bytes: Uint8Array }, createdAt: string) {
    const reference = {
      id, storageKey: `${id}.png`, originalName: upload.originalName,
      mimeType: upload.mimeType, sizeBytes: upload.bytes.byteLength, createdAt,
    };
    this.files.set(id, { reference, bytes: upload.bytes });
    return reference;
  }
  async read(reference: StoredMediaReference) {
    const file = this.files.get(reference.id);
    return file ? { bytes: file.bytes, mimeType: reference.mimeType, originalName: reference.originalName } : null;
  }
  async delete(reference: StoredMediaReference) {
    this.deleted.push(reference.id);
    this.files.delete(reference.id);
  }
}

const passwords: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: async (password, encodedHash) => encodedHash === `hash:${password}`,
};

function account(id = 'user-1') {
  return createPasswordUser({
    id, name: 'Nombre Original', email: `${id}@example.com`,
    passwordHash: 'hash:actual-segura', birthDate: '1990-01-01',
    sex: 'prefiero no decirlo', now: '2026-08-05T12:00:00.000Z',
  });
}

function useCases(users: MemoryUsers, media = new MemoryMedia()) {
  let nextId = 0;
  return {
    media,
    profile: new ProfileUseCases(
      users, passwords, media, { now: () => now }, { next: () => `media-${nextId += 1}-safe` },
    ),
  };
}

describe('perfil de cuenta', () => {
  it('actualiza y normaliza el nombre sin modificar la identidad', async () => {
    const users = new MemoryUsers([account()]);
    const { profile } = useCases(users);

    const updated = await profile.updateName('user-1', '  Nuevo   Nombre ');

    expect(updated.name).toBe('Nuevo Nombre');
    expect(users.users[0]?.email).toBe('user-1@example.com');
  });

  it('exige la contraseña actual, confirmación y una contraseña distinta', async () => {
    const users = new MemoryUsers([account()]);
    const { profile } = useCases(users);

    await expect(profile.changePassword('user-1', {
      currentPassword: 'incorrecta', newPassword: 'nueva-segura', passwordConfirmation: 'nueva-segura',
    })).rejects.toMatchObject({ code: 'CURRENT_PASSWORD_INVALID' });
    await expect(profile.changePassword('user-1', {
      currentPassword: 'actual-segura', newPassword: 'nueva-segura', passwordConfirmation: 'otra-segura',
    })).rejects.toBeInstanceOf(DomainValidationError);

    await profile.changePassword('user-1', {
      currentPassword: 'actual-segura', newPassword: 'nueva-segura', passwordConfirmation: 'nueva-segura',
    });
    expect(users.users[0]?.identities[0]).toMatchObject({ credentialHash: 'hash:nueva-segura' });
  });

  it('reemplaza la fotografía y permite verla desde otra cuenta autenticada', async () => {
    const users = new MemoryUsers([account(), account('viewer')]);
    const { profile, media } = useCases(users);
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    await profile.updatePhoto('user-1', { originalName: 'primera.png', mimeType: 'image/png', bytes: png });
    await profile.updatePhoto('user-1', { originalName: 'segunda.png', mimeType: 'image/png', bytes: png });
    const visible = await profile.getPhoto('viewer', 'user-1');

    expect(users.users[0]?.profilePhoto?.originalName).toBe('segunda.png');
    expect(media.deleted).toEqual(['media-1-safe']);
    expect(visible?.mimeType).toBe('image/png');
  });
});
