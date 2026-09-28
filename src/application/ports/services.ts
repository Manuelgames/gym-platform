/** Puerto para proteger y verificar contraseñas sin acoplar casos de uso a Node. */
export interface PasswordHasher {
  /** Produce una representación autocontenida con algoritmo, parámetros y salt. */
  hash(password: string): Promise<string>;
  /**
   * Compara en tiempo constante; si no existe hash ejecuta una derivación dummy
   * para que un correo inexistente no tenga un atajo temporal observable.
   */
  verify(password: string, encodedHash?: string): Promise<boolean>;
}

/** Puerto de reloj para hacer deterministas las reglas y pruebas. */
export interface Clock {
  /** Instante actual en ISO 8601 UTC. */
  now(): string;
}

/** Puerto generador de identificadores opacos. */
export interface IdGenerator {
  /** Crea un identificador único para una nueva entidad. */
  next(): string;
}

/** Credencial opaca de recuperación; el servidor solo persiste su huella. */
export interface RecoveryTokenService {
  issue(): { token: string; digest: string };
  digest(token: string): string | null;
}

/** Envío de seguridad independiente del proveedor de correo. */
export interface PasswordRecoveryMailer {
  sendResetLink(to: string, url: string): Promise<void>;
  sendPasswordChanged(to: string): Promise<void>;
}

/** Envío de enlaces de confirmación de correo, independiente del proveedor. */
export interface EmailVerificationMailer {
  sendVerificationLink(to: string, url: string): Promise<void>;
}

/** Claims mínimos y estables que puede entregar Google o Firebase verificados. */
export interface VerifiedExternalIdentity {
  provider: 'google' | 'firebase';
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Puerto reservado para verificar credenciales externas del lado servidor.
 *
 * Una implementación futura validará firma, issuer, audience, expiración y
 * nonce; nunca confiará en claims decodificados únicamente por el navegador.
 */
export interface ExternalIdentityVerifier {
  /** Proveedor concreto implementado por el adaptador. */
  readonly provider: 'google' | 'firebase';
  /** Verifica una credencial opaca y devuelve claims canónicos. */
  verifyIdToken(idToken: string): Promise<VerifiedExternalIdentity>;
}

import type { StoredMediaReference } from '../../domain/shared/media';
import type {
  AutomaticDietGenerationInput,
  GeneratedDietDraft,
} from '../../domain/diet/diet';
import type {
  AutomaticRoutineGenerationInput,
  GeneratedRoutineDraft,
} from '../../domain/routine/routine';

/** Archivo ya leído desde un formulario, todavía sin persistir. */
export interface MediaUpload {
  originalName: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** Contenido recuperado desde almacenamiento privado. */
export interface MediaContent {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
}

/** Puerto reemplazable por disco local, Cloud Storage u object storage. */
export interface MediaStorage {
  /** Persiste con una clave opaca suministrada por aplicación. */
  save(id: string, upload: MediaUpload, now: string): Promise<StoredMediaReference>;
  /** Recupera bytes únicamente a partir de una referencia ya autorizada. */
  read(reference: StoredMediaReference): Promise<MediaContent | null>;
  /** Compensa archivos guardados cuando falla la creación del perfil. */
  delete(reference: StoredMediaReference): Promise<void>;
}

/** Alias conservados para el módulo profesional mientras migra al puerto genérico. */
export type SpecialistMediaUpload = MediaUpload;
export type SpecialistMediaContent = MediaContent;
export type SpecialistMediaStorage = MediaStorage;

/** Proveedor reemplazable para generar una dieta automática estructurada. */
export interface DietGenerator {
  /** Nunca recibe nombre, correo ni otro identificador directamente identificable. */
  generate(input: AutomaticDietGenerationInput & { safetyIdentifier: string }): Promise<GeneratedDietDraft>;
}

/** Proveedor reemplazable para generar una semana de entrenamiento estructurada. */
export interface RoutineGenerator {
  /** Recibe parámetros deportivos y un identificador opaco, nunca nombre ni correo. */
  generate(input: AutomaticRoutineGenerationInput & { safetyIdentifier: string }): Promise<GeneratedRoutineDraft>;
}
