import { assertDomain } from '../shared/errors';
import type { StoredMediaReference } from '../shared/media';

/** Límites del formulario de fotografía personal. */
export const USER_PROFILE_PHOTO_LIMITS = Object.freeze({
  photoBytes: 4 * 1024 * 1024,
  totalFormBytes: 5 * 1024 * 1024,
});

/** Proveedores que el modelo de identidad puede representar sin cambiar usuarios. */
export const IDENTITY_PROVIDERS = ['password', 'google', 'firebase'] as const;

/** Proveedor que acredita la identidad de una persona. */
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

/** Valores de identidad personal admitidos por el formulario actual. */
export const PROFILE_SEX_VALUES = [
  'mujer',
  'hombre',
  'prefiero no decirlo',
] as const;

/** Identidad personal declarada en el perfil. */
export type ProfileSex = (typeof PROFILE_SEX_VALUES)[number];

/** Campos compartidos por todas las identidades verificadas. */
interface BaseUserIdentity {
  subject: string;
  createdAt: string;
}

/** Identidad local cuya única credencial persistente es un hash. */
export interface PasswordUserIdentity extends BaseUserIdentity {
  provider: 'password';
  credentialHash: string;
}

/** Identidad de Google; nunca persiste ID/access/refresh tokens. */
export interface GoogleUserIdentity extends BaseUserIdentity {
  provider: 'google';
}

/** Identidad de Firebase; nunca persiste ID/access/refresh tokens. */
export interface FirebaseUserIdentity extends BaseUserIdentity {
  provider: 'firebase';
}

/**
 * Vínculo discriminado entre usuario y proveedor autenticable.
 *
 * `subject` es la clave estable del proveedor: correo canónico para password y
 * `sub`/`uid` para Google/Firebase, nunca un access token.
 */
export type UserIdentity = PasswordUserIdentity | GoogleUserIdentity | FirebaseUserIdentity;

/** Solo se conserva la huella del enlace, nunca la credencial enviada por correo. */
export interface PasswordResetRequest {
  tokenDigest: string;
  expiresAt: string;
}

/** Confirmación pendiente de propiedad del correo; nunca guarda el token original. */
export interface EmailVerificationRequest {
  tokenDigest: string;
  expiresAt: string;
}

/** Usuario persistente de Roman Colosseum. */
export interface User {
  id: string;
  name: string;
  email: string;
  birthDate: string;
  sex: ProfileSex;
  profilePhoto: StoredMediaReference | null;
  identities: UserIdentity[];
  passwordReset: PasswordResetRequest | null;
  emailVerification: EmailVerificationRequest | null;
  emailVerifiedAt: string | null;
  sessionVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** Datos necesarios para crear un usuario autenticado por contraseña. */
export interface CreatePasswordUserInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  birthDate: string;
  sex: string;
  now: string;
}

/** Normaliza un correo para búsquedas y restricciones de unicidad. */
export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  assertDomain(email.length > 0 && email.length <= 254, 'email', 'El correo no es válido.');
  assertDomain(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    'email',
    'El correo no es válido.',
  );
  return email;
}

/** Normaliza y valida el nombre visible de un perfil. */
export function normalizePersonName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  assertDomain(name.length >= 2 && name.length <= 80, 'name', 'El nombre debe tener entre 2 y 80 caracteres.');
  return name;
}

/**
 * Valida una contraseña antes de enviarla al servicio de hash.
 *
 * El máximo limita trabajo y memoria innecesarios en scrypt. No se exigen
 * patrones artificiales; la longitud mínima aporta una regla comprensible.
 */
export function validatePassword(value: string): string {
  assertDomain(value.length >= 8, 'password', 'La contraseña debe tener al menos 8 caracteres.');
  assertDomain(value.length <= 128, 'password', 'La contraseña no puede superar 128 caracteres.');
  return value;
}

/** Valida una fecha civil ISO y evita fechas de nacimiento futuras. */
export function validateBirthDate(value: string, now: string): string {
  const birthDate = value.trim();
  assertDomain(/^\d{4}-\d{2}-\d{2}$/.test(birthDate), 'birthDate', 'La fecha de nacimiento no es válida.');

  const dateParts = birthDate.split('-').map(Number);
  const year = dateParts[0]!;
  const month = dateParts[1]!;
  const day = dateParts[2]!;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
  assertDomain(isRealDate, 'birthDate', 'La fecha de nacimiento no es válida.');
  assertDomain(birthDate <= now.slice(0, 10), 'birthDate', 'La fecha de nacimiento no puede estar en el futuro.');
  return birthDate;
}

/** Valida la identidad personal declarada por el usuario. */
export function validateProfileSex(value: string): ProfileSex {
  assertDomain(
    PROFILE_SEX_VALUES.includes(value as ProfileSex),
    'sex',
    'Selecciona una identidad válida.',
  );
  return value as ProfileSex;
}

/** Crea un usuario de contraseña después de aplicar todas las reglas puras. */
export function createPasswordUser(input: CreatePasswordUserInput): User {
  const name = normalizePersonName(input.name);
  const email = normalizeEmail(input.email);
  const birthDate = validateBirthDate(input.birthDate, input.now);
  const sex = validateProfileSex(input.sex);
  assertDomain(input.id.trim().length > 0, 'id', 'El identificador de usuario es obligatorio.');
  assertDomain(input.passwordHash.trim().length > 0, 'passwordHash', 'La credencial protegida es obligatoria.');

  return {
    id: input.id,
    name,
    email,
    birthDate,
    sex,
    profilePhoto: null,
    passwordReset: null,
    emailVerification: null,
    emailVerifiedAt: null,
    sessionVersion: 0,
    identities: [{
      provider: 'password',
      subject: email,
      credentialHash: input.passwordHash,
      createdAt: input.now,
    }],
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** Obtiene la identidad de un proveedor sin revelar otras credenciales. */
export function findIdentity<P extends IdentityProvider>(
  user: User,
  provider: P,
): Extract<UserIdentity, { provider: P }> | undefined {
  return user.identities.find(
    (identity) => identity.provider === provider,
  ) as Extract<UserIdentity, { provider: P }> | undefined;
}
