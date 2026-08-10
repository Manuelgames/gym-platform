import { assertDomain } from '../shared/errors';

/** Objetivos admitidos por los tres tipos de dieta. */
export const DIET_GOALS = ['ganar', 'mantener', 'perder'] as const;
export type DietGoal = (typeof DIET_GOALS)[number];

/** Preferencias que puede respetar el generador y documentar el editor manual. */
export const DIET_PREFERENCES = [
  'general',
  'vegetariana',
  'vegana',
  'pescetariana',
  'sin_lactosa',
  'rapida',
] as const;
export type DietPreference = (typeof DIET_PREFERENCES)[number];

/** Valores históricos conservados para migrar planes de la primera versión. */
export const MEALS_PER_DAY = [3, 4, 5] as const;
export type MealsPerDay = (typeof MEALS_PER_DAY)[number];

/** Cada origen ocupa una subsección independiente dentro de Mi dieta. */
export const DIET_PLAN_SOURCES = ['ai', 'manual', 'specialist'] as const;
export type DietPlanSource = (typeof DIET_PLAN_SOURCES)[number];

/** Unidades explícitas para que una porción nunca sea solo texto ambiguo. */
export const DIET_PORTION_UNITS = [
  'g',
  'ml',
  'pieza',
  'rebanada',
  'taza',
  'cucharada',
  'cucharadita',
  'porcion',
] as const;
export type DietPortionUnit = (typeof DIET_PORTION_UNITS)[number];

export const DIET_GENERATION_ENGINES = ['openai', 'local', 'manual', 'specialist'] as const;
export type DietGenerationEngine = (typeof DIET_GENERATION_ENGINES)[number];

/** Objetivos diarios estimados; no representan una prescripción clínica. */
export interface DietNutritionTargets {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Ingrediente normalizado con cantidad y unidad separadas. */
export interface DietIngredient {
  name: string;
  amount: number;
  unit: DietPortionUnit;
  note: string;
}

/** Comida reutilizable por planes automáticos, manuales y profesionales. */
export interface DietMeal {
  type: string;
  title: string;
  time: string;
  ingredients: DietIngredient[];
  preparation: string;
  notes: string;
  estimatedCaloriesKcal: number | null;
}

/** Documento dietario vigente de un usuario para uno de sus tres orígenes. */
export interface DietPlan {
  id: string;
  userId: string;
  authorUserId: string;
  source: DietPlanSource;
  title: string;
  summary: string;
  goal: DietGoal;
  preference: DietPreference;
  requestedMeals: number;
  entries: DietMeal[];
  nutrition: DietNutritionTargets | null;
  calorieCalculationId: string | null;
  specialistRequestId: string | null;
  generationEngine: DietGenerationEngine;
  createdAt: string;
  updatedAt: string;
}

/** Forma flexible recibida desde formularios o un proveedor de IA. */
export interface DietIngredientInput {
  name?: unknown;
  amount?: unknown;
  unit?: unknown;
  note?: unknown;
}

/** Forma flexible de una comida antes de aplicar reglas de dominio. */
export interface DietMealInput {
  type?: unknown;
  title?: unknown;
  time?: unknown;
  ingredients?: unknown;
  preparation?: unknown;
  notes?: unknown;
  estimatedCaloriesKcal?: unknown;
}

/** Entrada común para crear o reemplazar cualquier modalidad de dieta. */
export interface CreateDietPlanInput {
  id: string;
  userId: string;
  authorUserId?: string;
  source?: string;
  title?: string;
  summary?: string;
  goal: string;
  preference: string;
  requestedMeals?: number;
  /** Alias de la versión anterior, conservado para migraciones y pruebas. */
  meals?: number;
  entries?: readonly DietMealInput[];
  nutrition?: DietNutritionTargets | null;
  calorieCalculationId?: string | null;
  specialistRequestId?: string | null;
  generationEngine?: string;
  now: string;
  createdAt?: string;
}

/** Resultado estructurado producido por un generador automático. */
export interface GeneratedDietDraft {
  title: string;
  summary: string;
  nutrition: DietNutritionTargets;
  entries: DietMealInput[];
  engine: Extract<DietGenerationEngine, 'openai' | 'local'>;
}

/** Datos personales mínimos usados para construir un borrador automático. */
export interface AutomaticDietGenerationInput {
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  maintenanceCalories: number;
  targetCalories: number;
  goal: DietGoal;
  preference: DietPreference;
  requestedMeals: number;
}

/** Vista antigua conservada para consumidores que solo necesitan una explicación. */
export interface MealSuggestion {
  name: string;
  description: string;
}

export interface DietGuide {
  title: string;
  objectiveGuidance: string;
  meals: MealSuggestion[];
}

const GOAL_COPY: Record<DietGoal, { title: string; guidance: string }> = {
  ganar: {
    title: 'Plan para fuerza y masa muscular',
    guidance: 'Aumenta la energía de forma gradual y prioriza constancia, proteína y recuperación.',
  },
  mantener: {
    title: 'Plan para mantener energía y rendimiento',
    guidance: 'Distribuye la energía durante el día y ajusta según hambre, actividad y progreso.',
  },
  perder: {
    title: 'Plan para un déficit moderado',
    guidance: 'Busca un ajuste gradual sin sacrificar proteína, variedad ni recuperación.',
  },
};

const LEGACY_MEALS: Record<DietPreference, readonly MealSuggestion[]> = {
  general: [
    { name: 'Desayuno', description: 'Avena con yogur natural, fruta de temporada y nueces.' },
    { name: 'Comida', description: 'Pollo, pescado o legumbres con arroz o papa, verduras y aceite de oliva.' },
    { name: 'Cena', description: 'Huevos, tofu o pescado con verduras y carbohidrato integral.' },
    { name: 'Colación', description: 'Fruta, yogur, semillas o frutos secos.' },
    { name: 'Antes de dormir', description: 'Leche, yogur o queso fresco con fruta.' },
  ],
  vegetariana: [
    { name: 'Desayuno', description: 'Avena con bebida vegetal, fruta y crema de cacahuate.' },
    { name: 'Comida', description: 'Lentejas o garbanzos con quinoa, verduras y aceite de oliva.' },
    { name: 'Cena', description: 'Tofu o huevos con papa asada y ensalada.' },
    { name: 'Colación', description: 'Yogur, fruta y nueces.' },
    { name: 'Antes de dormir', description: 'Bebida vegetal o yogur con semillas.' },
  ],
  vegana: [
    { name: 'Desayuno', description: 'Avena con bebida de soya, fruta y semillas.' },
    { name: 'Comida', description: 'Lentejas con arroz, verduras y aguacate.' },
    { name: 'Cena', description: 'Tofu con papa, verduras y aceite de oliva.' },
    { name: 'Colación', description: 'Fruta con crema de cacahuate.' },
    { name: 'Antes de dormir', description: 'Yogur de soya con semillas.' },
  ],
  pescetariana: [
    { name: 'Desayuno', description: 'Avena, yogur, fruta y nueces.' },
    { name: 'Comida', description: 'Pescado con arroz, verduras y aceite de oliva.' },
    { name: 'Cena', description: 'Huevos o atún con papa y ensalada.' },
    { name: 'Colación', description: 'Fruta con yogur natural.' },
    { name: 'Antes de dormir', description: 'Queso fresco con fruta.' },
  ],
  sin_lactosa: [
    { name: 'Desayuno', description: 'Avena con bebida vegetal, fruta y nueces.' },
    { name: 'Comida', description: 'Pollo con arroz, verduras y aceite de oliva.' },
    { name: 'Cena', description: 'Pescado con papa y ensalada.' },
    { name: 'Colación', description: 'Yogur sin lactosa con fruta.' },
    { name: 'Antes de dormir', description: 'Bebida de soya con semillas.' },
  ],
  rapida: [
    { name: 'Desayuno', description: 'Yogur griego, avena instantánea, plátano y canela.' },
    { name: 'Comida', description: 'Tortillas integrales con pollo o frijoles, ensalada y aguacate.' },
    { name: 'Cena', description: 'Huevos con verduras congeladas y pan integral.' },
    { name: 'Colación', description: 'Fruta, queso fresco o nueces.' },
    { name: 'Antes de dormir', description: 'Yogur natural o leche con fruta.' },
  ],
};

function normalizedText(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  fallback = '',
): string {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
  assertDomain(
    normalized.length >= minimum && normalized.length <= maximum,
    field,
    `El texto debe tener entre ${minimum} y ${maximum} caracteres.`,
  );
  return normalized;
}

function optionalLongText(value: unknown, field: string, maximum: number): string {
  const normalized = typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n') : '';
  assertDomain(normalized.length <= maximum, field, `El texto no puede superar ${maximum} caracteres.`);
  return normalized;
}

function finiteNumber(value: unknown, field: string, minimum: number, maximum: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  assertDomain(Number.isFinite(number) && number >= minimum && number <= maximum, field, 'La cantidad no es válida.');
  return Math.round(number * 10) / 10;
}

function normalizeNutrition(value: DietNutritionTargets | null | undefined): DietNutritionTargets | null {
  if (!value) return null;
  return {
    caloriesKcal: Math.round(finiteNumber(value.caloriesKcal, 'calories', 500, 10_000)),
    proteinG: Math.round(finiteNumber(value.proteinG, 'protein', 0, 1_000)),
    carbsG: Math.round(finiteNumber(value.carbsG, 'carbs', 0, 2_000)),
    fatG: Math.round(finiteNumber(value.fatG, 'fat', 0, 1_000)),
  };
}

function normalizeIngredient(value: unknown): DietIngredient {
  assertDomain(typeof value === 'object' && value !== null && !Array.isArray(value), 'entries', 'El ingrediente no es válido.');
  const candidate = value as DietIngredientInput;
  const unit = typeof candidate.unit === 'string' ? candidate.unit : '';
  assertDomain(DIET_PORTION_UNITS.includes(unit as DietPortionUnit), 'entries', 'Selecciona una unidad de porción válida.');
  return {
    name: normalizedText(candidate.name, 'entries', 1, 100),
    amount: finiteNumber(candidate.amount, 'entries', 0.1, 10_000),
    unit: unit as DietPortionUnit,
    note: optionalLongText(candidate.note, 'entries', 160),
  };
}

function normalizeMeal(value: unknown): DietMeal {
  assertDomain(typeof value === 'object' && value !== null && !Array.isArray(value), 'entries', 'La comida no es válida.');
  const candidate = value as DietMealInput;
  assertDomain(Array.isArray(candidate.ingredients), 'entries', 'Agrega ingredientes a cada comida.');
  assertDomain(
    candidate.ingredients.length >= 1 && candidate.ingredients.length <= 40,
    'entries',
    'Cada comida debe tener entre 1 y 40 ingredientes.',
  );
  const time = optionalLongText(candidate.time, 'entries', 5);
  assertDomain(!time || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time), 'entries', 'La hora de la comida no es válida.');
  const rawCalories = candidate.estimatedCaloriesKcal;
  const estimatedCaloriesKcal = rawCalories === null || rawCalories === undefined || rawCalories === ''
    ? null
    : Math.round(finiteNumber(rawCalories, 'entries', 1, 10_000));
  return {
    type: normalizedText(candidate.type, 'entries', 1, 60),
    title: normalizedText(candidate.title, 'entries', 1, 120),
    time,
    ingredients: candidate.ingredients.map(normalizeIngredient),
    preparation: optionalLongText(candidate.preparation, 'entries', 1_000),
    notes: optionalLongText(candidate.notes, 'entries', 500),
    estimatedCaloriesKcal,
  };
}

function legacyEntries(preference: DietPreference, count: number): DietMealInput[] {
  const templates = LEGACY_MEALS[preference];
  return Array.from({ length: count }, (_, index) => {
    const suggestion = templates[index % templates.length]!;
    return {
      type: suggestion.name,
      title: suggestion.name,
      ingredients: [{ name: suggestion.description, amount: 1, unit: 'porcion', note: '' }],
      preparation: '',
      notes: '',
      estimatedCaloriesKcal: null,
    };
  });
}

/** Valida y crea un documento dietario con una forma común para sus tres orígenes. */
export function createDietPlan(input: CreateDietPlanInput): DietPlan {
  assertDomain(input.id.trim().length > 0, 'id', 'El identificador del plan es obligatorio.');
  assertDomain(input.userId.trim().length > 0, 'userId', 'El propietario del plan es obligatorio.');
  assertDomain(DIET_GOALS.includes(input.goal as DietGoal), 'goal', 'Selecciona un objetivo válido.');
  assertDomain(
    DIET_PREFERENCES.includes(input.preference as DietPreference),
    'preference',
    'Selecciona una preferencia válida.',
  );
  const source = input.source ?? 'ai';
  assertDomain(DIET_PLAN_SOURCES.includes(source as DietPlanSource), 'source', 'El origen de la dieta no es válido.');
  const requestedMeals = input.requestedMeals ?? input.meals ?? input.entries?.length ?? 0;
  assertDomain(
    Number.isInteger(requestedMeals) && requestedMeals >= 1 && requestedMeals <= 24,
    'meals',
    'La dieta debe contener entre 1 y 24 comidas.',
  );
  const preference = input.preference as DietPreference;
  const entries = (input.entries ?? legacyEntries(preference, requestedMeals)).map(normalizeMeal);
  assertDomain(entries.length === requestedMeals, 'entries', 'El número de comidas no coincide con el plan.');

  const generationEngine = input.generationEngine
    ?? (source === 'manual' ? 'manual' : source === 'specialist' ? 'specialist' : 'local');
  assertDomain(
    DIET_GENERATION_ENGINES.includes(generationEngine as DietGenerationEngine),
    'source',
    'El motor de generación no es válido.',
  );
  assertDomain(
    source !== 'ai' || generationEngine === 'openai' || generationEngine === 'local',
    'source',
    'Una dieta automática necesita un motor automático.',
  );
  assertDomain(
    source !== 'manual' || generationEngine === 'manual',
    'source',
    'Una dieta manual debe conservar su autoría manual.',
  );
  assertDomain(
    source !== 'specialist' || generationEngine === 'specialist',
    'source',
    'Una dieta profesional debe conservar su autoría profesional.',
  );

  const authorUserId = input.authorUserId?.trim() || input.userId;
  assertDomain(authorUserId.length > 0, 'author', 'La dieta necesita un autor.');
  const specialistRequestId = input.specialistRequestId?.trim() || null;
  assertDomain(
    source !== 'specialist' || Boolean(specialistRequestId),
    'request',
    'La dieta de especialista necesita una asesoría asociada.',
  );
  assertDomain(
    source === 'specialist' || !specialistRequestId,
    'request',
    'Solo una dieta profesional puede asociarse a una asesoría.',
  );

  const copy = GOAL_COPY[input.goal as DietGoal];
  return {
    id: input.id,
    userId: input.userId,
    authorUserId,
    source: source as DietPlanSource,
    title: normalizedText(input.title, 'title', 2, 120, copy.title),
    summary: optionalLongText(input.summary ?? copy.guidance, 'summary', 800),
    goal: input.goal as DietGoal,
    preference,
    requestedMeals,
    entries,
    nutrition: normalizeNutrition(input.nutrition),
    calorieCalculationId: input.calorieCalculationId?.trim() || null,
    specialistRequestId,
    generationEngine: generationEngine as DietGenerationEngine,
    createdAt: input.createdAt ?? input.now,
    updatedAt: input.now,
  };
}

/** Convierte el JSON compacto del editor en entradas que luego valida el dominio. */
export function parseDietEntriesJson(value: string): DietMealInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    assertDomain(false, 'entries', 'No se pudo interpretar la lista de comidas.');
  }
  assertDomain(Array.isArray(parsed), 'entries', 'La lista de comidas no es válida.');
  assertDomain(parsed.length >= 1 && parsed.length <= 24, 'entries', 'Agrega entre 1 y 24 comidas.');
  return parsed as DietMealInput[];
}

/** Calcula un objetivo moderado a partir del mantenimiento reproducible guardado. */
export function calculateDietTargetCalories(maintenanceCalories: number, goal: DietGoal): number {
  const factor = goal === 'ganar' ? 1.1 : goal === 'perder' ? 0.9 : 1;
  return Math.max(500, Math.round((maintenanceCalories * factor) / 25) * 25);
}

function mealSchedule(count: number): string[] {
  if (count === 1) return ['Comida principal'];
  if (count === 2) return ['Desayuno', 'Cena'];
  if (count === 3) return ['Desayuno', 'Comida', 'Cena'];
  if (count === 4) return ['Desayuno', 'Colación matutina', 'Comida', 'Cena'];
  const middleCount = count - 3;
  const middle = Array.from({ length: middleCount }, (_, index) => (
    index === 0 ? 'Colación matutina' : index === middleCount - 1 ? 'Colación vespertina' : `Colación ${index + 1}`
  ));
  return ['Desayuno', ...middle.slice(0, Math.ceil(middle.length / 2)), 'Comida', ...middle.slice(Math.ceil(middle.length / 2)), 'Cena'];
}

/** Reparte horarios legibles entre 07:00 y 20:30 sin imponer cinco comidas. */
function mealTimes(count: number): string[] {
  if (count === 1) return ['14:00'];
  const startMinutes = 7 * 60;
  const endMinutes = 20 * 60 + 30;
  const interval = (endMinutes - startMinutes) / (count - 1);
  return Array.from({ length: count }, (_, index) => {
    const rawMinutes = startMinutes + interval * index;
    const roundedMinutes = Math.round(rawMinutes / 15) * 15;
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  });
}

type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const BASE_INGREDIENTS: Record<MealKind, readonly DietIngredientInput[]> = {
  breakfast: [
    { name: 'Avena en hojuelas', amount: 60, unit: 'g', note: 'Peso en seco' },
    { name: 'Yogur natural', amount: 200, unit: 'g', note: 'Sin azúcar añadida' },
    { name: 'Plátano', amount: 120, unit: 'g', note: 'Aproximadamente una pieza' },
    { name: 'Nuez', amount: 15, unit: 'g', note: '' },
  ],
  lunch: [
    { name: 'Pechuga de pollo', amount: 160, unit: 'g', note: 'Peso cocido' },
    { name: 'Arroz', amount: 180, unit: 'g', note: 'Peso cocido' },
    { name: 'Verduras variadas', amount: 200, unit: 'g', note: '' },
    { name: 'Aceite de oliva', amount: 10, unit: 'ml', note: '' },
  ],
  dinner: [
    { name: 'Filete de pescado', amount: 160, unit: 'g', note: 'Peso cocido' },
    { name: 'Papa', amount: 250, unit: 'g', note: 'Peso cocido' },
    { name: 'Ensalada de verduras', amount: 180, unit: 'g', note: '' },
    { name: 'Aceite de oliva', amount: 10, unit: 'ml', note: '' },
  ],
  snack: [
    { name: 'Yogur natural', amount: 180, unit: 'g', note: 'Sin azúcar añadida' },
    { name: 'Fruta de temporada', amount: 150, unit: 'g', note: '' },
    { name: 'Almendras', amount: 15, unit: 'g', note: '' },
  ],
};

function mealKind(type: string): MealKind {
  if (type === 'Desayuno') return 'breakfast';
  if (type === 'Comida' || type === 'Comida principal') return 'lunch';
  if (type === 'Cena') return 'dinner';
  return 'snack';
}

function ingredientForPreference(
  ingredient: DietIngredientInput,
  preference: DietPreference,
): DietIngredientInput {
  let name = String(ingredient.name ?? 'Ingrediente');
  if (preference === 'vegetariana') {
    name = name
      .replace('Pechuga de pollo', 'Tofu firme')
      .replace('Filete de pescado', 'Huevos')
      .replace('Yogur natural', 'Yogur natural o de soya');
  } else if (preference === 'vegana') {
    name = name
      .replace('Pechuga de pollo', 'Tempeh')
      .replace('Filete de pescado', 'Tofu firme')
      .replace('Yogur natural', 'Yogur de soya');
  } else if (preference === 'pescetariana') {
    name = name.replace('Pechuga de pollo', 'Atún o pescado blanco');
  } else if (preference === 'sin_lactosa') {
    name = name.replace('Yogur natural', 'Yogur sin lactosa');
  }
  return { ...ingredient, name };
}

function scaledAmount(amount: unknown, unit: unknown, scale: number): number {
  const numeric = Number(amount);
  if (unit === 'pieza' || unit === 'rebanada') return Math.max(0.5, Math.round(numeric * scale * 2) / 2);
  return Math.max(1, Math.round((numeric * scale) / 5) * 5);
}

/** Borrador determinista usado cuando la integración externa no está configurada o falla. */
export function buildLocalAutomaticDiet(input: AutomaticDietGenerationInput): GeneratedDietDraft {
  assertDomain(Number.isInteger(input.requestedMeals) && input.requestedMeals >= 1 && input.requestedMeals <= 24, 'meals', 'El número de comidas no es válido.');
  const schedule = mealSchedule(input.requestedMeals);
  const times = mealTimes(input.requestedMeals);
  const scale = Math.min(1.45, Math.max(0.7, input.targetCalories / 2_200));
  const rawWeights = schedule.map((type) => {
    const kind = mealKind(type);
    return kind === 'lunch' ? 0.34 : kind === 'dinner' ? 0.28 : kind === 'breakfast' ? 0.22 : 0.1;
  });
  const totalWeight = rawWeights.reduce((total, value) => total + value, 0);
  const entries: DietMealInput[] = schedule.map((type, index) => {
    const kind = mealKind(type);
    const fastNote = input.preference === 'rapida' ? 'Preparación práctica de aproximadamente 15 minutos.' : '';
    return {
      type,
      title: kind === 'breakfast'
        ? 'Avena, fruta y fuente de proteína'
        : kind === 'lunch'
          ? 'Plato completo con proteína, cereal y verduras'
          : kind === 'dinner'
            ? 'Cena equilibrada con verduras'
            : 'Colación de fruta y proteína',
      time: times[index],
      ingredients: BASE_INGREDIENTS[kind].map((ingredient) => {
        const preferred = ingredientForPreference(ingredient, input.preference);
        return {
          ...preferred,
          amount: scaledAmount(preferred.amount, preferred.unit, scale),
        };
      }),
      preparation: fastNote || 'Combina los ingredientes y utiliza métodos de cocción sencillos con poca grasa añadida.',
      notes: 'Las cantidades son un punto de partida y pueden ajustarse según hambre, tolerancia y progreso.',
      estimatedCaloriesKcal: Math.round(input.targetCalories * (rawWeights[index]! / totalWeight)),
    };
  });
  const proteinG = Math.round(input.weightKg * (input.goal === 'ganar' ? 1.8 : input.goal === 'perder' ? 1.6 : 1.4));
  const fatG = Math.round((input.targetCalories * 0.28) / 9);
  const carbsG = Math.max(0, Math.round((input.targetCalories - proteinG * 4 - fatG * 9) / 4));
  const copy = GOAL_COPY[input.goal];
  return {
    title: copy.title,
    summary: `${copy.guidance} Plan calculado con ${input.targetCalories} kcal diarias aproximadas y ${input.requestedMeals} comidas.`,
    nutrition: { caloriesKcal: input.targetCalories, proteinG, carbsG, fatG },
    entries,
    engine: 'local',
  };
}

/** Deriva la vista breve utilizada por consumidores de la primera versión. */
export function buildDietGuide(plan: DietPlan): DietGuide {
  const copy = GOAL_COPY[plan.goal];
  return {
    title: copy.title,
    objectiveGuidance: copy.guidance,
    meals: LEGACY_MEALS[plan.preference]
      .slice(0, plan.requestedMeals)
      .map((meal) => ({ ...meal })),
  };
}
