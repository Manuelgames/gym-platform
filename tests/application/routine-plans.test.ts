import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RoutineUseCases } from '../../src/application/use-cases/routine';
import {
  buildLocalAutomaticRoutine,
  ROUTINE_PLAN_DAYS,
  type RoutinePlanDayInput,
} from '../../src/domain/routine/routine';
import { createSpecialistProfile, createSpecialistRequest } from '../../src/domain/specialists/specialist';
import { createPasswordUser } from '../../src/domain/users/user';
import { FileDataStore } from '../../src/infrastructure/persistence/file/file-data-store';

const directories: string[] = [];
const now = '2026-08-07T12:00:00.000Z';

function user(id: string) {
  return createPasswordUser({
    id, name: `Usuario ${id}`, email: `${id}@example.com`, passwordHash: `hash-${id}`,
    birthDate: '1990-01-01', sex: 'prefiero no decirlo', now,
  });
}

function editableDays(): RoutinePlanDayInput[] {
  return ROUTINE_PLAN_DAYS.map((day, index) => ({
    day,
    title: index === 5 ? 'Descanso y recuperación' : `Sesión ${index + 1}`,
    focus: index === 5 ? 'Recuperación' : 'Técnica y progresión',
    isRestDay: index === 5,
    exercises: index === 5 ? [] : [{
      name: `Ejercicio ${index + 1}`, muscle: index % 2 ? 'Espalda' : 'Pecho',
      prescriptionType: 'repetitions', sets: 3, reps: '8-12', durationMinutes: null,
      restSeconds: 90, tempo: '3-1-1', notes: 'Técnica controlada.',
    }],
  }));
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'roman-routine-plan-test-'));
  directories.push(directory);
  const store = new FileDataStore(join(directory, 'data.json'));
  let id = 0;
  const useCases = new RoutineUseCases(
    store,
    store,
    store,
    { generate: async (input) => buildLocalAutomaticRoutine(input) },
    { now: () => now },
    { next: () => `routine-id-${id += 1}` },
  );
  return { store, useCases };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('modalidades de rutina', () => {
  it('genera exactamente de lunes a domingo, respeta descansos y cubre los grupos anunciados', async () => {
    const { store, useCases } = await fixture();
    await store.create(user('client-1'));
    const plan = await useCases.generate('client-1', {
      goal: 'hipertrofia', level: 'intermedio', location: 'gimnasio',
      sessionDurationMinutes: 60, restDays: ['miercoles', 'sabado'],
    });

    expect(plan).toMatchObject({ source: 'ai', generationEngine: 'local', goal: 'hipertrofia' });
    expect(plan.days.map((day) => day.day)).toEqual([...ROUTINE_PLAN_DAYS]);
    expect(plan.days.filter((day) => day.isRestDay).map((day) => day.day))
      .toEqual(['miercoles', 'sabado']);
    for (const day of plan.days.filter((candidate) => !candidate.isRestDay)) {
      const groups = new Set(day.exercises.map((exercise) => exercise.muscle));
      expect(groups.size).toBeGreaterThanOrEqual(2);
      for (const group of groups) expect(day.title).toContain(group);
    }
    expect(plan.days.filter((day) => !day.isRestDay).every((day) => day.exercises.length > 0)).toBe(true);
    const timedExercises = plan.days.flatMap((day) => day.exercises)
      .filter((exercise) => exercise.muscle === 'Cardio' || exercise.muscle === 'Acondicionamiento');
    expect(timedExercises.length).toBeGreaterThan(0);
    expect(timedExercises.every((exercise) => (
      exercise.prescriptionType === 'duration'
      && exercise.durationMinutes !== null
      && exercise.sets === null
      && exercise.reps === ''
    ))).toBe(true);
    expect(plan.availableEquipment).toBe('');
    expect(await store.getRoutinePlan('client-1', 'ai')).toEqual(plan);
  });

  it('mantiene la rutina manual separada de la automática', async () => {
    const { store, useCases } = await fixture();
    await store.create(user('client-1'));
    const plan = await useCases.saveManual('client-1', {
      title: 'Mi semana', summary: 'Rutina personal.', goal: 'general', level: 'principiante',
      location: 'casa', sessionDurationMinutes: 45,
      days: editableDays(),
    });

    expect(plan).toMatchObject({ source: 'manual', authorUserId: 'client-1', generationEngine: 'manual' });
    expect(await store.getRoutinePlan('client-1', 'manual')).toEqual(plan);
    expect(await store.getRoutinePlan('client-1', 'ai')).toBeNull();
  });

  it('conserva versiones anteriores, permite reutilizarlas y protege la rutina vigente', async () => {
    const { store, useCases } = await fixture();
    await store.create(user('client-1'));
    const first = await useCases.generate('client-1', {
      title: 'Rutina inicial', goal: 'fuerza', level: 'principiante', location: 'casa',
      sessionDurationMinutes: 45, restDays: ['domingo'],
    });
    const second = await useCases.generate('client-1', {
      title: 'Rutina actual', goal: 'resistencia', level: 'intermedio', location: 'gimnasio',
      sessionDurationMinutes: 60, restDays: ['miercoles', 'sabado'],
    });

    expect((await useCases.getPlan('client-1', 'ai'))?.id).toBe(second.id);
    expect(await useCases.getHistory('client-1', 'ai')).toEqual([first]);

    const restored = await useCases.reuse('client-1', first.id);
    expect(restored).toMatchObject({ title: 'Rutina inicial', source: 'ai' });
    expect(restored.id).not.toBe(first.id);
    expect((await useCases.getPlan('client-1', 'ai'))?.id).toBe(restored.id);

    await useCases.deleteFromHistory('client-1', second.id);
    expect((await useCases.getHistory('client-1', 'ai')).map((plan) => plan.id)).toEqual([first.id]);
    await expect(useCases.deleteFromHistory('client-1', restored.id))
      .rejects.toEqual(expect.objectContaining({ code: 'ROUTINE_CURRENT_DELETE_FORBIDDEN' }));
  });

  it('solo permite al entrenador aceptado asignar la rutina profesional', async () => {
    const { store, useCases } = await fixture();
    await store.create(user('client-1'));
    await store.create(user('trainer-1'));
    await store.create(user('intruder-1'));
    const profile = createSpecialistProfile({
      id: 'profile-1', userId: 'trainer-1',
      presentation: 'Entrenamiento individual con planificación semanal y seguimiento técnico.',
      experience: 'Experiencia profesional creando progresiones de fuerza y condición física.',
      roles: ['trainer'],
      photo: { id: 'photo-1', storageKey: 'photo-1.png', originalName: 'foto.png', mimeType: 'image/png', sizeBytes: 120, createdAt: now },
      certificates: [], now,
    });
    await store.createSpecialistProfile(profile);
    const request = createSpecialistRequest({
      id: 'request-1', clientUserId: 'client-1', specialistUserId: 'trainer-1',
      specialistProfileId: profile.id, role: 'trainer', now,
    });
    await store.createSpecialistRequest(request);
    await store.updateSpecialistRequest({ ...request, status: 'accepted' }, 'pending');
    const input = {
      title: 'Plan del entrenador', summary: 'Progresión profesional.', goal: 'fuerza', level: 'intermedio',
      location: 'gimnasio', sessionDurationMinutes: 75,
      days: editableDays(),
    };

    await expect(useCases.saveSpecialist('intruder-1', request.id, input))
      .rejects.toEqual(expect.objectContaining({ code: 'TRAINING_RELATION_REQUIRED' }));
    const plan = await useCases.saveSpecialist('trainer-1', request.id, input);
    expect(plan).toMatchObject({
      source: 'specialist', userId: 'client-1', authorUserId: 'trainer-1',
      specialistRequestId: 'request-1', generationEngine: 'specialist',
    });
    expect((await useCases.getTrainingClient('trainer-1', request.id)).plan).toEqual(plan);
  });
});
