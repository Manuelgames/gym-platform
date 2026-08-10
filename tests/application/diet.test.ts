import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DietUseCases } from '../../src/application/use-cases/diet';
import { createCalorieCalculation } from '../../src/domain/calories/calorie';
import {
  buildLocalAutomaticDiet,
  type AutomaticDietGenerationInput,
} from '../../src/domain/diet/diet';
import {
  createSpecialistProfile,
  createSpecialistRequest,
} from '../../src/domain/specialists/specialist';
import { createPasswordUser } from '../../src/domain/users/user';
import { FileDataStore } from '../../src/infrastructure/persistence/file/file-data-store';

const directories: string[] = [];
const now = '2026-08-07T12:00:00.000Z';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'roman-diet-test-'));
  directories.push(directory);
  const store = new FileDataStore(join(directory, 'data.json'));
  let nextId = 0;
  let receivedGenerationInput: AutomaticDietGenerationInput | null = null;
  const useCases = new DietUseCases(
    store,
    store,
    store,
    {
      generate: async (input) => {
        receivedGenerationInput = input;
        return buildLocalAutomaticDiet(input);
      },
    },
    { now: () => now },
    { next: () => `diet-id-${nextId += 1}` },
  );
  return { store, useCases, received: () => receivedGenerationInput };
}

function user(id: string) {
  return createPasswordUser({
    id,
    name: `Usuario ${id}`,
    email: `${id}@example.com`,
    passwordHash: `hash-${id}`,
    birthDate: '1990-01-01',
    sex: 'prefiero no decirlo',
    now,
  });
}

function editableMeals(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    type: index === 0 ? 'Desayuno' : `Colación ${index}`,
    title: `Comida personalizada ${index + 1}`,
    time: '',
    ingredients: [{ name: 'Avena', amount: 60 + index, unit: 'g', note: 'Peso en seco' }],
    preparation: 'Mezclar y servir.',
    notes: '',
    estimatedCaloriesKcal: 250,
  }));
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('modalidades de dieta', () => {
  it('bloquea la generación automática hasta tener peso, altura y edad calculados', async () => {
    const { store, useCases } = await fixture();
    await store.create(user('client-1'));

    await expect(useCases.save('client-1', {
      goal: 'mantener', preference: 'general', meals: 4,
    })).rejects.toEqual(expect.objectContaining({ code: 'CALORIE_PROFILE_REQUIRED' }));
  });

  it('usa el último cálculo del servidor y persiste porciones estructuradas', async () => {
    const { store, useCases, received } = await fixture();
    await store.create(user('client-1'));
    await store.addCalorieCalculation(createCalorieCalculation({
      id: 'calculation-1', userId: 'client-1', age: 31, sex: 'male',
      weightKg: 82, heightCm: 181, activityFactor: 1.55, now,
    }), 10);

    const result = await useCases.save('client-1', {
      goal: 'ganar', preference: 'general', meals: 6,
    });

    expect(received()).toMatchObject({ age: 31, weightKg: 82, heightCm: 181, requestedMeals: 6 });
    expect(result.plan).toMatchObject({ source: 'ai', calorieCalculationId: 'calculation-1', requestedMeals: 6 });
    expect(result.plan.entries).toHaveLength(6);
    expect(result.plan.entries[0]?.ingredients[0]).toMatchObject({ amount: expect.any(Number), unit: 'g' });
    expect(result.plan.entries.every((entry) => /^\d{2}:\d{2}$/.test(entry.time))).toBe(true);
    expect(new Set(result.plan.entries.map((entry) => entry.time)).size).toBe(6);
  });

  it('permite una dieta manual con más de cinco comidas sin mezclarla con la automática', async () => {
    const { store, useCases } = await fixture();
    await store.create(user('client-1'));

    const result = await useCases.saveManual('client-1', {
      title: 'Mi día de siete comidas', summary: 'Organización personal.',
      goal: 'mantener', preference: 'general', entries: editableMeals(7),
    });

    expect(result.plan).toMatchObject({ source: 'manual', requestedMeals: 7, generationEngine: 'manual' });
    expect(await store.getDiet('client-1', 'manual')).toEqual(result.plan);
    expect(await store.getDiet('client-1', 'ai')).toBeNull();
  });

  it('solo permite al nutricionista aceptado asignar el documento profesional', async () => {
    const { store, useCases } = await fixture();
    await store.create(user('client-1'));
    await store.create(user('nutritionist-1'));
    await store.create(user('intruder-1'));
    const profile = createSpecialistProfile({
      id: 'profile-1', userId: 'nutritionist-1',
      presentation: 'Acompaño procesos nutricionales con objetivos claros y seguimiento continuo.',
      experience: 'Formación profesional y experiencia diseñando planes alimentarios personalizados.',
      roles: ['nutritionist'],
      photo: {
        id: 'photo-1', storageKey: 'photo-1.png', originalName: 'foto.png',
        mimeType: 'image/png', sizeBytes: 120, createdAt: now,
      },
      certificates: [], now,
    });
    await store.createSpecialistProfile(profile);
    const request = createSpecialistRequest({
      id: 'request-1', clientUserId: 'client-1', specialistUserId: 'nutritionist-1',
      specialistProfileId: profile.id, role: 'nutritionist', now,
    });
    await store.createSpecialistRequest(request);
    await store.updateSpecialistRequest({ ...request, status: 'accepted' }, 'pending');
    const input = {
      title: 'Plan profesional', summary: 'Plan elaborado durante la asesoría.',
      goal: 'mantener', preference: 'general', entries: editableMeals(5),
    };

    await expect(useCases.saveSpecialist('intruder-1', request.id, input))
      .rejects.toEqual(expect.objectContaining({ code: 'NUTRITION_RELATION_REQUIRED' }));
    const result = await useCases.saveSpecialist('nutritionist-1', request.id, input);

    expect(result.plan).toMatchObject({
      source: 'specialist', userId: 'client-1', authorUserId: 'nutritionist-1',
      specialistRequestId: 'request-1', generationEngine: 'specialist',
    });
    expect((await useCases.getNutritionClient('nutritionist-1', request.id)).plan).toEqual(result.plan);
  });
});
