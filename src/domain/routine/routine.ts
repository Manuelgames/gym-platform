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
  'Abdomen',
  'Cardio',
  'Acondicionamiento',
] as const;

/** Grupo muscular asignable a un ejercicio. */
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Formas de prescribir un ejercicio dentro del plan profesional. */
export const ROUTINE_PRESCRIPTION_TYPES = ['repetitions', 'duration'] as const;
export type RoutinePrescriptionType = (typeof ROUTINE_PRESCRIPTION_TYPES)[number];

/** Duraciones seleccionables; se almacenan como minutos totales. */
export const ROUTINE_SESSION_DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240] as const;

/** Presenta minutos como horas y minutos sin perder el valor canónico. */
export function formatRoutineDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/** Cardio y acondicionamiento siempre necesitan una duración explícita. */
export function requiresDurationPrescription(muscle: MuscleGroup): boolean {
  return muscle === 'Cardio' || muscle === 'Acondicionamiento';
}

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
  prescriptionType: RoutinePrescriptionType;
  sets: number | null;
  reps: string;
  durationMinutes: number | null;
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
  prescriptionType?: unknown;
  sets?: unknown;
  reps?: unknown;
  durationMinutes?: unknown;
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
  restDays: RoutinePlanDayName[];
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
  const muscle = candidate.muscle as MuscleGroup;
  const prescriptionType = candidate.prescriptionType as RoutinePrescriptionType;
  const restSeconds = Number(candidate.restSeconds);
  assertDomain(MUSCLE_GROUPS.includes(muscle), 'muscle', 'Selecciona un grupo muscular válido.');
  assertDomain(ROUTINE_PRESCRIPTION_TYPES.includes(prescriptionType), 'prescriptionType', 'Selecciona series y repeticiones o duración.');
  assertDomain(!requiresDurationPrescription(muscle) || prescriptionType === 'duration', 'prescriptionType', 'Cardio y acondicionamiento deben indicar su duración.');
  assertDomain(Number.isInteger(restSeconds) && restSeconds >= 0 && restSeconds <= 900, 'restSeconds', 'El descanso debe estar entre 0 y 900 segundos.');
  const sets = prescriptionType === 'repetitions' ? Number(candidate.sets) : null;
  const reps = prescriptionType === 'repetitions'
    ? normalizedRoutineText(candidate.reps, 'reps', 1, 30)
    : '';
  const durationMinutes = prescriptionType === 'duration' ? Number(candidate.durationMinutes) : null;
  if (prescriptionType === 'repetitions') {
    assertDomain(Number.isInteger(sets) && (sets ?? 0) >= 1 && (sets ?? 0) <= 30, 'sets', 'Las series deben estar entre 1 y 30.');
  } else {
    assertDomain(Number.isInteger(durationMinutes) && (durationMinutes ?? 0) >= 1 && (durationMinutes ?? 0) <= 240, 'durationMinutes', 'La duración del ejercicio debe estar entre 1 minuto y 4 horas.');
  }
  return {
    name: normalizedRoutineText(candidate.name, 'name', 1, 100),
    muscle,
    prescriptionType,
    sets,
    reps,
    durationMinutes,
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
  for (const day of days) {
    const timedMinutes = day.exercises.reduce(
      (total, exercise) => total + (exercise.durationMinutes ?? 0),
      0,
    );
    assertDomain(timedMinutes <= input.sessionDurationMinutes, 'durationMinutes', `La duración de los ejercicios de ${day.day} supera la duración de la sesión.`);
  }

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
  perdida_grasa: ['Piernas', 'Pecho', 'Espalda', 'Cardio', 'Hombros', 'Core', 'Acondicionamiento'],
  resistencia: ['Cardio', 'Piernas', 'Espalda', 'Pecho', 'Core', 'Hombros', 'Acondicionamiento'],
  movilidad: ['Core', 'Piernas', 'Hombros', 'Espalda', 'Cardio', 'Brazos', 'Pecho'],
  general: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Cardio', 'Core', 'Acondicionamiento'],
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
  Abdomen: ['Crunch en polea', 'Elevación de piernas', 'Rueda abdominal', 'Crunch inverso'],
  Cardio: ['Bicicleta estática', 'Caminata inclinada', 'Remo ergómetro', 'Intervalos en elíptica'],
  Acondicionamiento: ['Empuje de trineo', 'Cuerdas de batalla', 'Circuito con kettlebell', 'Farmer walk'],
};

const HOME_EXERCISES: Record<MuscleGroup, readonly string[]> = {
  Pecho: ['Flexiones', 'Flexiones inclinadas', 'Press de suelo con mochila', 'Flexiones con pausa'],
  Espalda: ['Remo con mochila', 'Remo bajo mesa estable', 'Superman', 'Pullover con banda'],
  Piernas: ['Sentadilla con peso corporal', 'Peso muerto con mochila', 'Zancadas alternas', 'Puente de glúteo'],
  Hombros: ['Press con banda', 'Elevaciones laterales con botellas', 'Flexiones pica', 'Pájaros con banda'],
  Brazos: ['Curl con banda', 'Fondos en silla estable', 'Curl martillo con mochila', 'Extensión de tríceps con banda'],
  Core: ['Plancha frontal', 'Plancha lateral', 'Dead bug', 'Escaladores controlados'],
  Abdomen: ['Crunch controlado', 'Elevación de piernas', 'Crunch inverso', 'Toques de talón'],
  Cardio: ['Marcha rápida', 'Jumping jacks de bajo impacto', 'Escaladores', 'Circuito de pasos laterales'],
  Acondicionamiento: ['Circuito de sentadilla y empuje', 'Marcha con carga', 'Circuito de cuerpo completo', 'Subidas a escalón'],
};

function localExercisePrescription(
  goal: RoutineGoal,
  muscle: MuscleGroup,
  timedDurationMinutes: number,
): Pick<RoutinePlanExercise, 'prescriptionType' | 'sets' | 'reps' | 'durationMinutes' | 'restSeconds' | 'tempo'> {
  if (requiresDurationPrescription(muscle)) {
    const tempo = goal === 'resistencia' ? 'Ritmo moderado' : goal === 'perdida_grasa' ? 'Intervalos controlados' : 'Ritmo sostenible';
    return { prescriptionType: 'duration', sets: null, reps: '', durationMinutes: timedDurationMinutes, restSeconds: 0, tempo };
  }
  if (goal === 'fuerza') return { prescriptionType: 'repetitions', sets: 4, reps: '4-6', durationMinutes: null, restSeconds: 150, tempo: '2-1-1' };
  if (goal === 'hipertrofia') return { prescriptionType: 'repetitions', sets: 4, reps: '8-12', durationMinutes: null, restSeconds: 90, tempo: '3-1-1' };
  if (goal === 'resistencia') return { prescriptionType: 'repetitions', sets: 3, reps: '12-20', durationMinutes: null, restSeconds: 45, tempo: '2-0-2' };
  if (goal === 'movilidad') return { prescriptionType: 'repetitions', sets: 3, reps: '8-10 por lado', durationMinutes: null, restSeconds: 30, tempo: 'controlado' };
  if (goal === 'perdida_grasa') return { prescriptionType: 'repetitions', sets: 3, reps: '10-15', durationMinutes: null, restSeconds: 45, tempo: '2-0-1' };
  return { prescriptionType: 'repetitions', sets: 3, reps: '8-12', durationMinutes: null, restSeconds: 75, tempo: 'controlado' };
}

/** Respaldo determinista cuando la integración externa no está configurada o falla. */
export function buildLocalAutomaticRoutine(input: AutomaticRoutineGenerationInput): GeneratedRoutineDraft {
  assertDomain(Array.isArray(input.restDays), 'restDays', 'Selecciona días de descanso válidos.');
  assertDomain(input.restDays.length <= 6, 'restDays', 'Selecciona como máximo 6 días de descanso.');
  assertDomain(new Set(input.restDays).size === input.restDays.length, 'restDays', 'No se pueden repetir días de descanso.');
  assertDomain(input.restDays.every((day) => ROUTINE_PLAN_DAYS.includes(day)), 'restDays', 'Selecciona días de descanso válidos.');
  assertDomain(Number.isInteger(input.sessionDurationMinutes) && input.sessionDurationMinutes >= 15 && input.sessionDurationMinutes <= 240, 'sessionDurationMinutes', 'La duración no es válida.');
  const restDays = new Set<RoutinePlanDayName>(input.restDays);
  const splits = TRAINING_SPLITS[input.goal];
  const exerciseCount = Math.max(2, Math.min(8, Math.round(input.sessionDurationMinutes / 15)));
  const dayLabels: Record<RoutinePlanDayName, string> = {
    lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
  };
  const days: RoutinePlanDayInput[] = ROUTINE_PLAN_DAYS.map((day, index) => {
    if (restDays.has(day)) {
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
    const timedExerciseCount = selected.filter(({ muscle }) => requiresDurationPrescription(muscle)).length;
    const allTimed = timedExerciseCount === selected.length;
    const timedBudget = input.sessionDurationMinutes * (allTimed ? 0.8 : 0.4);
    const timedDurationMinutes = timedExerciseCount
      ? Math.max(5, Math.floor(timedBudget / timedExerciseCount / 5) * 5)
      : 0;
    const exercises: RoutinePlanExerciseInput[] = selected.map(({ name, muscle }, exerciseIndex) => ({
      name,
      muscle,
      ...localExercisePrescription(input.goal, muscle, timedDurationMinutes),
      notes: requiresDurationPrescription(muscle)
        ? 'Mantén una intensidad sostenible y reduce el ritmo ante mareo, dolor o falta de control.'
        : exerciseIndex === 0 ? 'Realiza primero series progresivas de calentamiento sin llegar al fallo.' : 'Conserva una técnica estable y detén la serie si se pierde el control.',
    }));
    return {
      day,
      title: `${dayLabels[day]} · ${primary}${secondary !== primary ? ` y ${secondary}` : ''}`,
      focus: `Sesión de ${formatRoutineDuration(input.sessionDurationMinutes)} orientada a ${input.goal.replace('_', ' ')}.`,
      isRestDay: false,
      exercises,
    };
  });
  return {
    title: `Rutina semanal de ${input.goal.replace('_', ' ')}`,
    summary: `Plan de lunes a domingo para nivel ${input.level}, con ${input.restDays.length} ${input.restDays.length === 1 ? 'día' : 'días'} de descanso y sesiones aproximadas de ${formatRoutineDuration(input.sessionDurationMinutes)}.`,
    days,
    engine: 'local',
  };
}
