import {
  createSpecialistProfile,
  createSpecialistRequest,
  hasActiveSpecialistRole,
  OPEN_SPECIALIST_REQUEST_STATUSES,
  SPECIALIST_UPLOAD_LIMITS,
  transitionSpecialistRequest,
  validateSpecialistRole,
  type SpecialistMediaReference,
  type SpecialistProfile,
  type SpecialistRequestAction,
  type SpecialistRole,
  type SpecialistServiceRequest,
} from '../../domain/specialists/specialist';
import type { User } from '../../domain/users/user';
import { DomainValidationError } from '../../domain/shared/errors';
import { ApplicationError } from '../errors';
import type {
  ActiveSpecialistRequestView,
  MyWorkView,
  RegisterSpecialistInput,
  SpecialistProfileView,
  SpecialistsPageView,
  SpecialistWorkRoleView,
  WorkClientView,
} from '../facade';
import type { SpecialistRepository, UserRepository } from '../ports/repositories';
import type {
  Clock,
  IdGenerator,
  SpecialistMediaContent,
  SpecialistMediaStorage,
  SpecialistMediaUpload,
} from '../ports/services';

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function isWebp(bytes: Uint8Array): boolean {
  return bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function assertUpload(
  upload: SpecialistMediaUpload,
  kind: 'photo' | 'certificate',
): void {
  const field = kind === 'photo' ? 'photo' : 'certificates';
  const maximum = kind === 'photo'
    ? SPECIALIST_UPLOAD_LIMITS.photoBytes
    : SPECIALIST_UPLOAD_LIMITS.certificateBytes;
  if (!upload.originalName.trim() || upload.originalName.length > 180 || /[\r\n\0]/.test(upload.originalName)) {
    throw new DomainValidationError(field, 'El nombre del archivo no es válido.');
  }
  if (upload.bytes.byteLength < 5 || upload.bytes.byteLength > maximum) {
    throw new DomainValidationError(field, `El archivo debe pesar entre 1 byte y ${maximum / 1024 / 1024} MB.`);
  }

  if (kind === 'certificate') {
    if (
      upload.mimeType !== 'application/pdf'
      || !bytesStartWith(upload.bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
    ) {
      throw new DomainValidationError(field, 'Cada certificado debe ser un PDF válido.');
    }
    return;
  }

  const validSignature = upload.mimeType === 'image/jpeg'
    ? bytesStartWith(upload.bytes, [0xff, 0xd8, 0xff])
    : upload.mimeType === 'image/png'
      ? bytesStartWith(upload.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : upload.mimeType === 'image/webp' && isWebp(upload.bytes);
  if (!validSignature) {
    throw new DomainValidationError(field, 'La fotografía debe ser un JPEG, PNG o WebP válido.');
  }
}

/** Orquesta directorio, perfiles profesionales, archivos y solicitudes. */
export class SpecialistUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly specialists: SpecialistRepository,
    private readonly media: SpecialistMediaStorage,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new ApplicationError('USER_NOT_FOUND', 'No existe el usuario solicitado.');
    return user;
  }

  private async profileView(profile: SpecialistProfile): Promise<SpecialistProfileView> {
    const user = await this.requireUser(profile.userId);
    return {
      id: profile.id,
      userId: profile.userId,
      name: user.name,
      profilePhotoId: user.profilePhoto?.id ?? null,
      presentation: profile.presentation,
      experience: profile.experience,
      roles: profile.roles
        .filter((assignment) => assignment.status === 'active')
        .map((assignment) => assignment.role),
      photo: structuredClone(profile.photo),
      certificates: structuredClone(profile.certificates),
    };
  }

  /** Construye ambos directorios y las selecciones abiertas del usuario. */
  async getPage(userId: string): Promise<SpecialistsPageView> {
    await this.requireUser(userId);
    const [trainerProfiles, nutritionProfiles, ownProfile, requests] = await Promise.all([
      this.specialists.listSpecialistProfilesByRole('trainer'),
      this.specialists.listSpecialistProfilesByRole('nutritionist'),
      this.specialists.getSpecialistProfileByUserId(userId),
      this.specialists.listSpecialistRequestsByClient(userId),
    ]);
    const activeRequests: Partial<Record<SpecialistRole, ActiveSpecialistRequestView>> = {};
    for (const request of requests.filter((item) => OPEN_SPECIALIST_REQUEST_STATUSES.includes(item.status))) {
      const specialist = await this.requireUser(request.specialistUserId);
      activeRequests[request.role] = {
        id: request.id,
        specialistProfileId: request.specialistProfileId,
        specialistName: specialist.name,
        role: request.role,
        status: request.status as 'pending' | 'accepted',
      };
    }
    return {
      trainers: await Promise.all(trainerProfiles.map((profile) => this.profileView(profile))),
      nutritionists: await Promise.all(nutritionProfiles.map((profile) => this.profileView(profile))),
      myProfile: ownProfile ? await this.profileView(ownProfile) : null,
      activeRequests,
    };
  }

  /** Guarda medios privados y crea un perfil profesional único por usuario. */
  async register(userId: string, input: RegisterSpecialistInput): Promise<SpecialistProfileView> {
    await this.requireUser(userId);
    if (await this.specialists.getSpecialistProfileByUserId(userId)) {
      throw new ApplicationError('SPECIALIST_PROFILE_ALREADY_EXISTS', 'El usuario ya tiene perfil profesional.');
    }
    if (input.certificates.length > SPECIALIST_UPLOAD_LIMITS.certificateCount) {
      throw new DomainValidationError('certificates', 'Solo se permiten hasta tres certificados.');
    }
    assertUpload(input.photo, 'photo');
    for (const certificate of input.certificates) assertUpload(certificate, 'certificate');

    const now = this.clock.now();
    const saved: SpecialistMediaReference[] = [];
    try {
      const photo = await this.media.save(this.ids.next(), input.photo, now);
      saved.push(photo);
      const certificates: SpecialistMediaReference[] = [];
      for (const upload of input.certificates) {
        const reference = await this.media.save(this.ids.next(), upload, now);
        saved.push(reference);
        certificates.push(reference);
      }
      const profile = createSpecialistProfile({
        id: this.ids.next(),
        userId,
        presentation: input.presentation,
        experience: input.experience,
        roles: input.roles,
        photo,
        certificates,
        now,
      });
      if (!(await this.specialists.createSpecialistProfile(profile))) {
        throw new ApplicationError('SPECIALIST_PROFILE_ALREADY_EXISTS', 'El usuario ya tiene perfil profesional.');
      }
      return this.profileView(profile);
    } catch (error) {
      await Promise.all(saved.map((reference) => this.media.delete(reference).catch(() => undefined)));
      throw error;
    }
  }

  /** Crea una solicitud si el cupo del rol está libre y el perfil sigue activo. */
  async request(userId: string, specialistProfileId: string, rawRole: string): Promise<void> {
    await this.requireUser(userId);
    const role = validateSpecialistRole(rawRole);
    const profile = await this.specialists.getSpecialistProfileById(specialistProfileId.trim());
    if (!profile) throw new ApplicationError('SPECIALIST_PROFILE_NOT_FOUND', 'No existe el perfil profesional.');
    if (profile.userId === userId) {
      throw new ApplicationError('SPECIALIST_SELF_REQUEST', 'No puedes solicitarte a ti mismo.');
    }
    if (!hasActiveSpecialistRole(profile, role)) {
      throw new ApplicationError('SPECIALIST_ROLE_UNAVAILABLE', 'Ese rol ya no está disponible.');
    }
    const request = createSpecialistRequest({
      id: this.ids.next(),
      clientUserId: userId,
      specialistUserId: profile.userId,
      specialistProfileId: profile.id,
      role,
      now: this.clock.now(),
    });
    if (!(await this.specialists.createSpecialistRequest(request))) {
      throw new ApplicationError('SPECIALIST_REQUEST_CONFLICT', 'Ya existe una solicitud abierta para ese rol.');
    }
  }

  /** Acepta, rechaza, cancela o cierra usando compare-and-set persistente. */
  async act(userId: string, requestId: string, action: SpecialistRequestAction): Promise<void> {
    await this.requireUser(userId);
    const current = await this.specialists.getSpecialistRequestById(requestId.trim());
    if (!current) throw new ApplicationError('SPECIALIST_REQUEST_NOT_FOUND', 'No existe la solicitud.');
    const updated = transitionSpecialistRequest(current, action, userId, this.clock.now());
    if (!(await this.specialists.updateSpecialistRequest(updated, current.status))) {
      throw new ApplicationError('SPECIALIST_REQUEST_CONFLICT', 'La solicitud cambió mientras se procesaba.');
    }
  }

  private async clientView(request: SpecialistServiceRequest): Promise<WorkClientView> {
    const client = await this.requireUser(request.clientUserId);
    return {
      requestId: request.id,
      userId: client.id,
      name: client.name,
      email: client.email,
      profilePhotoId: client.profilePhoto?.id ?? null,
      requestedAt: request.createdAt,
    };
  }

  /** Devuelve uno o dos tableros según los roles activos del propietario. */
  async getMyWork(userId: string): Promise<MyWorkView | null> {
    const profile = await this.specialists.getSpecialistProfileByUserId(userId);
    if (!profile) return null;
    const requests = await this.specialists.listSpecialistRequestsBySpecialist(userId);
    const activeRoles = profile.roles.filter((assignment) => assignment.status === 'active');
    const roles: SpecialistWorkRoleView[] = [];
    for (const assignment of activeRoles) {
      const applicants = requests.filter((request) => (
        request.role === assignment.role && request.status === 'pending'
      ));
      const advised = requests.filter((request) => (
        request.role === assignment.role && request.status === 'accepted'
      ));
      roles.push({
        role: assignment.role,
        applicants: await Promise.all(applicants.map((request) => this.clientView(request))),
        advised: await Promise.all(advised.map((request) => this.clientView(request))),
      });
    }
    return { profile: await this.profileView(profile), roles };
  }

  /** Resumen ligero usado para generar la navegación Mi trabajo. */
  async getMyRoles(userId: string): Promise<SpecialistRole[]> {
    const profile = await this.specialists.getSpecialistProfileByUserId(userId);
    return profile?.roles
      .filter((assignment) => assignment.status === 'active')
      .map((assignment) => assignment.role) ?? [];
  }

  /** Autoriza el medio por referencia persistida antes de tocar almacenamiento. */
  async getMedia(userId: string, mediaId: string): Promise<SpecialistMediaContent | null> {
    await this.requireUser(userId);
    const reference = await this.specialists.findSpecialistMedia(mediaId.trim());
    return reference ? this.media.read(reference) : null;
  }
}
