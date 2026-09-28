import { DomainValidationError } from '../../domain/shared/errors';
import { findIdentity, normalizeEmail, validatePassword, type User } from '../../domain/users/user';
import { ApplicationError } from '../errors';
import type { UserRepository } from '../ports/repositories';
import type { Clock, PasswordHasher, PasswordRecoveryMailer, RecoveryTokenService } from '../ports/services';

const RESET_TTL_MS = 30 * 60 * 1000;
const DEMO_USER_ID = 'demo-user-v1';

function nextUpdatedAt(previous: string, candidate: string): string {
  return candidate > previous ? candidate : new Date(Date.parse(previous) + 1).toISOString();
}

/** Emite y consume enlaces de un solo uso sin exponer si un correo existe. */
export class PasswordRecoveryUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
    private readonly tokens: RecoveryTokenService,
    private readonly mailer: PasswordRecoveryMailer | null,
    private readonly appOrigin: string,
  ) {}

  async request(emailInput: string): Promise<void> {
    if (!this.mailer) {
      throw new ApplicationError('RECOVERY_UNAVAILABLE', 'El envío de correos no está configurado.');
    }
    const email = normalizeEmail(emailInput);
    let user: User | null = null;
    let token = '';
    let digest = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.users.findByEmail(email);
      if (!current || current.id === DEMO_USER_ID || !current.emailVerifiedAt
        || !findIdentity(current, 'password')) return;
      ({ token, digest } = this.tokens.issue());
      const now = this.clock.now();
      const updated: User = {
        ...current,
        passwordReset: { tokenDigest: digest, expiresAt: new Date(Date.parse(now) + RESET_TTL_MS).toISOString() },
        updatedAt: nextUpdatedAt(current.updatedAt, now),
      };
      // Un cambio concurrente de perfil o enlace requiere releer antes de enviar.
      if (await this.users.update(updated, current.updatedAt)) {
        user = current;
        break;
      }
    }
    if (!user) return;

    const url = new URL('/restablecer-contrasena', this.appOrigin);
    url.searchParams.set('userId', user.id);
    url.searchParams.set('token', token);
    try {
      await this.mailer.sendResetLink(user.email, url.toString());
    } catch {
      // La respuesta sigue siendo idéntica para correos existentes e inexistentes.
      console.error('No fue posible entregar un correo de recuperación.');
      try {
        const current = await this.users.findById(user.id);
        if (current?.passwordReset?.tokenDigest === digest) {
          await this.users.update({
            ...current,
            passwordReset: null,
            updatedAt: nextUpdatedAt(current.updatedAt, this.clock.now()),
          }, current.updatedAt);
        }
      } catch {
        console.error('No fue posible limpiar un enlace de recuperación no entregado.');
      }
    }
  }

  async reset(userId: string, token: string, password: string, confirmation: string): Promise<void> {
    if (userId.length > 64 || !userId.trim() || !this.tokens.digest(token)) {
      throw new ApplicationError('RESET_LINK_INVALID', 'El enlace no es válido.');
    }
    let newPassword: string;
    try {
      newPassword = validatePassword(password);
    } catch (error) {
      if (error instanceof DomainValidationError) throw new DomainValidationError('newPassword', error.message);
      throw error;
    }
    if (newPassword !== confirmation) {
      throw new DomainValidationError('passwordConfirmation', 'La confirmación no coincide.');
    }
    const digest = this.tokens.digest(token)!;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const user = await this.users.findById(userId);
      const identity = user ? findIdentity(user, 'password') : undefined;
      if (!user || !identity?.credentialHash || user.id === DEMO_USER_ID
        || user.passwordReset?.tokenDigest !== digest
        || Date.parse(user.passwordReset.expiresAt) <= Date.parse(this.clock.now())) {
        throw new ApplicationError('RESET_LINK_INVALID', 'El enlace caducó o ya se utilizó.');
      }
      if (await this.passwords.verify(newPassword, identity.credentialHash)) {
        throw new DomainValidationError('newPassword', 'Elige una contraseña diferente a la anterior.');
      }
      const now = this.clock.now();
      const credentialHash = await this.passwords.hash(newPassword);
      const updated: User = {
        ...user,
        passwordReset: null,
        sessionVersion: user.sessionVersion + 1,
        identities: user.identities.map((candidate) => (
          candidate.provider === 'password' ? { ...candidate, credentialHash } : candidate
        )),
        updatedAt: nextUpdatedAt(user.updatedAt, now),
      };
      if (await this.users.update(updated, user.updatedAt)) {
        await this.mailer?.sendPasswordChanged(user.email).catch(() => {
          console.error('No fue posible entregar un aviso de cambio de contraseña.');
        });
        return;
      }
    }
    throw new ApplicationError('RESET_LINK_INVALID', 'El enlace ya no está disponible.');
  }
}
