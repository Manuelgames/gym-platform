import { assertDomain } from '../shared/errors';

/** Orden canónico de los días usado en formularios, almacenamiento y vistas. */
export const WEEK_DAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

/** Día canónico de una rutina semanal. */
export type WeekDay = (typeof WEEK_DAYS)[number];

/** Grupos musculares disponibles en el planificador. */
export const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Hombros',
  'Brazos',
  'Core',
  'Cardio',
] as const;

/** Grupo muscular asignable a un ejercicio. */
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Ejercicio persistente y propiedad de un único usuario. */
export interface RoutineExercise {
  id: string;
  userId: string;
  day: WeekDay;
  muscle: MuscleGroup;
  name: string;
  sets: number;
  reps: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Entrada aún no validada para crear un ejercicio. */
export interface CreateRoutineExerciseInput {
  id: string;
  userId: string;
  day: string;
  muscle: string;
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  now: string;
}

/** Colección de ejercicios agrupada por los siete días, siempre completos. */
export type RoutineByDay = Record<WeekDay, RoutineExercise[]>;

/** Valida y crea un ejercicio sin realizar efectos de infraestructura. */
export function createRoutineExercise(input: CreateRoutineExerciseInput): RoutineExercise {
  assertDomain(input.id.trim().length > 0, 'id', 'El identificador del ejercicio es obligatorio.');
  assertDomain(input.userId.trim().length > 0, 'userId', 'El propietario del ejercicio es obligatorio.');
  assertDomain(WEEK_DAYS.includes(input.day as WeekDay), 'day', 'Selecciona un día válido.');
  assertDomain(MUSCLE_GROUPS.includes(input.muscle as MuscleGroup), 'muscle', 'Selecciona un grupo muscular válido.');

  const name = input.name.trim().replace(/\s+/g, ' ');
  const reps = input.reps.trim().replace(/\s+/g, ' ');
  const notes = (input.notes ?? '').trim();
  assertDomain(name.length >= 1 && name.length <= 80, 'name', 'El ejercicio debe tener entre 1 y 80 caracteres.');
  assertDomain(Number.isInteger(input.sets) && input.sets >= 1 && input.sets <= 30, 'sets', 'Las series deben ser un entero entre 1 y 30.');
  assertDomain(reps.length >= 1 && reps.length <= 20, 'reps', 'Las repeticiones deben tener entre 1 y 20 caracteres.');
  assertDomain(notes.length <= 240, 'notes', 'Las notas no pueden superar 240 caracteres.');

  return {
    id: input.id,
    userId: input.userId,
    day: input.day as WeekDay,
    muscle: input.muscle as MuscleGroup,
    name,
    sets: input.sets,
    reps,
    notes,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** Agrupa una lista plana sin perder el orden semanal ni el de inserción. */
export function groupRoutineByDay(exercises: readonly RoutineExercise[]): RoutineByDay {
  const grouped: RoutineByDay = {
    lunes: [],
    martes: [],
    miercoles: [],
    jueves: [],
    viernes: [],
    sabado: [],
    domingo: [],
  };
  for (const exercise of exercises) {
    grouped[exercise.day].push(exercise);
  }
  return grouped;
}

/** Los documentos semanales incluyen los siete días, con descansos configurables. */
export const ROUTINE_PLAN_DAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export type RoutinePlanDayName = (typeof ROUTINE_PLAN_DAYS)[number];

export const ROUTINE_PLAN_SOURCES = ['ai', 'manual', 'specialist'] as const;
export type RoutinePlanSource = (typeof ROUTINE_PLAN_SOURCES)[number];

export const ROUTINE_GENERATION_ENGINES = ['openai', 'local', 'manual', 'specialist'] as const;
export type RoutineGenerationEngine = (typeof ROUTINE_GENERATION_ENGINES)[number];

export const ROUTINE_GOALS = [
  'fuerza',
  'hipertrofia',
  'perdida_grasa',
  'resistencia',
  'movilidad',
  'general',
] as const;
export type RoutineGoal = (typeof ROUTINE_GOALS)[number];

export const ROUTINE_LEVELS = ['principiante', 'intermedio', 'avanzado'] as const;
export type RoutineLevel = (typeof ROUTINE_LEVELS)[number];

export const ROUTINE_LOCATIONS = ['gimnasio', 'casa', 'mixto'] as const;
export type RoutineLocation = (typeof ROUTINE_LOCATIONS)[number];

/** Ejercicio enriquecido y compatible entre IA, edición manual y entrenador. */
export interface RoutinePlanExercise {
  name: string;
  muscle: MuscleGroup;
  sets: number;
  reps: string;
  restSeconds: number;
  tempo: string;
  notes: string;
}

/** Día dentro del documento semanal. Los descansos no contienen ejercicios. */
export interface RoutinePlanDay {
  day: RoutinePlanDayName;
  title: string;
  focus: string;
  isRestDay: boolean;
  exercises: RoutinePlanExercise[];
}

/** Documento vigente de una modalidad de rutina. */
export interface RoutinePlan {
  id: string;
  userId: string;
  authorUserId: string;
  source: RoutinePlanSource;
  title: string;
  summary: string;
  goal: RoutineGoal;
  level: RoutineLevel;
  location: RoutineLocation;
  sessionDurationMinutes: number;
  availableEquipment: string;
  limitations: string;
  days: RoutinePlanDay[];
  specialistRequestId: string | null;
  generationEngine: RoutineGenerationEngine;
  createdAt: string;
  updatedAt: string;
}

export interface RoutinePlanExerciseInput {
  name?: unknown;
  muscle?: unknown;
  sets?: unknown;
  reps?: unknown;
  restSeconds?: unknown;
  tempo?: unknown;
  notes?: unknown;
}

export interface RoutinePlanDayInput {
  day?: unknown;
  title?: unknown;
  focus?: unknown;
  isRestDay?: unknown;
  exercises?: unknown;
}

export interface CreateRoutinePlanInput {
  id: string;
  userId: string;
  authorUserId?: string;
  source: string;
  title?: string;
  summary?: string;
  goal: string;
  level: string;
  location: string;
  sessionDurationMinutes: number;
  availableEquipment?: string;
  limitations?: string;
  days: readonly RoutinePlanDayInput[];
  specialistRequestId?: string | null;
  generationEngine: string;
  now: string;
  createdAt?: string;
}

export interface GeneratedRoutineDraft {
  title: string;
  summary: string;
  days: RoutinePlanDayInput[];
  engine: Extract<RoutineGenerationEngine, 'openai' | 'local'>;
}

export interface AutomaticRoutineGenerationInput {
  goal: RoutineGoal;
  level: RoutineLevel;
  location: RoutineLocation;
  sessionDurationMinutes: number;
  restDaysCount: number;
  availableEquipment: string;
  limitations: string;
}

function normalizedRoutineText(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  fallback = '',
): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
  assertDomain(text.length >= minimum && text.length <= maximum, field, `El campo debe tener entre ${minimum} y ${maximum} caracteres.`);
  return text;
}

function optionalRoutineText(value: unknown, field: string, maximum: number): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  assertDomain(text.length <= maximum, field, `El campo no puede superar ${maximum} caracteres.`);
  return text;
}

function normalizePlanExercise(value: unknown): RoutinePlanExercise {
  assertDomain(typeof value === 'object' && value !== null && !Array.isArray(value), 'days', 'El ejercicio no es válido.');
  const candidate = value as RoutinePlanExerciseInput;
  const sets = Number(candidate.sets);
  const restSeconds = Number(candidate.restSeconds);
  assertDomain(MUSCLE_GROUPS.includes(candidate.muscle as MuscleGroup), 'muscle', 'Selecciona un grupo muscular válido.');
  assertDomain(Number.isInteger(sets) && sets >= 1 && sets <= 30, 'sets', 'Las series deben estar entre 1 y 30.');
  assertDomain(Number.isInteger(restSeconds) && restSeconds >= 0 && restSeconds <= 900, 'restSeconds', 'El descanso debe estar entre 0 y 900 segundos.');
  return {
    name: normalizedRoutineText(candidate.name, 'name', 1, 100),
    muscle: candidate.muscle as MuscleGroup,
    sets,
    reps: normalizedRoutineText(candidate.reps, 'reps', 1, 30),
    restSeconds,
    tempo: optionalRoutineText(candidate.tempo, 'tempo', 30),
    notes: optionalRoutineText(candidate.notes, 'notes', 300),
  };
}

function normalizePlanDay(value: unknown): RoutinePlanDay {
  assertDomain(typeof value === 'object' && value !== null && !Array.isArray(value), 'days', 'El día de entrenamiento no es válido.');
  const candidate = value as RoutinePlanDayInput;
  assertDomain(ROUTINE_PLAN_DAYS.includes(candidate.day as RoutinePlanDayName), 'day', 'Selecciona un día válido entre lunes y domingo.');
  assertDomain(typeof candidate.isRestDay === 'boolean', 'days', 'Indica si el día es de descanso.');
  assertDomain(Array.isArray(candidate.exercises), 'days', 'La lista de ejercicios no es válida.');
  const exercises = candidate.exercises.map(normalizePlanExercise);
  assertDomain(exercises.length <= 20, 'days', 'Cada día permite hasta 20 ejercicios.');
  if (candidate.isRestDay) {
    assertDomain(exercises.length === 0, 'days', 'Un día de descanso no debe contener ejercicios.');
  } else {
    assertDomain(exercises.length >= 1, 'days', 'Agrega al menos un ejercicio o marca el día como descanso.');
  }
  return {
    day: candidate.day as RoutinePlanDayName,
    title: normalizedRoutineText(candidate.title, 'days', 1, 100, candidate.isRestDay ? 'Descanso y recuperación' : 'Sesión de entrenamiento'),
    focus: optionalRoutineText(candidate.focus, 'days', 160),
    isRestDay: candidate.isRestDay,
    exercises,
  };
}

/** Valida el documento canónico compartido por las tres modalidades. */
export function createRoutinePlan(input: CreateRoutinePlanInput): RoutinePlan {
  assertDomain(input.id.trim().length > 0, 'id', 'El identificador del plan es obligatorio.');
  assertDomain(input.userId.trim().length > 0, 'userId', 'El propietario del plan es obligatorio.');
  assertDomain(ROUTINE_PLAN_SOURCES.includes(input.source as RoutinePlanSource), 'source', 'La modalidad de rutina no es válida.');
  assertDomain(ROUTINE_GOALS.includes(input.goal as RoutineGoal), 'goal', 'Selecciona un objetivo de entrenamiento válido.');
  assertDomain(ROUTINE_LEVELS.includes(input.level as RoutineLevel), 'level', 'Selecciona un nivel válido.');
  assertDomain(ROUTINE_LOCATIONS.includes(input.location as RoutineLocation), 'location', 'Selecciona un lugar de entrenamiento válido.');
  assertDomain(
    Number.isInteger(input.sessionDurationMinutes)
      && input.sessionDurationMinutes >= 15
      && input.sessionDurationMinutes <= 240,
    'sessionDurationMinutes',
    'La duración debe estar entre 15 y 240 minutos.',
  );
  assertDomain(Array.isArray(input.days) && input.days.length === ROUTINE_PLAN_DAYS.length, 'days', 'La rutina debe incluir de lunes a domingo.');
  const normalizedDays = input.days.map(normalizePlanDay);
  assertDomain(new Set(normalizedDays.map((day) => day.day)).size === ROUTINE_PLAN_DAYS.length, 'days', 'No se pueden repetir días en la rutina.');
  const byDay = new Map(normalizedDays.map((day) => [day.day, day]));
  const days = ROUTINE_PLAN_DAYS.map((day) => byDay.get(day)!);
  assertDomain(days.some((day) => !day.isRestDay), 'days', 'La semana necesita al menos un día de entrenamiento.');

  const source = input.source as RoutinePlanSource;
  const engine = input.generationEngine as RoutineGenerationEngine;
  assertDomain(ROUTINE_GENERATION_ENGINES.includes(engine), 'source', 'El motor de la rutina no es válido.');
  assertDomain(source !== 'ai' || engine === 'openai' || engine === 'local', 'source', 'La rutina automática requiere un motor automático.');
  assertDomain(source !== 'manual' || engine === 'manual', 'source', 'La rutina manual debe conservar su autoría.');
  assertDomain(source !== 'specialist' || engine === 'specialist', 'source', 'La rutina del entrenador debe conservar su autoría profesional.');
  const specialistRequestId = input.specialistRequestId?.trim() || null;
  assertDomain(source !== 'specialist' || Boolean(specialistRequestId), 'request', 'La rutina profesional necesita una asesoría asociada.');
  assertDomain(source === 'specialist' || !specialistRequestId, 'request', 'Solo la rutina profesional puede asociarse a una asesoría.');
  const authorUserId = input.authorUserId?.trim() || input.userId;

  return {
    id: input.id,
    userId: input.userId,
    authorUserId,
    source,
    title: normalizedRoutineText(input.title, 'title', 2, 120, 'Mi rutina semanal'),
    summary: optionalRoutineText(input.summary, 'summary', 900),
    goal: input.goal as RoutineGoal,
    level: input.level as RoutineLevel,
    location: input.location as RoutineLocation,
    sessionDurationMinutes: input.sessionDurationMinutes,
    availableEquipment: optionalRoutineText(input.availableEquipment, 'availableEquipment', 300),
    limitations: optionalRoutineText(input.limitations, 'limitations', 500),
    days,
    specialistRequestId,
    generationEngine: engine,
    createdAt: input.createdAt ?? input.now,
    updatedAt: input.now,
  };
}

/** Convierte el JSON del editor en los siete días que luego valida el dominio. */
export function parseRoutineDaysJson(value: string): RoutinePlanDayInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    assertDomain(false, 'days', 'No se pudo interpretar la semana de entrenamiento.');
  }
  assertDomain(Array.isArray(parsed), 'days', 'La semana de entrenamiento no es válida.');
  assertDomain(parsed.length === ROUTINE_PLAN_DAYS.length, 'days', 'La rutina debe contener de lunes a domingo.');
  return parsed as RoutinePlanDayInput[];
}

const TRAINING_SPLITS: Record<RoutineGoal, readonly MuscleGroup[]> = {
  fuerza: ['Piernas', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Core', 'Brazos'],
  hipertrofia: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Cardio'],
  perdida_grasa: ['Piernas', 'Pecho', 'Espalda', 'Cardio', 'Hombros', 'Core', 'Brazos'],
  resistencia: ['Cardio', 'Piernas', 'Espalda', 'Pecho', 'Core', 'Hombros', 'Brazos'],
  movilidad: ['Core', 'Piernas', 'Hombros', 'Espalda', 'Cardio', 'Brazos', 'Pecho'],
  general: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Cardio', 'Core', 'Brazos'],
};

/** Comprueba que los grupos declarados en el título coincidan con los ejercicios. */
export function hasConsistentMuscleCoverage(day: RoutinePlanDay): boolean {
  if (day.isRestDay) return day.exercises.length === 0;
  const description = day.title.toLocaleLowerCase('es-MX');
  const declared = MUSCLE_GROUPS.filter((muscle) => description.includes(muscle.toLocaleLowerCase('es-MX')));
  if (declared.length === 0) return false;
  const prescribed = new Set(day.exercises.map((exercise) => exercise.muscle));
  return declared.every((muscle) => prescribed.has(muscle))
    && [...prescribed].every((muscle) => declared.includes(muscle));
}

const GYM_EXERCISES: Record<MuscleGroup, readonly string[]> = {
  Pecho: ['Press de banca', 'Press inclinado con mancuernas', 'Aperturas en polea', 'Flexiones controladas'],
  Espalda: ['Jalón al pecho', 'Remo con barra', 'Remo sentado', 'Pullover en polea'],
  Piernas: ['Sentadilla', 'Peso muerto rumano', 'Prensa de piernas', 'Desplantes caminando'],
  Hombros: ['Press militar', 'Elevaciones laterales', 'Pájaros con mancuernas', 'Face pull'],
  Brazos: ['Curl con barra', 'Extensión de tríceps', 'Curl martillo', 'Fondos asistidos'],
  Core: ['Plancha frontal', 'Pallof press', 'Elevación de rodillas', 'Dead bug'],
  Cardio: ['Bicicleta estática', 'Caminata inclinada', 'Remo ergómetro', 'Intervalos en elíptica'],
};

const HOME_EXERCISES: Record<MuscleGroup, readonly string[]> = {
  Pecho: ['Flexiones', 'Flexiones inclinadas', 'Press de suelo con mochila', 'Flexiones con pausa'],
  Espalda: ['Remo con mochila', 'Remo bajo mesa estable', 'Superman', 'Pullover con banda'],
  Piernas: ['Sentadilla con peso corporal', 'Peso muerto con mochila', 'Zancadas alternas', 'Puente de glúteo'],
  Hombros: ['Press con banda', 'Elevaciones laterales con botellas', 'Flexiones pica', 'Pájaros con banda'],
  Brazos: ['Curl con banda', 'Fondos en silla estable', 'Curl martillo con mochila', 'Extensión de tríceps con banda'],
  Core: ['Plancha frontal', 'Plancha lateral', 'Dead bug', 'Escaladores controlados'],
  Cardio: ['Marcha rápida', 'Jumping jacks de bajo impacto', 'Escaladores', 'Circuito de pasos laterales'],
};

function localExercisePrescription(goal: RoutineGoal): Pick<RoutinePlanExercise, 'sets' | 'reps' | 'restSeconds' | 'tempo'> {
  if (goal === 'fuerza') return { sets: 4, reps: '4-6', restSeconds: 150, tempo: '2-1-1' };
  if (goal === 'hipertrofia') return { sets: 4, reps: '8-12', restSeconds: 90, tempo: '3-1-1' };
  if (goal === 'resistencia') return { sets: 3, reps: '12-20', restSeconds: 45, tempo: '2-0-2' };
  if (goal === 'movilidad') return { sets: 3, reps: '8-10 por lado', restSeconds: 30, tempo: 'controlado' };
  if (goal === 'perdida_grasa') return { sets: 3, reps: '10-15', restSeconds: 45, tempo: '2-0-1' };
  return { sets: 3, reps: '8-12', restSeconds: 75, tempo: 'controlado' };
}

/** Respaldo determinista cuando la integración externa no está configurada o falla. */
export function buildLocalAutomaticRoutine(input: AutomaticRoutineGenerationInput): GeneratedRoutineDraft {
  assertDomain(Number.isInteger(input.restDaysCount) && input.restDaysCount >= 0 && input.restDaysCount <= 6, 'restDays', 'Selecciona entre 0 y 6 días de descanso.');
  assertDomain(Number.isInteger(input.sessionDurationMinutes) && input.sessionDurationMinutes >= 15 && input.sessionDurationMinutes <= 240, 'sessionDurationMinutes', 'La duración no es válida.');
  const restPriority = [2, 5, 6, 3, 1, 4] as const;
  const restIndexes = new Set<number>(restPriority.slice(0, input.restDaysCount));
  const splits = TRAINING_SPLITS[input.goal];
  const prescription = localExercisePrescription(input.goal);
  const exerciseCount = Math.max(2, Math.min(8, Math.round(input.sessionDurationMinutes / 15)));
  const dayLabels: Record<RoutinePlanDayName, string> = {
    lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
  };
  const days: RoutinePlanDayInput[] = ROUTINE_PLAN_DAYS.map((day, index) => {
    if (restIndexes.has(index)) {
      return { day, title: 'Descanso y recuperación', focus: 'Movilidad suave, hidratación y sueño suficiente.', isRestDay: true, exercises: [] };
    }
    const primary = splits[index]!;
    const secondary = splits[(index + 1) % splits.length]!;
    const library = input.location === 'casa' ? HOME_EXERCISES : GYM_EXERCISES;
    const primaryCount = secondary === primary ? exerciseCount : Math.ceil(exerciseCount / 2);
    const selected = [
      ...library[primary].slice(0, primaryCount).map((name) => ({ name, muscle: primary })),
      ...library[secondary].slice(0, exerciseCount - primaryCount).map((name) => ({ name, muscle: secondary })),
    ];
    const exercises: RoutinePlanExerciseInput[] = selected.map(({ name, muscle }, exerciseIndex) => ({
      name,
      muscle,
      ...prescription,
      notes: exerciseIndex === 0 ? 'Realiza primero series progresivas de calentamiento sin llegar al fallo.' : 'Conserva una técnica estable y detén la serie si se pierde el control.',
    }));
    return {
      day,
      title: `${dayLabels[day]} · ${primary}${secondary !== primary ? ` y ${secondary}` : ''}`,
      focus: `Sesión de ${input.sessionDurationMinutes} minutos orientada a ${input.goal.replace('_', ' ')}.`,
      isRestDay: false,
      exercises,
    };
  });
  return {
    title: `Rutina semanal de ${input.goal.replace('_', ' ')}`,
    summary: `Plan de lunes a domingo para nivel ${input.level}, con ${input.restDaysCount} ${input.restDaysCount === 1 ? 'día' : 'días'} de descanso y sesiones aproximadas de ${input.sessionDurationMinutes} minutos.`,
    days,
    engine: 'local',
  };
}
