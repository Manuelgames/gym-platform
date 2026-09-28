import {
  ACTIVITY_FACTORS,
  CALORIE_FORMULA_VERSION,
  CALORIE_SEX_VALUES,
  type CalorieCalculation,
} from '../../../domain/calories/calorie';
import {
  createDietPlan,
  DIET_GENERATION_ENGINES,
  DIET_GOALS,
  DIET_PLAN_SOURCES,
  DIET_PORTION_UNITS,
  DIET_PREFERENCES,
  type DietPlan,
} from '../../../domain/diet/diet';
import {
  createRoutinePlan,
  MUSCLE_GROUPS,
  ROUTINE_GENERATION_ENGINES,
  ROUTINE_GOALS,
  ROUTINE_LEVELS,
  ROUTINE_LOCATIONS,
  ROUTINE_PLAN_DAYS,
  ROUTINE_PLAN_SOURCES,
  ROUTINE_PRESCRIPTION_TYPES,
  WEEK_DAYS,
  requiresDurationPrescription,
  type RoutineExercise,
  type RoutinePlan,
} from '../../../domain/routine/routine';
import {
  OPEN_SPECIALIST_REQUEST_STATUSES,
  SPECIALIST_REQUEST_STATUSES,
  SPECIALIST_ROLES,
  SPECIALIST_ROLE_STATUSES,
  SPECIALIST_UPLOAD_LIMITS,
  type SpecialistProfile,
  type SpecialistServiceRequest,
} from '../../../domain/specialists/specialist';
import {
  PROFILE_IMAGE_MIME_TYPES,
  type StoredMediaReference,
} from '../../../domain/shared/media';
import {
  IDENTITY_PROVIDERS,
  PROFILE_SEX_VALUES,
  USER_PROFILE_PHOTO_LIMITS,
  type User,
} from '../../../domain/users/user';

/** Versión vigente; las versiones anteriores se migran en memoria al leer. */
export const DATA_SCHEMA_VERSION = 9 as const;

/** Documento completo que se reemplaza como una unidad atómica. */
export interface PersistedDatabase {
  schemaVersion: typeof DATA_SCHEMA_VERSION;
  users: User[];
  routineExercises: RoutineExercise[];
  routinePlans: RoutinePlan[];
  dietPlans: DietPlan[];
  calorieCalculations: CalorieCalculation[];
  specialistProfiles: SpecialistProfile[];
  specialistRequests: SpecialistServiceRequest[];
}

/** Error explícito: una base corrupta nunca se sustituye silenciosamente. */
export class DataStoreCorruptionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'DataStoreCorruptionError';
  }
}

/** Crea una base vacía con todas las colecciones y versión declaradas. */
export function createEmptyDatabase(): PersistedDatabase {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    users: [],
    routineExercises: [],
    routinePlans: [],
    dietPlans: [],
    calorieCalculations: [],
    specialistProfiles: [],
    specialistRequests: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isUser(value: unknown): value is User {
  if (!isObject(value) || !Array.isArray(value.identities)) return false;
  const identitiesValid = value.identities.every((identity) => {
    if (!isObject(identity)) return false;
    const providerValid = IDENTITY_PROVIDERS.includes(identity.provider as never);
    const credentialValid = identity.provider === 'password'
      ? isString(identity.credentialHash) && identity.credentialHash.length > 0
      : identity.credentialHash === undefined;
    return providerValid
      && isString(identity.subject)
      && identity.subject.length > 0
      && credentialValid
      && isString(identity.createdAt);
  });
  const profilePhotoValid = value.profilePhoto === null || (
    isStoredMedia(value.profilePhoto)
    && PROFILE_IMAGE_MIME_TYPES.includes(value.profilePhoto.mimeType as never)
    && value.profilePhoto.sizeBytes <= USER_PROFILE_PHOTO_LIMITS.photoBytes
  );
  const resetValid = value.passwordReset === null || (
    isObject(value.passwordReset)
    && isString(value.passwordReset.tokenDigest)
    && /^[a-f0-9]{64}$/.test(value.passwordReset.tokenDigest)
    && isString(value.passwordReset.expiresAt)
    && !Number.isNaN(Date.parse(value.passwordReset.expiresAt))
  );
  const verificationValid = value.emailVerification === null || (
    isObject(value.emailVerification)
    && isString(value.emailVerification.tokenDigest)
    && /^[a-f0-9]{64}$/.test(value.emailVerification.tokenDigest)
    && isString(value.emailVerification.expiresAt)
    && !Number.isNaN(Date.parse(value.emailVerification.expiresAt))
  );
  return identitiesValid
    && value.identities.length > 0
    && isString(value.id)
    && isString(value.name)
    && isString(value.email)
    && isString(value.birthDate)
    && PROFILE_SEX_VALUES.includes(value.sex as never)
    && profilePhotoValid
    && resetValid
    && verificationValid
    && (value.emailVerifiedAt === null || (
      isString(value.emailVerifiedAt)
      && !Number.isNaN(Date.parse(value.emailVerifiedAt))
    ))
    && (value.emailVerifiedAt === null || value.emailVerification === null)
    && Number.isInteger(value.sessionVersion)
    && (value.sessionVersion as number) >= 0
    && (value.passwordReset === null || value.identities.some((identity) => identity.provider === 'password'))
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

function isRoutineExercise(value: unknown): value is RoutineExercise {
  return isObject(value)
    && isString(value.id)
    && isString(value.userId)
    && WEEK_DAYS.includes(value.day as never)
    && MUSCLE_GROUPS.includes(value.muscle as never)
    && isString(value.name)
    && isFiniteNumber(value.sets)
    && Number.isInteger(value.sets)
    && (value.sets as number) >= 1
    && (value.sets as number) <= 30
    && isString(value.reps)
    && isString(value.notes)
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

function isRoutinePlanExercise(value: unknown): boolean {
  if (!isObject(value)) return false;
  const repetitionsValid = value.prescriptionType === 'repetitions'
    && isFiniteNumber(value.sets)
    && Number.isInteger(value.sets)
    && (value.sets as number) >= 1
    && (value.sets as number) <= 30
    && isString(value.reps)
    && value.reps.length >= 1
    && value.reps.length <= 30
    && value.durationMinutes === null;
  const durationValid = value.prescriptionType === 'duration'
    && value.sets === null
    && value.reps === ''
    && isFiniteNumber(value.durationMinutes)
    && Number.isInteger(value.durationMinutes)
    && (value.durationMinutes as number) >= 1
    && (value.durationMinutes as number) <= 240;
  const muscleValid = MUSCLE_GROUPS.includes(value.muscle as never)
    && (!requiresDurationPrescription(value.muscle as never) || value.prescriptionType === 'duration');
  return isString(value.name)
    && value.name.length >= 1
    && value.name.length <= 100
    && muscleValid
    && ROUTINE_PRESCRIPTION_TYPES.includes(value.prescriptionType as never)
    && (repetitionsValid || durationValid)
    && isFiniteNumber(value.restSeconds)
    && Number.isInteger(value.restSeconds)
    && (value.restSeconds as number) >= 0
    && (value.restSeconds as number) <= 900
    && isString(value.tempo)
    && value.tempo.length <= 30
    && isString(value.notes)
    && value.notes.length <= 300;
}

function isRoutinePlanDay(value: unknown): boolean {
  if (!isObject(value) || !Array.isArray(value.exercises)) return false;
  const exercisesValid = value.exercises.length <= 20 && value.exercises.every(isRoutinePlanExercise);
  const restValid = value.isRestDay === true
    ? value.exercises.length === 0
    : value.isRestDay === false && value.exercises.length >= 1;
  return ROUTINE_PLAN_DAYS.includes(value.day as never)
    && isString(value.title)
    && value.title.length >= 1
    && value.title.length <= 100
    && isString(value.focus)
    && value.focus.length <= 160
    && exercisesValid
    && restValid;
}

function isRoutinePlan(value: unknown): value is RoutinePlan {
  if (!isObject(value) || !Array.isArray(value.days)) return false;
  const dayNames = value.days
    .filter(isObject)
    .map((day) => day.day);
  const daysValid = value.days.length === ROUTINE_PLAN_DAYS.length
    && value.days.every(isRoutinePlanDay)
    && new Set(dayNames).size === ROUTINE_PLAN_DAYS.length
    && ROUTINE_PLAN_DAYS.every((day) => dayNames.includes(day));
  const sourceRelationsValid = value.source === 'specialist'
    ? isString(value.specialistRequestId) && value.generationEngine === 'specialist'
    : value.specialistRequestId === null
      && (value.source !== 'manual' || value.generationEngine === 'manual')
      && (value.source !== 'ai' || value.generationEngine === 'openai' || value.generationEngine === 'local');
  return isString(value.id)
    && isString(value.userId)
    && isString(value.authorUserId)
    && ROUTINE_PLAN_SOURCES.includes(value.source as never)
    && isString(value.title)
    && value.title.length >= 2
    && value.title.length <= 120
    && isString(value.summary)
    && value.summary.length <= 900
    && ROUTINE_GOALS.includes(value.goal as never)
    && ROUTINE_LEVELS.includes(value.level as never)
    && ROUTINE_LOCATIONS.includes(value.location as never)
    && isFiniteNumber(value.sessionDurationMinutes)
    && Number.isInteger(value.sessionDurationMinutes)
    && (value.sessionDurationMinutes as number) >= 15
    && (value.sessionDurationMinutes as number) <= 240
    && isString(value.availableEquipment)
    && value.availableEquipment.length <= 300
    && isString(value.limitations)
    && value.limitations.length <= 500
    && daysValid
    && value.days.some((day) => isObject(day) && day.isRestDay === false)
    && (value.specialistRequestId === null || isString(value.specialistRequestId))
    && ROUTINE_GENERATION_ENGINES.includes(value.generationEngine as never)
    && sourceRelationsValid
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

function isDietNutrition(value: unknown): boolean {
  return isObject(value)
    && isFiniteNumber(value.caloriesKcal)
    && isFiniteNumber(value.proteinG)
    && isFiniteNumber(value.carbsG)
    && isFiniteNumber(value.fatG);
}

function isDietIngredient(value: unknown): boolean {
  return isObject(value)
    && isString(value.name)
    && isFiniteNumber(value.amount)
    && (value.amount as number) > 0
    && DIET_PORTION_UNITS.includes(value.unit as never)
    && isString(value.note);
}

function isDietMeal(value: unknown): boolean {
  return isObject(value)
    && isString(value.type)
    && isString(value.title)
    && isString(value.time)
    && (!value.time || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time))
    && Array.isArray(value.ingredients)
    && value.ingredients.length >= 1
    && value.ingredients.length <= 40
    && value.ingredients.every(isDietIngredient)
    && isString(value.preparation)
    && isString(value.notes)
    && (value.estimatedCaloriesKcal === null || isFiniteNumber(value.estimatedCaloriesKcal));
}

function isDietPlan(value: unknown): value is DietPlan {
  if (!isObject(value) || !Array.isArray(value.entries)) return false;
  const sourceValid = DIET_PLAN_SOURCES.includes(value.source as never);
  const requestValid = value.specialistRequestId === null || isString(value.specialistRequestId);
  const calculationValid = value.calorieCalculationId === null || isString(value.calorieCalculationId);
  const sourceRelationsValid = value.source === 'specialist'
    ? isString(value.specialistRequestId) && value.generationEngine === 'specialist'
    : value.specialistRequestId === null
      && (value.source !== 'manual' || value.generationEngine === 'manual')
      && (value.source !== 'ai' || value.generationEngine === 'openai' || value.generationEngine === 'local');
  return isString(value.id)
    && isString(value.userId)
    && isString(value.authorUserId)
    && sourceValid
    && isString(value.title)
    && isString(value.summary)
    && DIET_GOALS.includes(value.goal as never)
    && DIET_PREFERENCES.includes(value.preference as never)
    && isFiniteNumber(value.requestedMeals)
    && Number.isInteger(value.requestedMeals)
    && value.requestedMeals === value.entries.length
    && value.entries.length >= 1
    && value.entries.length <= 24
    && value.entries.every(isDietMeal)
    && (value.nutrition === null || isDietNutrition(value.nutrition))
    && calculationValid
    && requestValid
    && DIET_GENERATION_ENGINES.includes(value.generationEngine as never)
    && sourceRelationsValid
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

function isCalorieCalculation(value: unknown): value is CalorieCalculation {
  return isObject(value)
    && isString(value.id)
    && isString(value.userId)
    && isFiniteNumber(value.age)
    && Number.isInteger(value.age)
    && CALORIE_SEX_VALUES.includes(value.sex as never)
    && isFiniteNumber(value.weightKg)
    && isFiniteNumber(value.heightCm)
    && ACTIVITY_FACTORS.includes(value.activityFactor as never)
    && isFiniteNumber(value.bmr)
    && isFiniteNumber(value.maintenanceCalories)
    && value.formulaVersion === CALORIE_FORMULA_VERSION
    && isString(value.createdAt);
}

function isStoredMedia(value: unknown): value is StoredMediaReference {
  return isObject(value)
    && isString(value.id)
    && value.id.length > 0
    && isString(value.storageKey)
    && /^[a-zA-Z0-9-]{1,80}\.(?:jpg|png|webp|pdf)$/.test(value.storageKey)
    && isString(value.originalName)
    && value.originalName.length > 0
    && value.originalName.length <= 180
    && !/[\r\n\0]/.test(value.originalName)
    && isString(value.mimeType)
    && isFiniteNumber(value.sizeBytes)
    && Number.isInteger(value.sizeBytes)
    && (value.sizeBytes as number) > 0
    && isString(value.createdAt);
}

function isSpecialistProfile(value: unknown): value is SpecialistProfile {
  if (
    !isObject(value)
    || !Array.isArray(value.certificates)
    || !Array.isArray(value.roles)
  ) return false;
  const rolesValid = value.roles.every((assignment) => (
    isObject(assignment)
    && SPECIALIST_ROLES.includes(assignment.role as never)
    && SPECIALIST_ROLE_STATUSES.includes(assignment.status as never)
    && isString(assignment.updatedAt)
  ));
  const photoValid = isStoredMedia(value.photo)
    && ['image/jpeg', 'image/png', 'image/webp'].includes(value.photo.mimeType)
    && value.photo.sizeBytes <= SPECIALIST_UPLOAD_LIMITS.photoBytes;
  const certificatesValid = value.certificates.every((certificate) => (
    isStoredMedia(certificate)
    && certificate.mimeType === 'application/pdf'
    && certificate.sizeBytes <= SPECIALIST_UPLOAD_LIMITS.certificateBytes
  ));
  return isString(value.id)
    && isString(value.userId)
    && isString(value.presentation)
    && isString(value.experience)
    && photoValid
    && value.certificates.length <= 3
    && certificatesValid
    && value.roles.length > 0
    && rolesValid
    && new Set(value.roles.map((assignment) => assignment.role)).size === value.roles.length
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

function isSpecialistRequest(value: unknown): value is SpecialistServiceRequest {
  return isObject(value)
    && isString(value.id)
    && isString(value.clientUserId)
    && isString(value.specialistUserId)
    && isString(value.specialistProfileId)
    && SPECIALIST_ROLES.includes(value.role as never)
    && SPECIALIST_REQUEST_STATUSES.includes(value.status as never)
    && isString(value.createdAt)
    && isString(value.updatedAt);
}

function unique(items: readonly string[]): boolean {
  return new Set(items).size === items.length;
}

function migrateLegacyDietPlans(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((plan) => {
    if (!isObject(plan) || plan.source !== undefined) return plan;
    if (
      !isString(plan.id)
      || !isString(plan.userId)
      || !isString(plan.goal)
      || !isString(plan.preference)
      || !isFiniteNumber(plan.meals)
      || !isString(plan.createdAt)
      || !isString(plan.updatedAt)
    ) return plan;
    try {
      return createDietPlan({
        id: plan.id,
        userId: plan.userId,
        source: 'ai',
        goal: plan.goal,
        preference: plan.preference,
        meals: plan.meals,
        generationEngine: 'local',
        calorieCalculationId: null,
        now: plan.updatedAt,
        createdAt: plan.createdAt,
      });
    } catch {
      return plan;
    }
  });
}

function migrateLegacyRoutinePlans(value: unknown): RoutinePlan[] {
  if (!Array.isArray(value) || !value.every(isRoutineExercise)) return [];
  const exercises = value as RoutineExercise[];
  const userIds = [...new Set(exercises.map((exercise) => exercise.userId))];
  const plans: RoutinePlan[] = [];
  for (const userId of userIds) {
    const owned = exercises.filter((exercise) => exercise.userId === userId);
    const visible = owned.filter((exercise) => ROUTINE_PLAN_DAYS.includes(exercise.day as never));
    if (visible.length === 0) continue;
    const createdAt = [...owned].sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]!.createdAt;
    const updatedAt = [...owned].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]!.updatedAt;
    try {
      plans.push(createRoutinePlan({
        id: `legacy-routine-${userId}`,
        userId,
        source: 'manual',
        title: 'Mi rutina semanal anterior',
        summary: 'Rutina recuperada del planificador anterior y convertida al formato semanal.',
        goal: 'general',
        level: 'intermedio',
        location: 'mixto',
        sessionDurationMinutes: 60,
        availableEquipment: '',
        limitations: '',
        days: ROUTINE_PLAN_DAYS.map((day) => {
          const dayExercises = visible.filter((exercise) => exercise.day === day);
          const muscles = [...new Set(dayExercises.map((exercise) => exercise.muscle))];
          return {
            day,
            title: dayExercises.length ? `Entrenamiento de ${muscles.join(' y ')}` : 'Descanso y recuperación',
            focus: muscles.join(', '),
            isRestDay: dayExercises.length === 0,
            exercises: dayExercises.map((exercise) => ({
              name: exercise.name,
              muscle: exercise.muscle,
              prescriptionType: requiresDurationPrescription(exercise.muscle) ? 'duration' : 'repetitions',
              sets: requiresDurationPrescription(exercise.muscle) ? null : exercise.sets,
              reps: requiresDurationPrescription(exercise.muscle) ? '' : exercise.reps,
              durationMinutes: requiresDurationPrescription(exercise.muscle) ? 15 : null,
              restSeconds: requiresDurationPrescription(exercise.muscle) ? 0 : 90,
              tempo: requiresDurationPrescription(exercise.muscle) ? 'Ritmo sostenible' : '',
              notes: exercise.notes,
            })),
          };
        }),
        generationEngine: 'manual',
        now: updatedAt,
        createdAt,
      }));
    } catch {
      // Los ejercicios históricos permanecen intactos si un plan no puede convertirse.
    }
  }
  return plans;
}

/** Amplía planes v5 de seis días sin alterar sus sesiones existentes. */
function migrateSixDayRoutinePlans(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((plan) => {
    if (!isObject(plan) || !Array.isArray(plan.days)) return plan;
    const hasSunday = plan.days.some((day) => isObject(day) && day.day === 'domingo');
    if (hasSunday || plan.days.length !== 6) return plan;
    return {
      ...plan,
      days: [
        ...plan.days,
        {
          day: 'domingo',
          title: 'Descanso y recuperación',
          focus: 'Recuperación libre añadida al ampliar la programación semanal.',
          isRestDay: true,
          exercises: [],
        },
      ],
    };
  });
}

/** Convierte ejercicios v5/v6 al modelo de prescripción por repeticiones o tiempo. */
function migrateRoutinePlanPrescriptions(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((plan) => {
    if (!isObject(plan) || !Array.isArray(plan.days)) return plan;
    return {
      ...plan,
      availableEquipment: '',
      days: plan.days.map((day) => {
        if (!isObject(day) || !Array.isArray(day.exercises)) return day;
        return {
          ...day,
          exercises: day.exercises.map((exercise) => {
            if (!isObject(exercise)) return exercise;
            const timed = exercise.muscle === 'Cardio' || exercise.muscle === 'Acondicionamiento';
            return {
              ...exercise,
              prescriptionType: timed ? 'duration' : 'repetitions',
              sets: timed ? null : exercise.sets,
              reps: timed ? '' : exercise.reps,
              durationMinutes: timed ? 15 : null,
              restSeconds: timed ? 0 : exercise.restSeconds,
              tempo: timed && !exercise.tempo ? 'Ritmo sostenible' : exercise.tempo,
            };
          }),
        };
      }),
    };
  });
}

/**
 * Convierte JSON desconocido en v9 y valida relaciones además de tipos.
 *
 * v8 añade el estado de recuperación y la versión de sesiones al usuario.
 * v9 añade la confirmación de propiedad del correo.
 * La siguiente escritura persiste la versión vigente.
 */
export function parsePersistedDatabase(value: unknown): PersistedDatabase {
  if (!isObject(value)) {
    throw new DataStoreCorruptionError('El archivo de datos no contiene un objeto JSON.');
  }
  let legacyCandidate: Record<string, unknown> | null = null;
  let candidate: Record<string, unknown> = value;
  if (value.schemaVersion === 1) {
    legacyCandidate = {
      ...value,
      users: Array.isArray(value.users)
        ? value.users.map((user) => (isObject(user) ? { ...user, profilePhoto: null } : user))
        : value.users,
      specialistProfiles: [],
      specialistRequests: [],
    };
  } else if (value.schemaVersion === 2) {
    legacyCandidate = {
      ...value,
      users: Array.isArray(value.users)
        ? value.users.map((user) => (isObject(user) ? { ...user, profilePhoto: null } : user))
        : value.users,
    };
  } else if (value.schemaVersion === 3 || value.schemaVersion === 4) {
    legacyCandidate = value;
  } else if (value.schemaVersion === 5) {
    candidate = {
      ...value,
      schemaVersion: DATA_SCHEMA_VERSION,
      routinePlans: migrateRoutinePlanPrescriptions(migrateSixDayRoutinePlans(value.routinePlans)),
    };
  } else if (value.schemaVersion === 6) {
    candidate = {
      ...value,
      schemaVersion: DATA_SCHEMA_VERSION,
      routinePlans: migrateRoutinePlanPrescriptions(value.routinePlans),
    };
  } else if (value.schemaVersion === 7) {
    candidate = { ...value, schemaVersion: DATA_SCHEMA_VERSION };
  } else if (value.schemaVersion === 8) {
    candidate = { ...value, schemaVersion: DATA_SCHEMA_VERSION };
  } else if (value.schemaVersion === DATA_SCHEMA_VERSION) {
    candidate = value;
  } else {
    throw new DataStoreCorruptionError(`Versión de datos no compatible: ${String(value.schemaVersion)}.`);
  }
  if (legacyCandidate) {
    candidate = {
      ...legacyCandidate,
      schemaVersion: DATA_SCHEMA_VERSION,
      dietPlans: migrateLegacyDietPlans(legacyCandidate.dietPlans),
      routinePlans: migrateLegacyRoutinePlans(legacyCandidate.routineExercises),
    };
  }
  if (value.schemaVersion !== 8 && value.schemaVersion !== DATA_SCHEMA_VERSION) {
    candidate = {
      ...candidate,
      users: Array.isArray(candidate.users)
        ? candidate.users.map((user) => (isObject(user)
          ? { ...user, passwordReset: null, sessionVersion: 0 }
          : user))
        : candidate.users,
    };
  }
  if (value.schemaVersion !== DATA_SCHEMA_VERSION) {
    candidate = {
      ...candidate,
      users: Array.isArray(candidate.users)
        ? candidate.users.map((user) => (isObject(user)
          ? { ...user, emailVerification: null, emailVerifiedAt: null }
          : user))
        : candidate.users,
    };
  }

  if (
    !Array.isArray(candidate.users)
    || !candidate.users.every(isUser)
    || !Array.isArray(candidate.routineExercises)
    || !candidate.routineExercises.every(isRoutineExercise)
    || !Array.isArray(candidate.routinePlans)
    || !candidate.routinePlans.every(isRoutinePlan)
    || !Array.isArray(candidate.dietPlans)
    || !candidate.dietPlans.every(isDietPlan)
    || !Array.isArray(candidate.calorieCalculations)
    || !candidate.calorieCalculations.every(isCalorieCalculation)
    || !Array.isArray(candidate.specialistProfiles)
    || !candidate.specialistProfiles.every(isSpecialistProfile)
    || !Array.isArray(candidate.specialistRequests)
    || !candidate.specialistRequests.every(isSpecialistRequest)
  ) {
    throw new DataStoreCorruptionError('El archivo de datos no cumple el esquema vigente.');
  }

  const users = candidate.users as User[];
  const routineExercises = candidate.routineExercises as RoutineExercise[];
  const routinePlans = candidate.routinePlans as RoutinePlan[];
  const dietPlans = candidate.dietPlans as DietPlan[];
  const calorieCalculations = candidate.calorieCalculations as CalorieCalculation[];
  const specialistProfiles = candidate.specialistProfiles as SpecialistProfile[];
  const specialistRequests = candidate.specialistRequests as SpecialistServiceRequest[];
  const userIds = new Set(users.map((user) => user.id));
  const profileById = new Map(specialistProfiles.map((profile) => [profile.id, profile]));
  const calculationById = new Map(calorieCalculations.map((calculation) => [calculation.id, calculation]));
  const requestById = new Map(specialistRequests.map((request) => [request.id, request]));

  const identities = users.flatMap((user) => user.identities.map(
    (identity) => `${identity.provider}\u0000${identity.subject}`,
  ));
  const historyCounts = new Map<string, number>();
  for (const calculation of calorieCalculations) {
    historyCounts.set(calculation.userId, (historyCounts.get(calculation.userId) ?? 0) + 1);
  }
  const media = [
    ...users.flatMap((user) => (user.profilePhoto ? [user.profilePhoto] : [])),
    ...specialistProfiles.flatMap((profile) => [profile.photo, ...profile.certificates]),
  ];
  const openRequestKeys = specialistRequests
    .filter((request) => OPEN_SPECIALIST_REQUEST_STATUSES.includes(request.status))
    .map((request) => `${request.clientUserId}\u0000${request.role}`);
  const requestRelationsValid = specialistRequests.every((request) => {
    const profile = profileById.get(request.specialistProfileId);
    return userIds.has(request.clientUserId)
      && userIds.has(request.specialistUserId)
      && profile?.userId === request.specialistUserId
      && profile.roles.some((assignment) => assignment.role === request.role);
  });
  const dietRelationsValid = dietPlans.every((plan) => {
    if (!userIds.has(plan.userId) || !userIds.has(plan.authorUserId)) return false;
    if (plan.calorieCalculationId) {
      const calculation = calculationById.get(plan.calorieCalculationId);
      if (calculation?.userId !== plan.userId) return false;
    }
    if (plan.source !== 'specialist') {
      return plan.authorUserId === plan.userId && plan.specialistRequestId === null;
    }
    const request = requestById.get(plan.specialistRequestId ?? '');
    return request?.role === 'nutritionist'
      && request.clientUserId === plan.userId
      && request.specialistUserId === plan.authorUserId
      && (request.status === 'accepted' || request.status === 'closed');
  });
  const routineRelationsValid = routinePlans.every((plan) => {
    if (!userIds.has(plan.userId) || !userIds.has(plan.authorUserId)) return false;
    if (plan.source !== 'specialist') {
      return plan.authorUserId === plan.userId && plan.specialistRequestId === null;
    }
    const request = requestById.get(plan.specialistRequestId ?? '');
    return request?.role === 'trainer'
      && request.clientUserId === plan.userId
      && request.specialistUserId === plan.authorUserId
      && (request.status === 'accepted' || request.status === 'closed');
  });
  const relationsValid = routineExercises.every((item) => userIds.has(item.userId))
    && routineRelationsValid
    && dietRelationsValid
    && calorieCalculations.every((item) => userIds.has(item.userId))
    && specialistProfiles.every((profile) => userIds.has(profile.userId))
    && requestRelationsValid;

  const constraintsValid = unique(users.map((user) => user.id))
    && unique(users.map((user) => user.email))
    && users.every((user) => user.email === user.email.trim().toLowerCase())
    && unique(identities)
    && unique(routineExercises.map((item) => item.id))
    && unique(routinePlans.map((item) => item.id))
    && unique(routinePlans.map((item) => `${item.userId}\u0000${item.source}`))
    && unique(dietPlans.map((item) => item.id))
    && unique(dietPlans.map((item) => `${item.userId}\u0000${item.source}`))
    && unique(calorieCalculations.map((item) => item.id))
    && [...historyCounts.values()].every((count) => count <= 10)
    && unique(specialistProfiles.map((profile) => profile.id))
    && unique(specialistProfiles.map((profile) => profile.userId))
    && unique(media.map((item) => item.id))
    && unique(media.map((item) => item.storageKey))
    && unique(specialistRequests.map((request) => request.id))
    && unique(openRequestKeys)
    && relationsValid;
  if (!constraintsValid) {
    throw new DataStoreCorruptionError('El archivo de datos viola restricciones de unicidad o pertenencia.');
  }

  return structuredClone({
    schemaVersion: DATA_SCHEMA_VERSION,
    users,
    routineExercises,
    routinePlans,
    dietPlans,
    calorieCalculations,
    specialistProfiles,
    specialistRequests,
  });
}
