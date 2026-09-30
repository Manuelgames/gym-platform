import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type {
  FitnessRepository,
  FitnessSummary,
  SpecialistRepository,
  UserRepository,
} from '../../../application/ports/repositories';
import type { CalorieCalculation } from '../../../domain/calories/calorie';
import type { DietPlan, DietPlanSource } from '../../../domain/diet/diet';
import type {
  RoutineExercise,
  RoutinePlan,
  RoutinePlanSource,
} from '../../../domain/routine/routine';
import {
  hasActiveSpecialistRole,
  OPEN_SPECIALIST_REQUEST_STATUSES,
  type SpecialistMediaReference,
  type SpecialistProfile,
  type SpecialistRequestStatus,
  type SpecialistRole,
  type SpecialistServiceRequest,
} from '../../../domain/specialists/specialist';
import type { IdentityProvider, User } from '../../../domain/users/user';
import {
  createEmptyDatabase,
  DataStoreCorruptionError,
  parsePersistedDatabase,
  type PersistedDatabase,
} from './schema';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

interface FileWriteCoordinator {
  queue: Promise<void>;
}

type GlobalFileCoordinators = typeof globalThis & {
  __romanColosseumFileCoordinators__?: Map<string, FileWriteCoordinator>;
};

function getFileCoordinator(filePath: string): FileWriteCoordinator {
  const globalContainer = globalThis as GlobalFileCoordinators;
  globalContainer.__romanColosseumFileCoordinators__ ??= new Map();
  let coordinator = globalContainer.__romanColosseumFileCoordinators__.get(filePath);
  if (!coordinator) {
    coordinator = { queue: Promise.resolve() };
    globalContainer.__romanColosseumFileCoordinators__.set(filePath, coordinator);
  }
  return coordinator;
}

/**
 * Repositorio JSON server-side con reemplazo atómico y cola de escritura.
 *
 * Cada mutación espera a la anterior, relee la última instantánea y renombra un
 * archivo temporal del mismo directorio. Esto evita escrituras parciales dentro
 * de un único proceso. Para despliegues multiproceso debe cambiarse el adaptador
 * por una base transaccional sin modificar los casos de uso.
 */
export class FileDataStore implements UserRepository, FitnessRepository, SpecialistRepository {
  private readonly filePath: string;
  private readonly coordinator: FileWriteCoordinator;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
    this.coordinator = getFileCoordinator(this.filePath);
  }

  /** Busca un usuario por su id interno. */
  async findById(id: string): Promise<User | null> {
    const database = await this.readConsistentDatabase();
    const user = database.users.find((item) => item.id === id);
    return user ? clone(user) : null;
  }

  /** Busca un usuario por correo canónico. */
  async findByEmail(email: string): Promise<User | null> {
    const database = await this.readConsistentDatabase();
    const user = database.users.find((item) => item.email === email);
    return user ? clone(user) : null;
  }

  /** Busca una identidad externa o de contraseña por proveedor y subject. */
  async findByIdentity(provider: IdentityProvider, subject: string): Promise<User | null> {
    const database = await this.readConsistentDatabase();
    const user = database.users.find((item) => item.identities.some(
      (identity) => identity.provider === provider && identity.subject === subject,
    ));
    return user ? clone(user) : null;
  }

  /** Inserta un usuario comprobando id, correo e identidades dentro de la cola. */
  create(user: User): Promise<boolean> {
    return this.mutate(async (database) => {
      const duplicated = database.users.some((existing) => (
        existing.id === user.id
        || existing.email === user.email
        || existing.identities.some((existingIdentity) => user.identities.some(
          (identity) => identity.provider === existingIdentity.provider
            && identity.subject === existingIdentity.subject,
        ))
      ));
      if (duplicated) return false;
      database.users.push(clone(user));
      return true;
    });
  }

  /** Actualiza un usuario solo si no cambió desde la lectura del caso de uso. */
  update(user: User, expectedUpdatedAt: string): Promise<boolean> {
    return this.mutate(async (database) => {
      const index = database.users.findIndex((existing) => existing.id === user.id);
      if (index < 0 || database.users[index]!.updatedAt !== expectedUpdatedAt) return false;
      const duplicated = database.users.some((existing, existingIndex) => (
        existingIndex !== index && (
          existing.email === user.email
          || existing.identities.some((existingIdentity) => user.identities.some(
            (identity) => identity.provider === existingIdentity.provider
              && identity.subject === existingIdentity.subject,
          ))
        )
      ));
      if (duplicated) return false;
      database.users[index] = clone(user);
      return true;
    });
  }

  /** Lista únicamente ejercicios del propietario solicitado. */
  async listRoutine(userId: string): Promise<RoutineExercise[]> {
    const database = await this.readConsistentDatabase();
    return clone(database.routineExercises.filter((exercise) => exercise.userId === userId));
  }

  /** Añade un ejercicio validado. */
  addRoutineExercise(exercise: RoutineExercise): Promise<void> {
    return this.mutate(async (database) => {
      if (database.routineExercises.some((item) => item.id === exercise.id)) {
        throw new Error(`Identificador de ejercicio duplicado: ${exercise.id}.`);
      }
      database.routineExercises.push(clone(exercise));
    });
  }

  /** Elimina con una condición conjunta de id y propietario. */
  deleteRoutineExercise(userId: string, exerciseId: string): Promise<boolean> {
    return this.mutate(async (database) => {
      const index = database.routineExercises.findIndex(
        (exercise) => exercise.id === exerciseId && exercise.userId === userId,
      );
      if (index < 0) return false;
      database.routineExercises.splice(index, 1);
      return true;
    });
  }

  /** Obtiene el documento semanal vigente de una modalidad. */
  async getRoutinePlan(userId: string, source: RoutinePlanSource = 'ai'): Promise<RoutinePlan | null> {
    const database = await this.readConsistentDatabase();
    const plan = database.routinePlans.find((item) => item.userId === userId && item.source === source);
    return plan ? clone(plan) : null;
  }

  /** Lista las modalidades del usuario por actualización descendente. */
  async listRoutinePlans(userId: string): Promise<RoutinePlan[]> {
    const database = await this.readConsistentDatabase();
    return clone(database.routinePlans
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }

  /** Reemplaza solo una modalidad y conserva su identidad mientras la relación no cambie. */
  saveRoutinePlan(plan: RoutinePlan): Promise<RoutinePlan> {
    return this.mutate(async (database) => {
      const index = database.routinePlans.findIndex((item) => (
        item.userId === plan.userId && item.source === plan.source
      ));
      if (index < 0) {
        if (database.routinePlans.some((item) => item.id === plan.id)) {
          throw new Error(`Identificador de rutina duplicado: ${plan.id}.`);
        }
        database.routinePlans.push(clone(plan));
        return clone(plan);
      }
      const existing = database.routinePlans[index]!;
      const changedProfessionalRelationship = plan.source === 'specialist'
        && existing.specialistRequestId !== plan.specialistRequestId;
      const replacement = changedProfessionalRelationship
        ? plan
        : { ...plan, id: existing.id, createdAt: existing.createdAt };
      database.routinePlans[index] = clone(replacement);
      return clone(replacement);
    });
  }

  /** Obtiene el plan vigente del propietario y de una modalidad concreta. */
  async getDiet(userId: string, source: DietPlanSource = 'ai'): Promise<DietPlan | null> {
    const database = await this.readConsistentDatabase();
    const plan = database.dietPlans.find((item) => item.userId === userId && item.source === source);
    return plan ? clone(plan) : null;
  }

  /** Lista las modalidades del usuario en orden de actualización descendente. */
  async listDiets(userId: string): Promise<DietPlan[]> {
    const database = await this.readConsistentDatabase();
    return clone(database.dietPlans
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }

  /** Localiza un documento por su identificador opaco. */
  async getDietById(planId: string): Promise<DietPlan | null> {
    const database = await this.readConsistentDatabase();
    const plan = database.dietPlans.find((item) => item.id === planId);
    return plan ? clone(plan) : null;
  }

  /** Reemplaza solo la modalidad indicada sin afectar otros documentos. */
  saveDiet(plan: DietPlan): Promise<DietPlan> {
    return this.mutate(async (database) => {
      const index = database.dietPlans.findIndex((item) => (
        item.userId === plan.userId && item.source === plan.source
      ));
      if (index < 0) {
        if (database.dietPlans.some((item) => item.id === plan.id)) {
          throw new Error(`Identificador de dieta duplicado: ${plan.id}.`);
        }
        database.dietPlans.push(clone(plan));
        return clone(plan);
      }
      const existing = database.dietPlans[index]!;
      const changedProfessionalRelationship = plan.source === 'specialist'
        && existing.specialistRequestId !== plan.specialistRequestId;
      const replacement = changedProfessionalRelationship
        ? plan
        : { ...plan, id: existing.id, createdAt: existing.createdAt };
      database.dietPlans[index] = clone(replacement);
      return clone(replacement);
    });
  }

  /** Lista cálculos en orden cronológico descendente. */
  async listCalorieCalculations(userId: string): Promise<CalorieCalculation[]> {
    const database = await this.readConsistentDatabase();
    return clone(database.calorieCalculations
      .filter((calculation) => calculation.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  /** Añade un cálculo y recorta solo el historial de su propietario. */
  addCalorieCalculation(calculation: CalorieCalculation, limit: number): Promise<void> {
    return this.mutate(async (database) => {
      if (database.calorieCalculations.some((item) => item.id === calculation.id)) {
        throw new Error(`Identificador de cálculo duplicado: ${calculation.id}.`);
      }
      database.calorieCalculations.push(clone(calculation));
      const retainedIds = new Set(database.calorieCalculations
        .filter((item) => item.userId === calculation.userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit)
        .map((item) => item.id));
      database.calorieCalculations = database.calorieCalculations.filter(
        (item) => item.userId !== calculation.userId || retainedIds.has(item.id),
      );
    });
  }

  /** Elimina por id y propietario y desprende las dietas que usaban ese cálculo. */
  deleteCalorieCalculation(userId: string, calculationId: string): Promise<boolean> {
    return this.mutate(async (database) => {
      const index = database.calorieCalculations.findIndex(
        (calculation) => calculation.id === calculationId && calculation.userId === userId,
      );
      if (index < 0) return false;
      database.calorieCalculations.splice(index, 1);
      database.dietPlans = database.dietPlans.map((plan) => (
        plan.userId === userId && plan.calorieCalculationId === calculationId
          ? { ...plan, calorieCalculationId: null }
          : plan
      ));
      return true;
    });
  }

  /** Obtiene métricas desde una sola lectura del documento. */
  async getSummary(userId: string): Promise<FitnessSummary> {
    const database = await this.readConsistentDatabase();
    const latestRoutine = database.routinePlans
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    return {
      exerciseCount: latestRoutine
        ? latestRoutine.days.reduce((total, day) => total + day.exercises.length, 0)
        : database.routineExercises.filter((item) => item.userId === userId).length,
      hasRoutine: database.routinePlans.some((item) => item.userId === userId),
      hasDiet: database.dietPlans.some((item) => item.userId === userId),
      calorieCalculationCount: database.calorieCalculations.filter((item) => item.userId === userId).length,
    };
  }

  /** Obtiene el perfil profesional único del propietario. */
  async getSpecialistProfileByUserId(userId: string): Promise<SpecialistProfile | null> {
    const database = await this.readConsistentDatabase();
    const profile = database.specialistProfiles.find((item) => item.userId === userId);
    return profile ? clone(profile) : null;
  }

  /** Obtiene un perfil profesional por identificador opaco. */
  async getSpecialistProfileById(profileId: string): Promise<SpecialistProfile | null> {
    const database = await this.readConsistentDatabase();
    const profile = database.specialistProfiles.find((item) => item.id === profileId);
    return profile ? clone(profile) : null;
  }

  /** Lista perfiles que mantienen activo un rol y conserva orden de alta. */
  async listSpecialistProfilesByRole(role: SpecialistRole): Promise<SpecialistProfile[]> {
    const database = await this.readConsistentDatabase();
    return clone(database.specialistProfiles.filter((profile) => hasActiveSpecialistRole(profile, role)));
  }

  /** Inserta un único perfil por id y usuario dentro de la cola compartida. */
  createSpecialistProfile(profile: SpecialistProfile): Promise<boolean> {
    return this.mutate(async (database) => {
      if (database.specialistProfiles.some((item) => (
        item.id === profile.id || item.userId === profile.userId
      ))) return false;
      database.specialistProfiles.push(clone(profile));
      return true;
    });
  }

  /** Busca una referencia de foto o certificado sin aceptar rutas del cliente. */
  async findSpecialistMedia(mediaId: string): Promise<SpecialistMediaReference | null> {
    const database = await this.readConsistentDatabase();
    for (const profile of database.specialistProfiles) {
      const reference = [profile.photo, ...profile.certificates].find((item) => item.id === mediaId);
      if (reference) return clone(reference);
    }
    return null;
  }

  /** Lista solicitudes de un cliente, de la más reciente a la más antigua. */
  async listSpecialistRequestsByClient(userId: string): Promise<SpecialistServiceRequest[]> {
    const database = await this.readConsistentDatabase();
    return clone(database.specialistRequests
      .filter((request) => request.clientUserId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  /** Lista solicitudes recibidas por un especialista. */
  async listSpecialistRequestsBySpecialist(userId: string): Promise<SpecialistServiceRequest[]> {
    const database = await this.readConsistentDatabase();
    return clone(database.specialistRequests
      .filter((request) => request.specialistUserId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  /** Busca una solicitud por su identificador. */
  async getSpecialistRequestById(requestId: string): Promise<SpecialistServiceRequest | null> {
    const database = await this.readConsistentDatabase();
    const request = database.specialistRequests.find((item) => item.id === requestId);
    return request ? clone(request) : null;
  }

  /** Reserva atómicamente el único cupo pendiente/aceptado para un rol. */
  createSpecialistRequest(request: SpecialistServiceRequest): Promise<boolean> {
    return this.mutate(async (database) => {
      const profile = database.specialistProfiles.find((item) => item.id === request.specialistProfileId);
      const duplicatedId = database.specialistRequests.some((item) => item.id === request.id);
      const occupiedRole = database.specialistRequests.some((item) => (
        item.clientUserId === request.clientUserId
        && item.role === request.role
        && OPEN_SPECIALIST_REQUEST_STATUSES.includes(item.status)
      ));
      if (
        duplicatedId
        || occupiedRole
        || profile?.userId !== request.specialistUserId
        || !hasActiveSpecialistRole(profile, request.role)
      ) return false;
      database.specialistRequests.push(clone(request));
      return true;
    });
  }

  /** Actualiza solo cuando el estado leído por el caso de uso sigue vigente. */
  updateSpecialistRequest(
    request: SpecialistServiceRequest,
    expectedStatus: SpecialistRequestStatus,
  ): Promise<boolean> {
    return this.mutate(async (database) => {
      const index = database.specialistRequests.findIndex((item) => item.id === request.id);
      if (index < 0 || database.specialistRequests[index]!.status !== expectedStatus) return false;
      database.specialistRequests[index] = clone(request);
      return true;
    });
  }

  private async readConsistentDatabase(): Promise<PersistedDatabase> {
    await this.coordinator.queue;
    return this.readDatabaseFromDisk();
  }

  private async readDatabaseFromDisk(): Promise<PersistedDatabase> {
    let source: string;
    try {
      source = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return createEmptyDatabase();
      throw error;
    }

    try {
      return parsePersistedDatabase(JSON.parse(source) as unknown);
    } catch (error) {
      if (error instanceof DataStoreCorruptionError) throw error;
      throw new DataStoreCorruptionError('No se pudo interpretar el archivo JSON de datos.', error);
    }
  }

  private mutate<T>(operation: (database: PersistedDatabase) => Promise<T> | T): Promise<T> {
    const task = this.coordinator.queue.then(async () => {
      const database = await this.readDatabaseFromDisk();
      const result = await operation(database);
      const validatedDatabase = parsePersistedDatabase(database);
      await this.writeDatabaseAtomically(validatedDatabase);
      return result;
    });

    this.coordinator.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async writeDatabaseAtomically(database: PersistedDatabase): Promise<void> {
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = join(
      directory,
      `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );
    let handle: Awaited<ReturnType<typeof open>> | undefined;

    try {
      handle = await open(temporaryPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(database, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryPath, this.filePath);
    } finally {
      if (handle) await handle.close().catch(() => undefined);
      await unlink(temporaryPath).catch((error: unknown) => {
        if (!isMissingFile(error)) throw error;
      });
    }
  }
}
