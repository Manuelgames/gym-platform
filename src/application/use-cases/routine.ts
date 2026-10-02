import {
  createRoutineExercise,
  createRoutinePlan,
  groupRoutineByDay,
  ROUTINE_GOALS,
  ROUTINE_LEVELS,
  ROUTINE_LOCATIONS,
  ROUTINE_PLAN_DAYS,
  ROUTINE_PLAN_SOURCES,
  type RoutineExercise,
  type RoutineGoal,
  type RoutineLevel,
  type RoutineLocation,
  type RoutinePlan,
  type RoutinePlanDayName,
  type RoutinePlanSource,
} from '../../domain/routine/routine';
import { DomainValidationError } from '../../domain/shared/errors';
import { ApplicationError } from '../errors';
import type {
  AddRoutineExerciseInput,
  GenerateRoutineInput,
  RoutineView,
  SaveEditableRoutineInput,
  TrainingClientRoutineView,
} from '../facade';
import type {
  FitnessRepository,
  SpecialistRepository,
  UserRepository,
} from '../ports/repositories';
import type { Clock, IdGenerator, RoutineGenerator } from '../ports/services';
import { toPublicUser } from './auth';

function readGoal(value: string): RoutineGoal {
  if (!ROUTINE_GOALS.includes(value as RoutineGoal)) {
    throw new DomainValidationError('goal', 'Selecciona un objetivo de entrenamiento válido.');
  }
  return value as RoutineGoal;
}

function readLevel(value: string): RoutineLevel {
  if (!ROUTINE_LEVELS.includes(value as RoutineLevel)) {
    throw new DomainValidationError('level', 'Selecciona un nivel válido.');
  }
  return value as RoutineLevel;
}

function readLocation(value: string): RoutineLocation {
  if (!ROUTINE_LOCATIONS.includes(value as RoutineLocation)) {
    throw new DomainValidationError('location', 'Selecciona un lugar de entrenamiento válido.');
  }
  return value as RoutineLocation;
}

/** Casos de uso de ejercicios históricos y de las tres modalidades semanales. */
export class RoutineUseCases {
  constructor(
    private readonly fitness: FitnessRepository,
    private readonly specialists: SpecialistRepository,
    private readonly users: UserRepository,
    private readonly generator: RoutineGenerator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Vista histórica conservada para compatibilidad con consumidores anteriores. */
  async get(userId: string): Promise<RoutineView> {
    const exercises = await this.fitness.listRoutine(userId);
    return { days: groupRoutineByDay(exercises), totalExercises: exercises.length };
  }

  /** Valida y añade un ejercicio al formato histórico. */
  async add(userId: string, input: AddRoutineExerciseInput): Promise<RoutineExercise> {
    const exercise = createRoutineExercise({
      ...input,
      id: this.ids.next(),
      userId,
      now: this.clock.now(),
    });
    await this.fitness.addRoutineExercise(exercise);
    return exercise;
  }

  /** Elimina por id y propietario; nunca acepta un índice de la interfaz. */
  async delete(userId: string, exerciseId: string): Promise<void> {
    if (!exerciseId.trim() || !(await this.fitness.deleteRoutineExercise(userId, exerciseId))) {
      throw new ApplicationError('ROUTINE_EXERCISE_NOT_FOUND', 'No se encontró el ejercicio.');
    }
  }

  /** Obtiene una modalidad sin mezclar autorías. */
  getPlan(userId: string, source: RoutinePlanSource = 'ai'): Promise<RoutinePlan | null> {
    return this.fitness.getRoutinePlan(userId, source);
  }

  /** Lista solo las versiones anteriores; el documento vigente se presenta fuera del historial. */
  async getHistory(userId: string, source: RoutinePlanSource): Promise<RoutinePlan[]> {
    if (source === 'specialist') return [];
    const [plans, current] = await Promise.all([
      this.fitness.listRoutinePlans(userId),
      this.fitness.getRoutinePlan(userId, source),
    ]);
    return plans.filter((plan) => plan.source === source && plan.id !== current?.id);
  }

  /** Genera una semana de lunes a domingo con los parámetros elegidos. */
  async generate(userId: string, input: GenerateRoutineInput): Promise<RoutinePlan> {
    const goal = readGoal(input.goal);
    const level = readLevel(input.level);
    const location = readLocation(input.location);
    if (!Number.isInteger(input.sessionDurationMinutes) || input.sessionDurationMinutes < 15 || input.sessionDurationMinutes > 240) {
      throw new DomainValidationError('sessionDurationMinutes', 'La duración debe estar entre 15 y 240 minutos.');
    }
    const restDays = input.restDays as RoutinePlanDayName[];
    if (
      !Array.isArray(input.restDays)
      || input.restDays.length > 6
      || new Set(input.restDays).size !== input.restDays.length
      || !restDays.every((day) => ROUTINE_PLAN_DAYS.includes(day))
    ) {
      throw new DomainValidationError('restDays', 'Selecciona hasta 6 días de descanso válidos.');
    }
    const draft = await this.generator.generate({
      goal,
      level,
      location,
      sessionDurationMinutes: input.sessionDurationMinutes,
      restDays,
      safetyIdentifier: userId,
    });
    const plan = createRoutinePlan({
      id: this.ids.next(),
      userId,
      authorUserId: userId,
      source: 'ai',
      title: input.title?.trim() || draft.title,
      summary: draft.summary,
      goal,
      level,
      location,
      sessionDurationMinutes: input.sessionDurationMinutes,
      availableEquipment: '',
      limitations: '',
      days: draft.days,
      specialistRequestId: null,
      generationEngine: draft.engine,
      now: this.clock.now(),
    });
    return this.fitness.saveRoutinePlan(plan);
  }

  /** Recupera una versión anterior creando una nueva versión vigente y conservando la trazabilidad. */
  async reuse(userId: string, planId: string): Promise<RoutinePlan> {
    const plans = await this.fitness.listRoutinePlans(userId);
    const historical = plans.find((plan) => plan.id === planId && plan.source !== 'specialist');
    if (!historical) {
      throw new ApplicationError('ROUTINE_HISTORY_NOT_FOUND', 'No se encontró la rutina en el historial.');
    }
    const current = await this.fitness.getRoutinePlan(userId, historical.source);
    if (current?.id === historical.id) {
      throw new ApplicationError('ROUTINE_HISTORY_NOT_FOUND', 'La rutina seleccionada ya es la versión vigente.');
    }
    const restored = createRoutinePlan({
      ...historical,
      id: this.ids.next(),
      authorUserId: userId,
      specialistRequestId: null,
      now: this.clock.now(),
      createdAt: undefined,
    });
    return this.fitness.saveRoutinePlan(restored);
  }

  /** Elimina una versión anterior sin permitir que se borre por error el documento vigente. */
  async deleteFromHistory(userId: string, planId: string): Promise<RoutinePlanSource> {
    const plans = await this.fitness.listRoutinePlans(userId);
    const historical = plans.find((plan) => plan.id === planId && plan.source !== 'specialist');
    if (!historical) {
      throw new ApplicationError('ROUTINE_HISTORY_NOT_FOUND', 'No se encontró la rutina en el historial.');
    }
    const current = await this.fitness.getRoutinePlan(userId, historical.source);
    if (current?.id === historical.id) {
      throw new ApplicationError('ROUTINE_CURRENT_DELETE_FORBIDDEN', 'La rutina vigente no se puede eliminar desde el historial.');
    }
    if (!(await this.fitness.deleteRoutinePlan(userId, historical.id))) {
      throw new ApplicationError('ROUTINE_HISTORY_NOT_FOUND', 'No se encontró la rutina en el historial.');
    }
    return historical.source;
  }

  /** Guarda el documento libre que edita su propietario. */
  async saveManual(userId: string, input: SaveEditableRoutineInput): Promise<RoutinePlan> {
    const plan = createRoutinePlan({
      id: this.ids.next(),
      userId,
      authorUserId: userId,
      source: 'manual',
      title: input.title,
      summary: input.summary,
      goal: readGoal(input.goal),
      level: readLevel(input.level),
      location: readLocation(input.location),
      sessionDurationMinutes: input.sessionDurationMinutes,
      availableEquipment: '',
      limitations: '',
      days: input.days,
      specialistRequestId: null,
      generationEngine: 'manual',
      now: this.clock.now(),
    });
    return this.fitness.saveRoutinePlan(plan);
  }

  private async requireTrainerRelationship(specialistUserId: string, requestId: string) {
    const request = await this.specialists.getSpecialistRequestById(requestId.trim());
    if (
      !request
      || request.specialistUserId !== specialistUserId
      || request.role !== 'trainer'
      || request.status !== 'accepted'
    ) {
      throw new ApplicationError(
        'TRAINING_RELATION_REQUIRED',
        'La asesoría de entrenamiento no está activa o no pertenece al especialista.',
      );
    }
    return request;
  }

  /** Contexto seguro del asesorado seleccionado desde Mi trabajo. */
  async getTrainingClient(
    specialistUserId: string,
    requestId: string,
  ): Promise<TrainingClientRoutineView> {
    const request = await this.requireTrainerRelationship(specialistUserId, requestId);
    const [client, plan] = await Promise.all([
      this.users.findById(request.clientUserId),
      this.fitness.getRoutinePlan(request.clientUserId, 'specialist'),
    ]);
    if (!client) throw new ApplicationError('USER_NOT_FOUND', 'El asesorado ya no existe.');
    return {
      requestId: request.id,
      client: toPublicUser(client),
      plan: plan?.specialistRequestId === request.id ? plan : null,
    };
  }

  /** Crea o reemplaza la rutina desde una relación aceptada con entrenador. */
  async saveSpecialist(
    specialistUserId: string,
    requestId: string,
    input: SaveEditableRoutineInput,
  ): Promise<RoutinePlan> {
    const request = await this.requireTrainerRelationship(specialistUserId, requestId);
    const plan = createRoutinePlan({
      id: this.ids.next(),
      userId: request.clientUserId,
      authorUserId: specialistUserId,
      source: 'specialist',
      title: input.title,
      summary: input.summary,
      goal: readGoal(input.goal),
      level: readLevel(input.level),
      location: readLocation(input.location),
      sessionDurationMinutes: input.sessionDurationMinutes,
      availableEquipment: '',
      limitations: '',
      days: input.days,
      specialistRequestId: request.id,
      generationEngine: 'specialist',
      now: this.clock.now(),
    });
    return this.fitness.saveRoutinePlan(plan);
  }

  /** Autoriza una exportación únicamente contra el propietario autenticado. */
  async getForDownload(userId: string, source: RoutinePlanSource): Promise<RoutinePlan> {
    if (!ROUTINE_PLAN_SOURCES.includes(source)) {
      throw new DomainValidationError('source', 'La modalidad solicitada no es válida.');
    }
    const plan = await this.fitness.getRoutinePlan(userId, source);
    if (!plan) throw new ApplicationError('ROUTINE_PLAN_NOT_FOUND', 'La rutina todavía no existe.');
    return plan;
  }
}
