import { assertDomain } from '../shared/errors';
import type { StoredMediaReference } from '../shared/media';

/** Especialidades que un perfil profesional puede ejercer simultáneamente. */
export const SPECIALIST_ROLES = ['trainer', 'nutritionist'] as const;

/** Rol profesional estable; no depende del texto mostrado por la interfaz. */
export type SpecialistRole = (typeof SPECIALIST_ROLES)[number];

/** Estado independiente de cada rol para permitir desactivarlo en el futuro. */
export const SPECIALIST_ROLE_STATUSES = ['active', 'inactive'] as const;

/** Vigencia de un rol declarado por el especialista. */
export type SpecialistRoleStatus = (typeof SPECIALIST_ROLE_STATUSES)[number];

/** Estados históricos de una solicitud de orientación. */
export const SPECIALIST_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'closed',
] as const;

/** Estado de una solicitud entre un usuario y un especialista. */
export type SpecialistRequestStatus = (typeof SPECIALIST_REQUEST_STATUSES)[number];

/** Estados que ocupan el único cupo permitido por usuario y especialidad. */
export const OPEN_SPECIALIST_REQUEST_STATUSES: readonly SpecialistRequestStatus[] = [
  'pending',
  'accepted',
];

/** Límites conservadores mientras los archivos se reciben en memoria. */
export const SPECIALIST_UPLOAD_LIMITS = Object.freeze({
  photoBytes: 4 * 1024 * 1024,
  certificateBytes: 4 * 1024 * 1024,
  certificateCount: 3,
  totalFormBytes: 17 * 1024 * 1024,
});

/** Alias de compatibilidad para los medios asociados a perfiles profesionales. */
export type SpecialistMediaReference = StoredMediaReference;

/** Rol solicitado y su vigencia, separado del identificador del perfil. */
export interface SpecialistRoleAssignment {
  role: SpecialistRole;
  status: SpecialistRoleStatus;
  updatedAt: string;
}

/** Perfil profesional único por usuario. */
export interface SpecialistProfile {
  id: string;
  userId: string;
  presentation: string;
  experience: string;
  photo: SpecialistMediaReference;
  certificates: SpecialistMediaReference[];
  roles: SpecialistRoleAssignment[];
  createdAt: string;
  updatedAt: string;
}

/** Solicitud de una sola especialidad dirigida a un perfil concreto. */
export interface SpecialistServiceRequest {
  id: string;
  clientUserId: string;
  specialistUserId: string;
  specialistProfileId: string;
  role: SpecialistRole;
  status: SpecialistRequestStatus;
  createdAt: string;
  updatedAt: string;
}

/** Datos validados por infraestructura antes de crear el perfil. */
export interface CreateSpecialistProfileInput {
  id: string;
  userId: string;
  presentation: string;
  experience: string;
  roles: readonly string[];
  photo: SpecialistMediaReference;
  certificates: readonly SpecialistMediaReference[];
  now: string;
}

/** Datos necesarios para abrir una solicitud profesional. */
export interface CreateSpecialistRequestInput {
  id: string;
  clientUserId: string;
  specialistUserId: string;
  specialistProfileId: string;
  role: string;
  now: string;
}

/** Acciones explícitas; cada una tiene un actor y transición autorizados. */
export const SPECIALIST_REQUEST_ACTIONS = ['accept', 'reject', 'cancel', 'close'] as const;

/** Acción válida sobre una solicitud abierta. */
export type SpecialistRequestAction = (typeof SPECIALIST_REQUEST_ACTIONS)[number];

/** Valida un rol recibido desde formulario o persistencia externa. */
export function validateSpecialistRole(value: string): SpecialistRole {
  assertDomain(
    SPECIALIST_ROLES.includes(value as SpecialistRole),
    'role',
    'Selecciona una especialidad válida.',
  );
  return value as SpecialistRole;
}

function normalizeLongText(
  value: string,
  field: string,
  minimum: number,
  maximum: number,
): string {
  const normalized = value.trim().replace(/\r\n/g, '\n');
  assertDomain(
    normalized.length >= minimum && normalized.length <= maximum,
    field,
    `El texto debe tener entre ${minimum} y ${maximum} caracteres.`,
  );
  return normalized;
}

function assertMedia(reference: SpecialistMediaReference, field: string): void {
  assertDomain(reference.id.trim().length > 0, field, 'El archivo no tiene identificador.');
  assertDomain(reference.storageKey.trim().length > 0, field, 'El archivo no tiene ubicación.');
  assertDomain(reference.originalName.trim().length > 0, field, 'El archivo no tiene nombre.');
  assertDomain(reference.sizeBytes > 0, field, 'El archivo está vacío.');
  assertDomain(reference.createdAt.trim().length > 0, field, 'El archivo no tiene fecha.');
}

/** Crea un perfil con uno o dos roles activos y referencias de medios válidas. */
export function createSpecialistProfile(input: CreateSpecialistProfileInput): SpecialistProfile {
  assertDomain(input.id.trim().length > 0, 'profile', 'El perfil necesita identificador.');
  assertDomain(input.userId.trim().length > 0, 'profile', 'El perfil necesita propietario.');
  const presentation = normalizeLongText(input.presentation, 'presentation', 40, 800);
  const experience = normalizeLongText(input.experience, 'experience', 20, 2_000);
  const selectedRoles = [...new Set(input.roles.map(validateSpecialistRole))];
  assertDomain(selectedRoles.length > 0, 'roles', 'Selecciona al menos una especialidad.');
  assertDomain(selectedRoles.length <= SPECIALIST_ROLES.length, 'roles', 'Hay roles duplicados.');
  assertMedia(input.photo, 'photo');
  assertDomain(
    input.photo.mimeType === 'image/jpeg'
      || input.photo.mimeType === 'image/png'
      || input.photo.mimeType === 'image/webp',
    'photo',
    'La fotografía debe ser JPEG, PNG o WebP.',
  );
  assertDomain(
    input.photo.sizeBytes <= SPECIALIST_UPLOAD_LIMITS.photoBytes,
    'photo',
    'La fotografía supera 4 MB.',
  );
  assertDomain(
    input.certificates.length <= SPECIALIST_UPLOAD_LIMITS.certificateCount,
    'certificates',
    'Solo se permiten hasta tres certificados.',
  );
  for (const certificate of input.certificates) {
    assertMedia(certificate, 'certificates');
    assertDomain(certificate.mimeType === 'application/pdf', 'certificates', 'Los certificados deben ser PDF.');
    assertDomain(
      certificate.sizeBytes <= SPECIALIST_UPLOAD_LIMITS.certificateBytes,
      'certificates',
      'Cada certificado debe pesar como máximo 4 MB.',
    );
  }

  return {
    id: input.id,
    userId: input.userId,
    presentation,
    experience,
    photo: structuredClone(input.photo),
    certificates: structuredClone([...input.certificates]),
    roles: selectedRoles.map((role) => ({ role, status: 'active', updatedAt: input.now })),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** Indica si un perfil puede recibir solicitudes para un rol concreto. */
export function hasActiveSpecialistRole(
  profile: SpecialistProfile,
  role: SpecialistRole,
): boolean {
  return profile.roles.some((assignment) => (
    assignment.role === role && assignment.status === 'active'
  ));
}

/** Abre una solicitud pendiente sin codificar la especialidad dentro de su ID. */
export function createSpecialistRequest(
  input: CreateSpecialistRequestInput,
): SpecialistServiceRequest {
  const role = validateSpecialistRole(input.role);
  assertDomain(input.id.trim().length > 0, 'request', 'La solicitud necesita identificador.');
  assertDomain(input.clientUserId.trim().length > 0, 'request', 'La solicitud necesita solicitante.');
  assertDomain(input.specialistUserId.trim().length > 0, 'request', 'La solicitud necesita especialista.');
  assertDomain(input.specialistProfileId.trim().length > 0, 'request', 'La solicitud necesita perfil.');
  assertDomain(
    input.clientUserId !== input.specialistUserId,
    'specialist',
    'No puedes solicitarte orientación a ti mismo.',
  );
  return {
    id: input.id,
    clientUserId: input.clientUserId,
    specialistUserId: input.specialistUserId,
    specialistProfileId: input.specialistProfileId,
    role,
    status: 'pending',
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * Aplica una transición con autorización por actor.
 *
 * El especialista acepta/rechaza pendientes y cierra asesorías aceptadas; el
 * solicitante puede cancelar mientras la relación siga abierta.
 */
export function transitionSpecialistRequest(
  request: SpecialistServiceRequest,
  action: SpecialistRequestAction,
  actorUserId: string,
  now: string,
): SpecialistServiceRequest {
  let nextStatus: SpecialistRequestStatus;
  if (action === 'accept' || action === 'reject') {
    assertDomain(actorUserId === request.specialistUserId, 'request', 'Solo el especialista puede responder.');
    assertDomain(request.status === 'pending', 'request', 'La solicitud ya fue respondida.');
    nextStatus = action === 'accept' ? 'accepted' : 'rejected';
  } else if (action === 'cancel') {
    assertDomain(actorUserId === request.clientUserId, 'request', 'Solo el solicitante puede cancelar.');
    assertDomain(
      OPEN_SPECIALIST_REQUEST_STATUSES.includes(request.status),
      'request',
      'La solicitud ya está cerrada.',
    );
    nextStatus = 'cancelled';
  } else {
    assertDomain(actorUserId === request.specialistUserId, 'request', 'Solo el especialista puede cerrar la asesoría.');
    assertDomain(request.status === 'accepted', 'request', 'La asesoría todavía no está activa.');
    nextStatus = 'closed';
  }
  return { ...request, status: nextStatus, updatedAt: now };
}
