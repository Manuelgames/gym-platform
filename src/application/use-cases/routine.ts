import {
  createRoutineExercise,
  createRoutinePlan,
  groupRoutineByDay,
  ROUTINE_GOALS,
  ROUTINE_LEVELS,
  ROUTINE_LOCATIONS,
  ROUTINE_PLAN_SOURCES,
  type RoutineExercise,
  type RoutineGoal,
  type RoutineLevel,
  type RoutineLocation,
  type RoutinePlan,
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

  /** Genera una semana de lunes a domingo con los parámetros elegidos. */
  async generate(userId: string, input: GenerateRoutineInput): Promise<RoutinePlan> {
    const goal = readGoal(input.goal);
    const level = readLevel(input.level);
    const location = readLocation(input.location);
    if (!Number.isInteger(input.sessionDurationMinutes) || input.sessionDurationMinutes < 15 || input.sessionDurationMinutes > 240) {
      throw new DomainValidationError('sessionDurationMinutes', 'La duración debe estar entre 15 y 240 minutos.');
    }
    if (!Number.isInteger(input.restDaysCount) || input.restDaysCount < 0 || input.restDaysCount > 6) {
      throw new DomainValidationError('restDays', 'Selecciona entre 0 y 6 días de descanso.');
    }
    const draft = await this.generator.generate({
      goal,
      level,
      location,
      sessionDurationMinutes: input.sessionDurationMinutes,
      restDaysCount: input.restDaysCount,
      availableEquipment: input.availableEquipment,
      limitations: input.limitations,
      safetyIdentifier: userId,
    });
    const plan = createRoutinePlan({
      id: this.ids.next(),
      userId,
      authorUserId: userId,
      source: 'ai',
      title: draft.title,
      summary: draft.summary,
      goal,
      level,
      location,
      sessionDurationMinutes: input.sessionDurationMinutes,
      availableEquipment: input.availableEquipment,
      limitations: input.limitations,
      days: draft.days,
      specialistRequestId: null,
      generationEngine: draft.engine,
      now: this.clock.now(),
    });
    return this.fitness.saveRoutinePlan(plan);
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
      availableEquipment: input.availableEquipment,
      limitations: input.limitations,
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
      availableEquipment: input.availableEquipment,
      limitations: input.limitations,
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
