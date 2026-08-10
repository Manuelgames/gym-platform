import { createHash } from 'node:crypto';
import {
  buildLocalAutomaticDiet,
  createDietPlan,
  DIET_PORTION_UNITS,
  type AutomaticDietGenerationInput,
  type GeneratedDietDraft,
} from '../../domain/diet/diet';
import type { DietGenerator } from '../../application/ports/services';

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

const ingredientSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    amount: { type: 'number' },
    unit: { type: 'string', enum: [...DIET_PORTION_UNITS] },
    note: { type: 'string' },
  },
  required: ['name', 'amount', 'unit', 'note'],
} as const;

function responseSchema(mealCount: number) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      nutrition: {
        type: 'object',
        additionalProperties: false,
        properties: {
          caloriesKcal: { type: 'number' },
          proteinG: { type: 'number' },
          carbsG: { type: 'number' },
          fatG: { type: 'number' },
        },
        required: ['caloriesKcal', 'proteinG', 'carbsG', 'fatG'],
      },
      entries: {
        type: 'array',
        minItems: mealCount,
        maxItems: mealCount,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            time: { type: 'string' },
            ingredients: {
              type: 'array',
              minItems: 1,
              maxItems: 20,
              items: ingredientSchema,
            },
            preparation: { type: 'string' },
            notes: { type: 'string' },
            estimatedCaloriesKcal: { type: 'number' },
          },
          required: [
            'type',
            'title',
            'time',
            'ingredients',
            'preparation',
            'notes',
            'estimatedCaloriesKcal',
          ],
        },
      },
    },
    required: ['title', 'summary', 'nutrition', 'entries'],
  } as const;
}

/**
 * Genera un plan con Responses API y salida JSON estricta.
 *
 * La ausencia de credencial o un fallo externo conserva la experiencia mediante
 * el generador local; el plan persistido identifica cuál motor produjo el dato.
 */
export class OpenAIDietGenerator implements DietGenerator {
  constructor(
    private readonly apiKey: string | null,
    private readonly model: string,
  ) {}

  async generate(
    input: AutomaticDietGenerationInput & { safetyIdentifier: string },
  ): Promise<GeneratedDietDraft> {
    const local = () => buildLocalAutomaticDiet(input);
    if (!this.apiKey) return local();

    try {
      const preferenceLabels = {
        general: 'alimentación general variada',
        vegetariana: 'vegetariana, admite huevo y lácteos',
        vegana: 'vegana, sin productos de origen animal',
        pescetariana: 'pescetariana',
        sin_lactosa: 'sin lactosa',
        rapida: 'preparaciones rápidas con ingredientes comunes',
      } as const;
      const goalLabels = {
        ganar: 'ganar fuerza y masa muscular de forma gradual',
        mantener: 'mantener peso, energía y rendimiento',
        perder: 'reducir grasa mediante un déficit moderado',
      } as const;
      const payload = {
        model: this.model,
        store: false,
        safety_identifier: createHash('sha256').update(input.safetyIdentifier).digest('hex'),
        input: [
          {
            role: 'system',
            content: [
              'Eres un asistente de planificación alimentaria educativa para adultos sanos.',
              'Crea un día de alimentación práctico con cantidades métricas explícitas.',
              'No diagnostiques, no trates enfermedades, no prometas resultados y no incluyas suplementos.',
              'No presentes el resultado como prescripción médica. Usa alimentos comunes en México.',
              'Respeta exactamente el número de comidas y la preferencia indicados.',
              'Distribuye las calorías de manera coherente y usa gramos o mililitros cuando sea posible.',
              'Asigna a cada comida un horario práctico y distinto en formato HH:mm de 24 horas.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              perfil: {
                edad: input.age,
                sexoParaFormula: input.sex,
                pesoKg: input.weightKg,
                alturaCm: input.heightCm,
                mantenimientoKcal: input.maintenanceCalories,
              },
              objetivo: goalLabels[input.goal],
              preferencia: preferenceLabels[input.preference],
              comidasPorDia: input.requestedMeals,
              objetivoEnergeticoKcal: input.targetCalories,
              idioma: 'es-MX',
            }),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'personalized_diet_plan',
            description: 'Plan alimentario diario con comidas, porciones y objetivos aproximados.',
            strict: true,
            schema: responseSchema(input.requestedMeals),
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
      const validated = createDietPlan({
        id: 'validation-plan',
        userId: 'validation-user',
        source: 'ai',
        goal: input.goal,
        preference: input.preference,
        requestedMeals: input.requestedMeals,
        title: typeof candidate.title === 'string' ? candidate.title : '',
        summary: typeof candidate.summary === 'string' ? candidate.summary : '',
        entries: Array.isArray(candidate.entries) ? candidate.entries : [],
        nutrition: candidate.nutrition as GeneratedDietDraft['nutrition'],
        calorieCalculationId: 'validation-calculation',
        generationEngine: 'openai',
        now: new Date(0).toISOString(),
      });
      return {
        title: validated.title,
        summary: validated.summary,
        nutrition: validated.nutrition!,
        entries: validated.entries,
        engine: 'openai',
      };
    } catch (error) {
      console.warn('No fue posible generar la dieta con el proveedor de IA; se usará el motor local.', {
        reason: error instanceof Error ? error.message : 'Error desconocido',
      });
      return local();
    }
  }
}
