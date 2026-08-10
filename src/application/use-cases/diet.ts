import {
  buildDietGuide,
  calculateDietTargetCalories,
  createDietPlan,
  DIET_GOALS,
  DIET_PLAN_SOURCES,
  DIET_PREFERENCES,
  type DietGoal,
  type DietNutritionTargets,
  type DietPlan,
  type DietPlanSource,
  type DietPreference,
} from '../../domain/diet/diet';
import { DomainValidationError } from '../../domain/shared/errors';
import { ApplicationError } from '../errors';
import type {
  DietView,
  NutritionClientDietView,
  SaveDietInput,
  SaveEditableDietInput,
} from '../facade';
import type {
  FitnessRepository,
  SpecialistRepository,
  UserRepository,
} from '../ports/repositories';
import type { Clock, DietGenerator, IdGenerator } from '../ports/services';
import { toPublicUser } from './auth';

function readGoal(value: string): DietGoal {
  if (!DIET_GOALS.includes(value as DietGoal)) {
    throw new DomainValidationError('goal', 'Selecciona un objetivo válido.');
  }
  return value as DietGoal;
}

function readPreference(value: string): DietPreference {
  if (!DIET_PREFERENCES.includes(value as DietPreference)) {
    throw new DomainValidationError('preference', 'Selecciona una preferencia válida.');
  }
  return value as DietPreference;
}

function editableNutrition(input: SaveEditableDietInput): DietNutritionTargets | null {
  const hasAny = [input.caloriesKcal, input.proteinG, input.carbsG, input.fatG]
    .some((value) => value !== null && value !== undefined);
  if (!hasAny) return null;
  return {
    caloriesKcal: input.caloriesKcal ?? 0,
    proteinG: input.proteinG ?? 0,
    carbsG: input.carbsG ?? 0,
    fatG: input.fatG ?? 0,
  };
}

/** Casos de uso de las tres modalidades de dieta y su autoría. */
export class DietUseCases {
  constructor(
    private readonly fitness: FitnessRepository,
    private readonly specialists: SpecialistRepository,
    private readonly users: UserRepository,
    private readonly generator: DietGenerator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Obtiene una modalidad sin mezclar documentos de otros orígenes. */
  async get(userId: string, source: DietPlanSource = 'ai'): Promise<DietView | null> {
    const plan = await this.fitness.getDiet(userId, source);
    return plan ? { plan, guide: buildDietGuide(plan) } : null;
  }

  /**
   * Genera la dieta automática únicamente a partir del último cálculo completo.
   * Peso, altura y edad nunca se aceptan desde este formulario para evitar datos
   * paralelos o inconsistentes con la Calculadora de calorías.
   */
  async save(userId: string, input: SaveDietInput): Promise<DietView> {
    const goal = readGoal(input.goal);
    const preference = readPreference(input.preference);
    if (!Number.isInteger(input.meals) || input.meals < 1 || input.meals > 24) {
      throw new DomainValidationError('meals', 'Selecciona entre 1 y 24 comidas al día.');
    }
    const latestCalories = (await this.fitness.listCalorieCalculations(userId))[0];
    if (!latestCalories) {
      throw new ApplicationError(
        'CALORIE_PROFILE_REQUIRED',
        'La dieta automática requiere un cálculo previo de peso, altura y edad.',
      );
    }
    const targetCalories = calculateDietTargetCalories(latestCalories.maintenanceCalories, goal);
    const draft = await this.generator.generate({
      age: latestCalories.age,
      sex: latestCalories.sex,
      weightKg: latestCalories.weightKg,
      heightCm: latestCalories.heightCm,
      maintenanceCalories: latestCalories.maintenanceCalories,
      targetCalories,
      goal,
      preference,
      requestedMeals: input.meals,
      safetyIdentifier: userId,
    });
    const plan = createDietPlan({
      id: this.ids.next(),
      userId,
      authorUserId: userId,
      source: 'ai',
      title: draft.title,
      summary: draft.summary,
      goal,
      preference,
      requestedMeals: input.meals,
      entries: draft.entries,
      nutrition: { ...draft.nutrition, caloriesKcal: targetCalories },
      calorieCalculationId: latestCalories.id,
      specialistRequestId: null,
      generationEngine: draft.engine,
      now: this.clock.now(),
    });
    const saved = await this.fitness.saveDiet(plan);
    return { plan: saved, guide: buildDietGuide(saved) };
  }

  /** Guarda el documento libre que solo puede editar su propietario. */
  async saveManual(userId: string, input: SaveEditableDietInput): Promise<DietView> {
    const plan = createDietPlan({
      id: this.ids.next(),
      userId,
      authorUserId: userId,
      source: 'manual',
      title: input.title,
      summary: input.summary,
      goal: readGoal(input.goal),
      preference: readPreference(input.preference),
      requestedMeals: input.entries.length,
      entries: input.entries,
      nutrition: editableNutrition(input),
      calorieCalculationId: null,
      specialistRequestId: null,
      generationEngine: 'manual',
      now: this.clock.now(),
    });
    const saved = await this.fitness.saveDiet(plan);
    return { plan: saved, guide: buildDietGuide(saved) };
  }

  private async requireNutritionRelationship(specialistUserId: string, requestId: string) {
    const request = await this.specialists.getSpecialistRequestById(requestId.trim());
    if (
      !request
      || request.specialistUserId !== specialistUserId
      || request.role !== 'nutritionist'
      || request.status !== 'accepted'
    ) {
      throw new ApplicationError(
        'NUTRITION_RELATION_REQUIRED',
        'La asesoría nutricional no está activa o no pertenece al especialista.',
      );
    }
    return request;
  }

  /** Contexto seguro del asesorado seleccionado desde Mi trabajo. */
  async getNutritionClient(
    specialistUserId: string,
    requestId: string,
  ): Promise<NutritionClientDietView> {
    const request = await this.requireNutritionRelationship(specialistUserId, requestId);
    const [client, calculations, plan] = await Promise.all([
      this.users.findById(request.clientUserId),
      this.fitness.listCalorieCalculations(request.clientUserId),
      this.fitness.getDiet(request.clientUserId, 'specialist'),
    ]);
    if (!client) throw new ApplicationError('USER_NOT_FOUND', 'El asesorado ya no existe.');
    const relationshipPlan = plan?.specialistRequestId === request.id ? plan : null;
    return {
      requestId: request.id,
      client: toPublicUser(client),
      latestCalories: calculations[0] ?? null,
      plan: relationshipPlan,
    };
  }

  /** Crea o reemplaza la dieta profesional desde una relación aceptada. */
  async saveSpecialist(
    specialistUserId: string,
    requestId: string,
    input: SaveEditableDietInput,
  ): Promise<DietView> {
    const request = await this.requireNutritionRelationship(specialistUserId, requestId);
    const latestCalories = (await this.fitness.listCalorieCalculations(request.clientUserId))[0] ?? null;
    const plan = createDietPlan({
      id: this.ids.next(),
      userId: request.clientUserId,
      authorUserId: specialistUserId,
      source: 'specialist',
      title: input.title,
      summary: input.summary,
      goal: readGoal(input.goal),
      preference: readPreference(input.preference),
      requestedMeals: input.entries.length,
      entries: input.entries,
      nutrition: editableNutrition(input),
      calorieCalculationId: latestCalories?.id ?? null,
      specialistRequestId: request.id,
      generationEngine: 'specialist',
      now: this.clock.now(),
    });
    const saved = await this.fitness.saveDiet(plan);
    return { plan: saved, guide: buildDietGuide(saved) };
  }

  /** Autoriza la exportación exclusivamente contra el propietario autenticado. */
  async getForDownload(userId: string, source: DietPlanSource): Promise<DietPlan> {
    if (!DIET_PLAN_SOURCES.includes(source)) {
      throw new DomainValidationError('source', 'La modalidad solicitada no es válida.');
    }
    const plan = await this.fitness.getDiet(userId, source);
    if (!plan) throw new ApplicationError('DIET_PLAN_NOT_FOUND', 'La dieta todavía no existe.');
    return plan;
  }
}
