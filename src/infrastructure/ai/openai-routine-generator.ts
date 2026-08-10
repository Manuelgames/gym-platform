import { createHash } from 'node:crypto';
import type { RoutineGenerator } from '../../application/ports/services';
import {
  buildLocalAutomaticRoutine,
  createRoutinePlan,
  hasConsistentMuscleCoverage,
  MUSCLE_GROUPS,
  ROUTINE_PLAN_DAYS,
  type AutomaticRoutineGenerationInput,
  type GeneratedRoutineDraft,
} from '../../domain/routine/routine';

interface OpenAIResponseBody {
  output_text?: unknown;
  output?: unknown;
}

function extractOutputText(body: OpenAIResponseBody): string | null {
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text;
  if (!Array.isArray(body.output)) return null;
  for (const item of body.output) {
    if (typeof item !== 'object' || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const candidate = part as { type?: unknown; text?: unknown };
      if (candidate.type === 'output_text' && typeof candidate.text === 'string') return candidate.text;
    }
  }
  return null;
}

const exerciseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    muscle: { type: 'string', enum: [...MUSCLE_GROUPS] },
    sets: { type: 'integer', minimum: 1, maximum: 30 },
    reps: { type: 'string' },
    restSeconds: { type: 'integer', minimum: 0, maximum: 900 },
    tempo: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['name', 'muscle', 'sets', 'reps', 'restSeconds', 'tempo', 'notes'],
} as const;

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    days: {
      type: 'array',
      minItems: ROUTINE_PLAN_DAYS.length,
      maxItems: ROUTINE_PLAN_DAYS.length,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'string', enum: [...ROUTINE_PLAN_DAYS] },
          title: { type: 'string' },
          focus: { type: 'string' },
          isRestDay: { type: 'boolean' },
          exercises: { type: 'array', minItems: 0, maxItems: 20, items: exerciseSchema },
        },
        required: ['day', 'title', 'focus', 'isRestDay', 'exercises'],
      },
    },
  },
  required: ['title', 'summary', 'days'],
} as const;

/** Genera rutinas con Responses API y conserva un respaldo local determinista. */
export class OpenAIRoutineGenerator implements RoutineGenerator {
  constructor(
    private readonly apiKey: string | null,
    private readonly model: string,
  ) {}

  async generate(
    input: AutomaticRoutineGenerationInput & { safetyIdentifier: string },
  ): Promise<GeneratedRoutineDraft> {
    const local = () => buildLocalAutomaticRoutine(input);
    if (!this.apiKey) return local();

    try {
      const payload = {
        model: this.model,
        store: false,
        safety_identifier: createHash('sha256').update(input.safetyIdentifier).digest('hex'),
        input: [
          {
            role: 'system',
            content: [
              'Eres un asistente de planificación de entrenamiento físico educativo para adultos.',
              'Crea exactamente una semana de lunes a domingo en español de México.',
              'Respeta el objetivo, nivel, ubicación, equipo, duración y número exacto de días de descanso.',
              'Los días de descanso deben tener exercises vacío; todos los demás días deben incluir ejercicios.',
              'En cada día activo, title debe nombrar todos y solamente los grupos musculares que se entrenan usando los nombres permitidos del campo muscle.',
              'Incluye al menos un ejercicio para cada grupo muscular nombrado en title y no agregues ejercicios de grupos que el título no anuncie.',
              'Usa progresiones razonables, técnica conservadora y descansos expresados en segundos.',
              'No diagnostiques lesiones, no prescribas rehabilitación y no prometas resultados.',
              'Si existen limitaciones declaradas, evita movimientos incompatibles y recomienda valoración profesional cuando corresponda.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              objetivo: input.goal,
              nivel: input.level,
              lugar: input.location,
              duracionPorSesionMinutos: input.sessionDurationMinutes,
              diasDeDescansoEntreLunesYDomingo: input.restDaysCount,
              equipoDisponible: input.availableEquipment || 'No especificado',
              consideracionesDeclaradas: input.limitations || 'Ninguna',
              idioma: 'es-MX',
            }),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'personalized_weekly_routine',
            description: 'Rutina de lunes a domingo con cobertura verificable de cada grupo muscular anunciado.',
            strict: true,
            schema: responseSchema,
          },
        },
      };
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(35_000),
      });
      if (!response.ok) throw new Error(`OpenAI respondió con estado ${response.status}.`);
      const body = await response.json() as OpenAIResponseBody;
      const outputText = extractOutputText(body);
      if (!outputText) throw new Error('OpenAI no devolvió contenido estructurado.');
      const candidate = JSON.parse(outputText) as Record<string, unknown>;
      const validated = createRoutinePlan({
        id: 'validation-routine',
        userId: 'validation-user',
        source: 'ai',
        title: typeof candidate.title === 'string' ? candidate.title : '',
        summary: typeof candidate.summary === 'string' ? candidate.summary : '',
        goal: input.goal,
        level: input.level,
        location: input.location,
        sessionDurationMinutes: input.sessionDurationMinutes,
        availableEquipment: input.availableEquipment,
        limitations: input.limitations,
        days: Array.isArray(candidate.days) ? candidate.days : [],
        generationEngine: 'openai',
        now: new Date(0).toISOString(),
      });
      const restDays = validated.days.filter((day) => day.isRestDay).length;
      if (restDays !== input.restDaysCount) {
        throw new Error('La respuesta no respetó el número solicitado de días de descanso.');
      }
      if (!validated.days.every(hasConsistentMuscleCoverage)) {
        throw new Error('La respuesta no incluyó ejercicios para todos los grupos musculares anunciados.');
      }
      return {
        title: validated.title,
        summary: validated.summary,
        days: validated.days,
        engine: 'openai',
      };
    } catch (error) {
      console.warn('No fue posible generar la rutina con el proveedor de IA; se usará el motor local.', {
        reason: error instanceof Error ? error.message : 'Error desconocido',
      });
      return local();
    }
  }
}
