import { assertDomain } from '../shared/errors';

/** Versión explícita para poder reproducir cálculos históricos. */
export const CALORIE_FORMULA_VERSION = 'mifflin-st-jeor-v1' as const;

/** Sexos contemplados por las constantes publicadas de Mifflin-St Jeor. */
export const CALORIE_SEX_VALUES = ['male', 'female'] as const;

/** Sexo fisiológico usado exclusivamente por la fórmula seleccionada. */
export type CalorieSex = (typeof CALORIE_SEX_VALUES)[number];

/** Factores de actividad ofrecidos por la calculadora. */
export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;

/** Multiplicador de gasto energético por nivel de actividad. */
export type ActivityFactor = (typeof ACTIVITY_FACTORS)[number];

/** Valores requeridos para calcular gasto basal y mantenimiento. */
export interface CalorieInput {
  age: number;
  sex: string;
  weightKg: number;
  heightCm: number;
  activityFactor: number;
}

/** Resultado puro de la fórmula, antes de persistirlo. */
export interface CalorieEstimate {
  bmr: number;
  maintenanceCalories: number;
  formulaVersion: typeof CALORIE_FORMULA_VERSION;
}

/** Cálculo histórico completo y reproducible. */
export interface CalorieCalculation extends CalorieEstimate {
  id: string;
  userId: string;
  age: number;
  sex: CalorieSex;
  weightKg: number;
  heightCm: number;
  activityFactor: ActivityFactor;
  createdAt: string;
}

/** Máximo de resultados conservados por usuario, igual al producto anterior. */
export const CALORIE_HISTORY_LIMIT = 10;

/** Valida las unidades y calcula Mifflin-St Jeor con mantenimiento diario. */
export function calculateCalories(input: CalorieInput): CalorieEstimate {
  assertDomain(Number.isInteger(input.age) && input.age >= 14 && input.age <= 100, 'age', 'La edad debe ser un entero entre 14 y 100.');
  assertDomain(CALORIE_SEX_VALUES.includes(input.sex as CalorieSex), 'sex', 'Selecciona un sexo válido para la fórmula.');
  assertDomain(Number.isFinite(input.weightKg) && input.weightKg >= 30 && input.weightKg <= 300, 'weight', 'El peso debe estar entre 30 y 300 kg.');
  assertDomain(Number.isFinite(input.heightCm) && input.heightCm >= 120 && input.heightCm <= 230, 'height', 'La altura debe estar entre 120 y 230 cm.');
  assertDomain(
    ACTIVITY_FACTORS.includes(input.activityFactor as ActivityFactor),
    'activity',
    'Selecciona un nivel de actividad válido.',
  );

  const sexOffset = input.sex === 'male' ? 5 : -161;
  const rawBmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + sexOffset;

  return {
    bmr: Math.round(rawBmr),
    maintenanceCalories: Math.round(rawBmr * input.activityFactor),
    formulaVersion: CALORIE_FORMULA_VERSION,
  };
}

/** Crea el registro histórico a partir de una estimación ya validada. */
export function createCalorieCalculation(
  input: CalorieInput & { id: string; userId: string; now: string },
): CalorieCalculation {
  const estimate = calculateCalories(input);
  return {
    id: input.id,
    userId: input.userId,
    age: input.age,
    sex: input.sex as CalorieSex,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    activityFactor: input.activityFactor as ActivityFactor,
    createdAt: input.now,
    ...estimate,
  };
}
