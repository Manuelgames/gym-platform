import {
  createPasswordUser,
  findIdentity,
  normalizeEmail,
  normalizePersonName,
  validateBirthDate,
  validatePassword,
  validateProfileSex,
  type User,
} from '../../domain/users/user';
import { ApplicationError } from '../errors';
import type { LoginInput, PublicUser, RegisterInput, RegistrationDelivery } from '../facade';
import type { UserRepository } from '../ports/repositories';
import type {
  Clock, EmailVerificationMailer, IdGenerator, PasswordHasher, RecoveryTokenService,
} from '../ports/services';

const DEMO_USER_ID = 'demo-user-v1';
const DEMO_USER_EMAIL = 'demo@roman-colosseum.invalid';
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function nextUpdatedAt(previous: string, candidate: string): string {
  return candidate > previous ? candidate : new Date(Date.parse(previous) + 1).toISOString();
}

/** Convierte una entidad privada en el DTO permitido para páginas y sesión. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    birthDate: user.birthDate,
    sex: user.sex,
    profilePhotoId: user.profilePhoto?.id ?? null,
    sessionVersion: user.sessionVersion,
    createdAt: user.createdAt,
  };
}

/** Casos de uso de registro, autenticación y consulta de perfil. */
export class AuthUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly tokens: RecoveryTokenService,
    private readonly verificationMailer: EmailVerificationMailer | null,
    private readonly appOrigin: string,
  ) {}

  /** Crea una cuenta pendiente sin iniciar sesión y envía su confirmación. */
  async register(input: RegisterInput): Promise<RegistrationDelivery> {
    if (!this.verificationMailer) {
      throw new ApplicationError('EMAIL_VERIFICATION_UNAVAILABLE', 'La confirmación por correo no está configurada.');
    }
    const now = this.clock.now();
    const email = normalizeEmail(input.email);
    const name = normalizePersonName(input.name);
    const birthDate = validateBirthDate(input.birthDate, now);
    const sex = validateProfileSex(input.sex);
    validatePassword(input.password);

    if (await this.users.findByEmail(email)) {
      throw new ApplicationError('EMAIL_ALREADY_REGISTERED', 'El correo ya está registrado.');
    }

    const { token, digest } = this.tokens.issue();
    const user: User = {
      ...createPasswordUser({
      name,
      email,
      birthDate,
      sex,
      id: this.ids.next(),
      passwordHash: await this.passwords.hash(input.password),
      now,
      }),
      emailVerification: {
        tokenDigest: digest,
        expiresAt: new Date(Date.parse(now) + VERIFICATION_TTL_MS).toISOString(),
      },
    };

    if (!(await this.users.create(user))) {
      throw new ApplicationError('EMAIL_ALREADY_REGISTERED', 'El correo ya está registrado.');
    }
    const delivery = await this.sendVerificationLink(user, token);
    if (delivery === 'failed') await this.clearUndeliveredVerification(user.id, digest);
    return delivery;
  }

  /** Reenvía un enlace sin revelar si el correo existe o ya fue confirmado. */
  async requestEmailVerification(emailInput: string): Promise<void> {
    if (!this.verificationMailer) {
      throw new ApplicationError('EMAIL_VERIFICATION_UNAVAILABLE', 'La confirmación por correo no está configurada.');
    }
    const email = normalizeEmail(emailInput);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const user = await this.users.findByEmail(email);
      if (!user || user.id === DEMO_USER_ID || user.emailVerifiedAt || !findIdentity(user, 'password')) return;
      const { token, digest } = this.tokens.issue();
      const now = this.clock.now();
      const updated: User = {
        ...user,
        emailVerification: {
          tokenDigest: digest,
          expiresAt: new Date(Date.parse(now) + VERIFICATION_TTL_MS).toISOString(),
        },
        updatedAt: nextUpdatedAt(user.updatedAt, now),
      };
      if (!(await this.users.update(updated, user.updatedAt))) continue;
      if (await this.sendVerificationLink(updated, token) === 'failed') {
        await this.clearUndeliveredVerification(user.id, digest);
      }
      return;
    }
  }

  /** Confirma una cuenta una sola vez mediante actualización condicional. */
  async verifyEmail(userId: string, token: string): Promise<void> {
    const digest = this.tokens.digest(token);
    if (userId.length > 64 || !userId.trim() || !digest) {
      throw new ApplicationError('EMAIL_VERIFICATION_INVALID', 'El enlace no es válido.');
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const user = await this.users.findById(userId);
      if (!user || user.id === DEMO_USER_ID || user.emailVerifiedAt
        || !findIdentity(user, 'password')
        || user.emailVerification?.tokenDigest !== digest
        || Date.parse(user.emailVerification.expiresAt) <= Date.parse(this.clock.now())) {
        throw new ApplicationError('EMAIL_VERIFICATION_INVALID', 'El enlace venció o ya se utilizó.');
      }
      const now = this.clock.now();
      if (await this.users.update({
        ...user,
        emailVerifiedAt: now,
        emailVerification: null,
        updatedAt: nextUpdatedAt(user.updatedAt, now),
      }, user.updatedAt)) return;
    }
    throw new ApplicationError('EMAIL_VERIFICATION_INVALID', 'El enlace ya no está disponible.');
  }

  private async sendVerificationLink(user: User, token: string): Promise<RegistrationDelivery> {
    const url = new URL('/verificar-correo', this.appOrigin);
    url.searchParams.set('userId', user.id);
    url.searchParams.set('token', token);
    try {
      await this.verificationMailer!.sendVerificationLink(user.email, url.toString());
      return 'sent';
    } catch {
      console.error('No fue posible entregar un correo de confirmación.');
      return 'failed';
    }
  }

  private async clearUndeliveredVerification(userId: string, digest: string): Promise<void> {
    // La comparación de la huella evita borrar un enlace nuevo emitido en otra petición.
    try {
      const current = await this.users.findById(userId);
      if (current?.emailVerification?.tokenDigest === digest) {
        await this.users.update({
          ...current,
          emailVerification: null,
          updatedAt: nextUpdatedAt(current.updatedAt, this.clock.now()),
        }, current.updatedAt);
      }
    } catch {
      console.error('No fue posible limpiar una confirmación de correo no entregada.');
    }
  }

  /** Autentica sin distinguir públicamente entre correo y contraseña erróneos. */
  async login(input: LoginInput): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    validatePassword(input.password);
    const user = await this.users.findByEmail(email);
    const identity = user ? findIdentity(user, 'password') : undefined;
    const valid = await this.passwords.verify(input.password, identity?.credentialHash);

    if (!user || !identity?.credentialHash || !valid) {
      throw new ApplicationError('INVALID_CREDENTIALS', 'Las credenciales no son válidas.');
    }
    if (!user.emailVerifiedAt) {
      throw new ApplicationError('EMAIL_NOT_VERIFIED', 'Confirma tu correo antes de iniciar sesión.');
    }
    return toPublicUser(user);
  }

  /**
   * Garantiza un propietario estable para la vista temporal sin login.
   *
   * La identidad password recibe un secreto aleatorio que se descarta: nadie
   * puede iniciar sesión como este perfil. El ID y correo reservados también
   * permiten detectar una colisión de datos en lugar de reutilizar otra cuenta.
   */
  async getDemoUser(): Promise<PublicUser> {
    const existingById = await this.users.findById(DEMO_USER_ID);
    if (existingById) {
      if (existingById.email !== DEMO_USER_EMAIL) {
        throw new Error('El identificador reservado del modo demo pertenece a otro usuario.');
      }
      return toPublicUser(existingById);
    }

    const existingByEmail = await this.users.findByEmail(DEMO_USER_EMAIL);
    if (existingByEmail) {
      if (existingByEmail.id !== DEMO_USER_ID) {
        throw new Error('El correo reservado del modo demo pertenece a otro usuario.');
      }
      return toPublicUser(existingByEmail);
    }

    const now = this.clock.now();
    const discardedSecret = `${this.ids.next()}-${this.ids.next()}`;
    const user = createPasswordUser({
      id: DEMO_USER_ID,
      name: 'Visitante',
      email: DEMO_USER_EMAIL,
      passwordHash: await this.passwords.hash(discardedSecret),
      birthDate: '2000-01-01',
      sex: 'prefiero no decirlo',
      now,
    });

    if (await this.users.create(user)) return toPublicUser(user);

    // Otra petición pudo crear el mismo perfil mientras se calculaba el hash.
    const concurrentUser = await this.users.findById(DEMO_USER_ID);
    if (concurrentUser?.email === DEMO_USER_EMAIL) return toPublicUser(concurrentUser);
    throw new Error('No se pudo crear el perfil reservado del modo demo.');
  }

  /** Resuelve el userId guardado en sesión y elimina cualquier dato sensible. */
  async getCurrentUser(userId: string): Promise<PublicUser | null> {
    const user = await this.users.findById(userId);
    return user?.emailVerifiedAt ? toPublicUser(user) : null;
  }
}
