import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthUseCases } from '../../src/application/use-cases/auth';
import { createCalorieCalculation } from '../../src/domain/calories/calorie';
import { createDietPlan } from '../../src/domain/diet/diet';
import { createRoutineExercise } from '../../src/domain/routine/routine';
import {
  createSpecialistProfile,
  createSpecialistRequest,
} from '../../src/domain/specialists/specialist';
import { createPasswordUser } from '../../src/domain/users/user';
import { FileDataStore } from '../../src/infrastructure/persistence/file/file-data-store';
import { DataStoreCorruptionError } from '../../src/infrastructure/persistence/file/schema';

const temporaryDirectories: string[] = [];

async function createStore(): Promise<{ store: FileDataStore; directory: string; file: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'roman-colosseum-test-'));
  temporaryDirectories.push(directory);
  const file = join(directory, 'data.json');
  return { store: new FileDataStore(file), directory, file };
}

function user(id: string, email: string) {
  return createPasswordUser({
    id,
    name: `Usuario ${id}`,
    email,
    passwordHash: `hash-${id}`,
    birthDate: '1990-01-01',
    sex: 'prefiero no decirlo',
    now: '2026-08-05T12:00:00.000Z',
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('FileDataStore', () => {
  it('crea una sola vez el perfil reservado para acceso demo concurrente', async () => {
    const { store, file } = await createStore();
    let nextId = 0;
    const auth = new AuthUseCases(
      store,
      {
        hash: async () => 'hash-demo-no-utilizable',
        verify: async () => false,
      },
      { now: () => '2026-08-05T12:00:00.000Z' },
      { next: () => `secreto-${nextId += 1}` },
      { issue: () => ({ token: 'token', digest: 'a'.repeat(64) }), digest: () => 'a'.repeat(64) },
      null,
      'https://gym.example',
    );

    const [first, second] = await Promise.all([
      auth.getDemoUser(),
      auth.getDemoUser(),
    ]);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      id: 'demo-user-v1',
      name: 'Visitante',
      email: 'demo@roman-colosseum.invalid',
    });
    const persisted = JSON.parse(await readFile(file, 'utf8')) as { users: unknown[] };
    expect(persisted.users).toHaveLength(1);
  });

  it('mantiene unicidad de correo e identidad dentro de la cola', async () => {
    const { store } = await createStore();
    const first = user('user-1', 'uno@example.com');
    const duplicatedEmail = user('user-2', 'uno@example.com');

    const results = await Promise.all([
      store.create(first),
      store.create(duplicatedEmail),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.findByEmail('uno@example.com')).toMatchObject({ id: 'user-1' });
  });

  it('serializa escrituras concurrentes sin perder ejercicios ni dejar temporales', async () => {
    const { store, directory, file } = await createStore();
    const secondStore = new FileDataStore(file);
    await store.create(user('user-1', 'uno@example.com'));

    await Promise.all(Array.from({ length: 25 }, (_, index) => (
      index % 2 === 0 ? store : secondStore
    ).addRoutineExercise(
      createRoutineExercise({
        id: `exercise-${index}`,
        userId: 'user-1',
        day: index % 2 === 0 ? 'lunes' : 'martes',
        muscle: 'Pecho',
        name: `Press ${index}`,
        sets: 4,
        reps: '10',
        now: new Date(Date.UTC(2026, 7, 5, 12, 0, index)).toISOString(),
      }),
    )));

    expect(await store.listRoutine('user-1')).toHaveLength(25);
    const persisted = JSON.parse(await readFile(file, 'utf8')) as { schemaVersion: number; routineExercises: unknown[] };
    expect(persisted.schemaVersion).toBe(9);
    expect(persisted.routineExercises).toHaveLength(25);
    expect((await readdir(directory)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('aísla borrados, dieta, cálculos y resumen por propietario', async () => {
    const { store } = await createStore();
    await store.create(user('user-1', 'uno@example.com'));
    await store.create(user('user-2', 'dos@example.com'));
    await store.addRoutineExercise(createRoutineExercise({
      id: 'exercise-2',
      userId: 'user-2',
      day: 'viernes',
      muscle: 'Piernas',
      name: 'Sentadilla',
      sets: 5,
      reps: '5',
      now: '2026-08-05T12:00:00.000Z',
    }));

    expect(await store.deleteRoutineExercise('user-1', 'exercise-2')).toBe(false);
    expect(await store.listRoutine('user-2')).toHaveLength(1);

    await store.saveDiet(createDietPlan({
      id: 'diet-1',
      userId: 'user-1',
      goal: 'mantener',
      preference: 'general',
      meals: 3,
      now: '2026-08-05T12:00:00.000Z',
    }));
    for (let index = 0; index < 12; index += 1) {
      await store.addCalorieCalculation(createCalorieCalculation({
        id: `calculation-${index}`,
        userId: 'user-1',
        age: 30,
        sex: 'female',
        weightKg: 65,
        heightCm: 165,
        activityFactor: 1.55,
        now: new Date(Date.UTC(2026, 7, 5, 12, 0, index)).toISOString(),
      }), 10);
    }

    expect(await store.listCalorieCalculations('user-1')).toHaveLength(10);
    expect(await store.getSummary('user-1')).toEqual({
      exerciseCount: 0,
      hasDiet: true,
      calorieCalculationCount: 10,
    });
    expect(await store.getSummary('user-2')).toEqual({
      exerciseCount: 1,
      hasDiet: false,
      calorieCalculationCount: 0,
    });
  });

  it('elimina solo el cálculo del propietario y conserva las dietas relacionadas', async () => {
    const { store } = await createStore();
    await store.create(user('user-1', 'uno@example.com'));
    await store.create(user('user-2', 'dos@example.com'));
    const calculation = createCalorieCalculation({
      id: 'calculation-1',
      userId: 'user-1',
      age: 30,
      sex: 'female',
      weightKg: 65,
      heightCm: 165,
      activityFactor: 1.55,
      now: '2026-08-05T12:00:00.000Z',
    });
    await store.addCalorieCalculation(calculation, 10);
    await store.saveDiet(createDietPlan({
      id: 'diet-1',
      userId: 'user-1',
      goal: 'mantener',
      preference: 'general',
      meals: 3,
      calorieCalculationId: calculation.id,
      now: '2026-08-05T12:01:00.000Z',
    }));

    expect(await store.deleteCalorieCalculation('user-2', calculation.id)).toBe(false);
    expect(await store.listCalorieCalculations('user-1')).toHaveLength(1);
    expect(await store.deleteCalorieCalculation('user-1', calculation.id)).toBe(true);
    expect(await store.listCalorieCalculations('user-1')).toEqual([]);
    expect(await store.getDiet('user-1')).toMatchObject({ calorieCalculationId: null });
  });

  it('conserva un único id y createdAt ante reemplazos concurrentes de dieta', async () => {
    const { store, file } = await createStore();
    const secondStore = new FileDataStore(file);
    await store.create(user('user-1', 'uno@example.com'));
    const first = createDietPlan({
      id: 'diet-first',
      userId: 'user-1',
      goal: 'ganar',
      preference: 'general',
      meals: 5,
      now: '2026-08-05T12:00:00.000Z',
    });
    const second = createDietPlan({
      id: 'diet-second',
      userId: 'user-1',
      goal: 'perder',
      preference: 'rapida',
      meals: 3,
      now: '2026-08-05T12:01:00.000Z',
    });

    const [firstResult, secondResult] = await Promise.all([
      store.saveDiet(first),
      secondStore.saveDiet(second),
    ]);

    expect(firstResult.id).toBe('diet-first');
    expect(secondResult).toMatchObject({
      id: 'diet-first',
      createdAt: first.createdAt,
      goal: 'perder',
    });
    expect(await store.getDiet('user-1')).toEqual(secondResult);
  });

  it('rechaza una base corrupta sin sustituirla silenciosamente', async () => {
    const { store, file } = await createStore();
    const corruptSource = '{"schemaVersion":1,"users":"no-es-un-array"}';
    await writeFile(file, corruptSource, 'utf8');

    await expect(store.findById('user-1')).rejects.toBeInstanceOf(DataStoreCorruptionError);
    expect(await readFile(file, 'utf8')).toBe(corruptSource);
  });

  it('reserva de forma atómica un solo especialista por usuario y rol', async () => {
    const { store } = await createStore();
    await store.create(user('specialist-1', 'especialista@example.com'));
    await store.create(user('client-1', 'cliente@example.com'));
    const now = '2026-08-05T12:00:00.000Z';
    const profile = createSpecialistProfile({
      id: 'profile-1',
      userId: 'specialist-1',
      presentation: 'Acompaño procesos de entrenamiento con objetivos claros y seguimiento constante.',
      experience: 'Cinco años diseñando programas progresivos de fuerza y movilidad.',
      roles: ['trainer', 'nutritionist'],
      photo: {
        id: 'photo-1', storageKey: 'photo-1.png', originalName: 'foto.png',
        mimeType: 'image/png', sizeBytes: 128, createdAt: now,
      },
      certificates: [],
      now,
    });
    expect(await store.createSpecialistProfile(profile)).toBe(true);

    const first = createSpecialistRequest({
      id: 'request-1', clientUserId: 'client-1', specialistUserId: 'specialist-1',
      specialistProfileId: profile.id, role: 'trainer', now,
    });
    const second = createSpecialistRequest({
      id: 'request-2', clientUserId: 'client-1', specialistUserId: 'specialist-1',
      specialistProfileId: profile.id, role: 'trainer', now,
    });
    const results = await Promise.all([
      store.createSpecialistRequest(first),
      store.createSpecialistRequest(second),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.listSpecialistRequestsByClient('client-1')).toHaveLength(1);
  });
});
