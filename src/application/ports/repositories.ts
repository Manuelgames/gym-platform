import type { CalorieCalculation } from '../../domain/calories/calorie';
import type { DietPlan, DietPlanSource } from '../../domain/diet/diet';
import type {
  RoutineExercise,
  RoutinePlan,
  RoutinePlanSource,
} from '../../domain/routine/routine';
import type {
  SpecialistMediaReference,
  SpecialistProfile,
  SpecialistRequestStatus,
  SpecialistRole,
  SpecialistServiceRequest,
} from '../../domain/specialists/specialist';
import type { IdentityProvider, User } from '../../domain/users/user';

/** Resumen agregado que evita múltiples lecturas inconsistentes del almacén. */
export interface FitnessSummary {
  exerciseCount: number;
  hasRoutine: boolean;
  hasDiet: boolean;
  calorieCalculationCount: number;
}

/** Puerto de persistencia para perfiles e identidades. */
export interface UserRepository {
  /** Busca por identificador interno. */
  findById(id: string): Promise<User | null>;
  /** Busca por correo ya normalizado. */
  findByEmail(email: string): Promise<User | null>;
  /** Busca por la clave estable emitida por un proveedor. */
  findByIdentity(provider: IdentityProvider, subject: string): Promise<User | null>;
  /** Inserta atómicamente; devuelve false ante correo o identidad duplicados. */
  create(user: User): Promise<boolean>;
  /** Reemplaza mediante compare-and-set para no perder cambios concurrentes. */
  update(user: User, expectedUpdatedAt: string): Promise<boolean>;
}

/** Puerto de persistencia para el progreso fitness propiedad de un usuario. */
export interface FitnessRepository {
  /** Devuelve la rutina en orden estable de inserción. */
  listRoutine(userId: string): Promise<RoutineExercise[]>;
  /** Añade un ejercicio validado. */
  addRoutineExercise(exercise: RoutineExercise): Promise<void>;
  /** Elimina solo si id y propietario coinciden. */
  deleteRoutineExercise(userId: string, exerciseId: string): Promise<boolean>;
  /** Obtiene el documento semanal vigente de una modalidad. */
  getRoutinePlan(userId: string, source?: RoutinePlanSource): Promise<RoutinePlan | null>;
  /** Lista las modalidades semanales existentes del usuario. */
  listRoutinePlans(userId: string): Promise<RoutinePlan[]>;
  /** Crea o reemplaza únicamente la modalidad indicada. */
  saveRoutinePlan(plan: RoutinePlan): Promise<RoutinePlan>;
  /** Obtiene el plan vigente del usuario para un origen; IA es el valor histórico. */
  getDiet(userId: string, source?: DietPlanSource): Promise<DietPlan | null>;
  /** Lista las modalidades existentes del usuario. */
  listDiets(userId: string): Promise<DietPlan[]>;
  /** Busca por id para verificaciones internas y exportación. */
  getDietById(planId: string): Promise<DietPlan | null>;
  /** Crea o reemplaza el plan vigente de su modalidad. */
  saveDiet(plan: DietPlan): Promise<DietPlan>;
  /** Lista el historial del más reciente al más antiguo. */
  listCalorieCalculations(userId: string): Promise<CalorieCalculation[]>;
  /** Añade un cálculo y conserva como máximo `limit` registros del usuario. */
  addCalorieCalculation(calculation: CalorieCalculation, limit: number): Promise<void>;
  /** Elimina un cálculo solo cuando el id pertenece al usuario indicado. */
  deleteCalorieCalculation(userId: string, calculationId: string): Promise<boolean>;
  /** Calcula contadores sobre una sola instantánea consistente. */
  getSummary(userId: string): Promise<FitnessSummary>;
}

/** Puerto de persistencia del directorio profesional y sus solicitudes. */
export interface SpecialistRepository {
  /** Busca el único perfil profesional perteneciente a un usuario. */
  getSpecialistProfileByUserId(userId: string): Promise<SpecialistProfile | null>;
  /** Busca un perfil por el identificador usado en las solicitudes. */
  getSpecialistProfileById(profileId: string): Promise<SpecialistProfile | null>;
  /** Lista perfiles que tienen activo el rol solicitado. */
  listSpecialistProfilesByRole(role: SpecialistRole): Promise<SpecialistProfile[]>;
  /** Inserta un perfil único por usuario; false indica una colisión. */
  createSpecialistProfile(profile: SpecialistProfile): Promise<boolean>;
  /** Localiza únicamente medios referenciados por un perfil persistido. */
  findSpecialistMedia(mediaId: string): Promise<SpecialistMediaReference | null>;
  /** Lista el historial de solicitudes iniciado por un usuario. */
  listSpecialistRequestsByClient(userId: string): Promise<SpecialistServiceRequest[]>;
  /** Lista el historial dirigido a un especialista. */
  listSpecialistRequestsBySpecialist(userId: string): Promise<SpecialistServiceRequest[]>;
  /** Busca una solicitud por identificador opaco. */
  getSpecialistRequestById(requestId: string): Promise<SpecialistServiceRequest | null>;
  /**
   * Inserta solo si el solicitante no tiene otra pendiente/aceptada para el rol
   * y el perfil conserva activo ese rol dentro de la misma escritura.
   */
  createSpecialistRequest(request: SpecialistServiceRequest): Promise<boolean>;
  /** Reemplaza usando compare-and-set para no aceptar dos veces en concurrencia. */
  updateSpecialistRequest(
    request: SpecialistServiceRequest,
    expectedStatus: SpecialistRequestStatus,
  ): Promise<boolean>;
}
