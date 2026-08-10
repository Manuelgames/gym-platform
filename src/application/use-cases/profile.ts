import { DomainValidationError } from '../../domain/shared/errors';
import {
  findIdentity,
  normalizePersonName,
  USER_PROFILE_PHOTO_LIMITS,
  validatePassword,
  type User,
} from '../../domain/users/user';
import { ApplicationError } from '../errors';
import type { ChangePasswordInput, PublicUser } from '../facade';
import { assertProfileImageUpload } from '../media-validation';
import type { UserRepository } from '../ports/repositories';
import type {
  Clock,
  IdGenerator,
  MediaContent,
  MediaStorage,
  MediaUpload,
  PasswordHasher,
} from '../ports/services';
import { toPublicUser } from './auth';

function nextUpdatedAt(previous: string, candidate: string): string {
  if (candidate > previous) return candidate;
  const previousTime = Date.parse(previous);
  return Number.isFinite(previousTime)
    ? new Date(previousTime + 1).toISOString()
    : candidate;
}

function validatePasswordField(value: string, field: string): string {
  try {
    return validatePassword(value);
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new DomainValidationError(field, error.message);
    }
    throw error;
  }
}

/** Casos de uso independientes que permiten ampliar el perfil por secciones. */
export class ProfileUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly media: MediaStorage,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new ApplicationError('USER_NOT_FOUND', 'No existe el usuario solicitado.');
    return user;
  }

  private async persist(current: User, updated: User): Promise<void> {
    if (!(await this.users.update(updated, current.updatedAt))) {
      throw new ApplicationError('PROFILE_UPDATE_CONFLICT', 'El perfil cambió mientras se actualizaba.');
    }
  }

  async get(userId: string): Promise<PublicUser> {
    return toPublicUser(await this.requireUser(userId));
  }

  async updateName(userId: string, rawName: string): Promise<PublicUser> {
    const current = await this.requireUser(userId);
    const name = normalizePersonName(rawName);
    if (name === current.name) return toPublicUser(current);
    const updated = {
      ...current,
      name,
      updatedAt: nextUpdatedAt(current.updatedAt, this.clock.now()),
    };
    await this.persist(current, updated);
    return toPublicUser(updated);
  }

  async updatePhoto(userId: string, photo: MediaUpload): Promise<PublicUser> {
    assertProfileImageUpload(photo, 'photo', USER_PROFILE_PHOTO_LIMITS.photoBytes);
    const current = await this.requireUser(userId);
    const reference = await this.media.save(this.ids.next(), photo, this.clock.now());
    const updated = {
      ...current,
      profilePhoto: reference,
      updatedAt: nextUpdatedAt(current.updatedAt, this.clock.now()),
    };
    try {
      await this.persist(current, updated);
    } catch (error) {
      await this.media.delete(reference).catch(() => undefined);
      throw error;
    }
    if (current.profilePhoto) {
      await this.media.delete(current.profilePhoto).catch(() => undefined);
    }
    return toPublicUser(updated);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const current = await this.requireUser(userId);
    const identity = findIdentity(current, 'password');
    if (!identity) {
      throw new ApplicationError('PASSWORD_CHANGE_UNAVAILABLE', 'La cuenta no usa contraseña local.');
    }
    validatePasswordField(input.currentPassword, 'currentPassword');
    const newPassword = validatePasswordField(input.newPassword, 'newPassword');
    if (newPassword !== input.passwordConfirmation) {
      throw new DomainValidationError('passwordConfirmation', 'La confirmación no coincide con la nueva contraseña.');
    }
    if (!(await this.passwords.verify(input.currentPassword, identity.credentialHash))) {
      throw new ApplicationError('CURRENT_PASSWORD_INVALID', 'La contraseña actual no es correcta.');
    }
    if (input.currentPassword === newPassword) {
      throw new DomainValidationError('newPassword', 'La nueva contraseña debe ser diferente de la actual.');
    }
    const credentialHash = await this.passwords.hash(newPassword);
    const updated: User = {
      ...current,
      identities: current.identities.map((candidate) => (
        candidate.provider === 'password' ? { ...candidate, credentialHash } : candidate
      )),
      updatedAt: nextUpdatedAt(current.updatedAt, this.clock.now()),
    };
    await this.persist(current, updated);
  }

  /** Una foto personal puede verla cualquier cuenta autenticada, nunca un visitante anónimo. */
  async getPhoto(viewerUserId: string, targetUserId: string): Promise<MediaContent | null> {
    await this.requireUser(viewerUserId);
    const target = await this.users.findById(targetUserId.trim());
    return target?.profilePhoto ? this.media.read(target.profilePhoto) : null;
  }
}
