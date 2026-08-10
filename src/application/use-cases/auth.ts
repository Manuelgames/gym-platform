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
import type { LoginInput, PublicUser, RegisterInput } from '../facade';
import type { UserRepository } from '../ports/repositories';
import type { Clock, IdGenerator, PasswordHasher } from '../ports/services';

const DEMO_USER_ID = 'demo-user-v1';
const DEMO_USER_EMAIL = 'demo@roman-colosseum.invalid';

/** Convierte una entidad privada en el DTO permitido para páginas y sesión. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    birthDate: user.birthDate,
    sex: user.sex,
    profilePhotoId: user.profilePhoto?.id ?? null,
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
  ) {}

  /** Registra de forma atómica un correo y devuelve únicamente datos públicos. */
  async register(input: RegisterInput): Promise<PublicUser> {
    const now = this.clock.now();
    const email = normalizeEmail(input.email);
    const name = normalizePersonName(input.name);
    const birthDate = validateBirthDate(input.birthDate, now);
    const sex = validateProfileSex(input.sex);
    validatePassword(input.password);

    if (await this.users.findByEmail(email)) {
      throw new ApplicationError('EMAIL_ALREADY_REGISTERED', 'El correo ya está registrado.');
    }

    const user = createPasswordUser({
      name,
      email,
      birthDate,
      sex,
      id: this.ids.next(),
      passwordHash: await this.passwords.hash(input.password),
      now,
    });

    if (!(await this.users.create(user))) {
      throw new ApplicationError('EMAIL_ALREADY_REGISTERED', 'El correo ya está registrado.');
    }
    return toPublicUser(user);
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
    return user ? toPublicUser(user) : null;
  }
}
