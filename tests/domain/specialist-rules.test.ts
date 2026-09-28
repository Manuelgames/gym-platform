import { describe, expect, it } from 'vitest';
import {
  createSpecialistProfile,
  createSpecialistRequest,
  hasActiveSpecialistRole,
  transitionSpecialistRequest,
} from '../../src/domain/specialists/specialist';
import { createPasswordUser } from '../../src/domain/users/user';
import { DomainValidationError } from '../../src/domain/shared/errors';
import { createRoutineExercise, createRoutinePlan, ROUTINE_PLAN_DAYS } from '../../src/domain/routine/routine';
import { parsePersistedDatabase } from '../../src/infrastructure/persistence/file/schema';

const now = '2026-08-05T12:00:00.000Z';

function profile() {
  return createSpecialistProfile({
    id: 'profile-1',
    userId: 'specialist-1',
    presentation: 'Acompaño a cada persona con un plan comprensible, progresivo y medible.',
    experience: 'Experiencia profesional en entrenamiento y educación nutricional responsable.',
    roles: ['trainer', 'nutritionist'],
    photo: {
      id: 'photo-1', storageKey: 'photo-1.webp', originalName: 'perfil.webp',
      mimeType: 'image/webp', sizeBytes: 512, createdAt: now,
    },
    certificates: [{
      id: 'certificate-1', storageKey: 'certificate-1.pdf', originalName: 'certificado.pdf',
      mimeType: 'application/pdf', sizeBytes: 1_024, createdAt: now,
    }],
    now,
  });
}

describe('reglas de especialistas', () => {
  it('permite activar simultáneamente entrenamiento y nutrición con un solo ID', () => {
    const result = profile();
    expect(result.id).toBe('profile-1');
    expect(hasActiveSpecialistRole(result, 'trainer')).toBe(true);
    expect(hasActiveSpecialistRole(result, 'nutritionist')).toBe(true);
  });

  it('rechaza perfiles sin rol y solicitudes al propio especialista', () => {
    expect(() => createSpecialistProfile({
      ...profile(),
      roles: [],
      now,
    })).toThrow(expect.objectContaining({ field: 'roles' }));
    expect(() => createSpecialistRequest({
      id: 'request-1', clientUserId: 'same-user', specialistUserId: 'same-user',
      specialistProfileId: 'profile-1', role: 'trainer', now,
    })).toThrow(DomainValidationError);
  });

  it('separa pendientes, aceptadas y cerradas mediante transiciones autorizadas', () => {
    const pending = createSpecialistRequest({
      id: 'request-1', clientUserId: 'client-1', specialistUserId: 'specialist-1',
      specialistProfileId: 'profile-1', role: 'nutritionist', now,
    });
    const accepted = transitionSpecialistRequest(
      pending,
      'accept',
      'specialist-1',
      '2026-08-05T13:00:00.000Z',
    );
    expect(accepted.status).toBe('accepted');
    expect(transitionSpecialistRequest(
      accepted,
      'close',
      'specialist-1',
      '2026-08-06T13:00:00.000Z',
    ).status).toBe('closed');
    expect(() => transitionSpecialistRequest(pending, 'accept', 'client-1', now))
      .toThrow(DomainValidationError);
  });
});

describe('migración del documento', () => {
  it('convierte v1 a v9 preservando datos y agregando el perfil personal', () => {
    const user = createPasswordUser({
      id: 'user-1', name: 'Usuario', email: 'usuario@example.com',
      passwordHash: 'hash', birthDate: '1990-01-01', sex: 'prefiero no decirlo', now,
    });
    const { profilePhoto: _profilePhoto, ...legacyUser } = user;
    const migrated = parsePersistedDatabase({
      schemaVersion: 1,
      users: [legacyUser],
      routineExercises: [],
      dietPlans: [],
      calorieCalculations: [],
    });
    expect(migrated).toMatchObject({
      schemaVersion: 9,
      users: [{ id: 'user-1', profilePhoto: null }],
      specialistProfiles: [],
      specialistRequests: [],
    });
  });

  it('convierte v2 a v9 sin perder las colecciones profesionales', () => {
    const user = createPasswordUser({
      id: 'user-1', name: 'Usuario', email: 'usuario@example.com',
      passwordHash: 'hash', birthDate: '1990-01-01', sex: 'prefiero no decirlo', now,
    });
    const { profilePhoto: _profilePhoto, ...legacyUser } = user;
    const migrated = parsePersistedDatabase({
      schemaVersion: 2,
      users: [legacyUser],
      routineExercises: [], dietPlans: [], calorieCalculations: [],
      specialistProfiles: [], specialistRequests: [],
    });

    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.users[0]?.profilePhoto).toBeNull();
  });

  it('convierte el selector dietario v3 en un documento automático con porciones', () => {
    const legacyUser = createPasswordUser({
      id: 'user-1', name: 'Usuario', email: 'usuario@example.com',
      passwordHash: 'hash', birthDate: '1990-01-01', sex: 'prefiero no decirlo', now,
    });
    const migrated = parsePersistedDatabase({
      schemaVersion: 3,
      users: [legacyUser],
      routineExercises: [],
      dietPlans: [{
        id: 'diet-legacy', userId: 'user-1', goal: 'mantener',
        preference: 'general', meals: 4, createdAt: now, updatedAt: now,
      }],
      calorieCalculations: [], specialistProfiles: [], specialistRequests: [],
    });

    expect(migrated.dietPlans[0]).toMatchObject({
      id: 'diet-legacy', userId: 'user-1', authorUserId: 'user-1',
      source: 'ai', requestedMeals: 4, generationEngine: 'local',
      calorieCalculationId: null,
    });
    expect(migrated.dietPlans[0]?.entries).toHaveLength(4);
    expect(migrated.dietPlans[0]?.entries[0]?.ingredients[0]).toMatchObject({
      amount: 1, unit: 'porcion',
    });
  });

  it('convierte v4 a v9 y recupera los ejercicios anteriores como rutina manual', () => {
    const legacyUser = createPasswordUser({
      id: 'user-1', name: 'Usuario', email: 'usuario@example.com',
      passwordHash: 'hash', birthDate: '1990-01-01', sex: 'prefiero no decirlo', now,
    });
    const exercise = createRoutineExercise({
      id: 'exercise-1', userId: 'user-1', day: 'lunes', muscle: 'Pecho',
      name: 'Press de banca', sets: 4, reps: '8-10', notes: 'Técnica controlada', now,
    });
    const migrated = parsePersistedDatabase({
      schemaVersion: 4,
      users: [legacyUser], routineExercises: [exercise], dietPlans: [], calorieCalculations: [],
      specialistProfiles: [], specialistRequests: [],
    });

    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.routineExercises).toEqual([exercise]);
    expect(migrated.routinePlans[0]).toMatchObject({
      userId: 'user-1', source: 'manual', generationEngine: 'manual',
    });
    expect(migrated.routinePlans[0]?.days[0]).toMatchObject({ day: 'lunes', isRestDay: false });
    expect(migrated.routinePlans[0]?.days[0]?.exercises[0]).toMatchObject({
      name: 'Press de banca', prescriptionType: 'repetitions', sets: 4,
      reps: '8-10', durationMinutes: null, restSeconds: 90,
    });
    expect(migrated.routinePlans[0]?.days.at(-1)).toMatchObject({ day: 'domingo', isRestDay: true });
  });

  it('amplía una rutina v5 al domingo sin modificar sus seis sesiones', () => {
    const user = createPasswordUser({
      id: 'user-1', name: 'Usuario', email: 'usuario@example.com',
      passwordHash: 'hash', birthDate: '1990-01-01', sex: 'prefiero no decirlo', now,
    });
    const plan = createRoutinePlan({
      id: 'routine-1', userId: user.id, source: 'manual', title: 'Rutina anterior',
      goal: 'general', level: 'intermedio', location: 'gimnasio', sessionDurationMinutes: 60,
      generationEngine: 'manual', now,
      days: ROUTINE_PLAN_DAYS.map((day) => ({
        day, title: day === 'lunes' ? 'Pecho' : 'Descanso', focus: '',
        isRestDay: day !== 'lunes',
        exercises: day === 'lunes' ? [{ name: 'Press', muscle: 'Pecho', prescriptionType: 'repetitions', sets: 3, reps: '10', durationMinutes: null, restSeconds: 90, tempo: '', notes: '' }] : [],
      })),
    });
    const migrated = parsePersistedDatabase({
      schemaVersion: 5,
      users: [user], routineExercises: [], routinePlans: [{ ...plan, days: plan.days.slice(0, 6) }],
      dietPlans: [], calorieCalculations: [], specialistProfiles: [], specialistRequests: [],
    });

    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.routinePlans[0]?.days.slice(0, 6)).toEqual(plan.days.slice(0, 6));
    expect(migrated.routinePlans[0]?.days[6]).toMatchObject({ day: 'domingo', isRestDay: true, exercises: [] });
  });

  it('convierte cardio v6 a una prescripción explícita por minutos', () => {
    const user = createPasswordUser({
      id: 'user-1', name: 'Usuario', email: 'usuario@example.com',
      passwordHash: 'hash', birthDate: '1990-01-01', sex: 'prefiero no decirlo', now,
    });
    const currentPlan = createRoutinePlan({
      id: 'routine-cardio', userId: user.id, source: 'manual', title: 'Rutina cardio',
      goal: 'resistencia', level: 'intermedio', location: 'gimnasio', sessionDurationMinutes: 60,
      availableEquipment: 'Texto anterior', generationEngine: 'manual', now,
      days: ROUTINE_PLAN_DAYS.map((day) => ({
        day, title: day === 'lunes' ? 'Cardio' : 'Descanso', focus: '', isRestDay: day !== 'lunes',
        exercises: day === 'lunes' ? [{
          name: 'Bicicleta', muscle: 'Cardio', prescriptionType: 'duration', sets: null, reps: '',
          durationMinutes: 15, restSeconds: 0, tempo: 'Moderado', notes: '',
        }] : [],
      })),
    });
    const legacyDays = currentPlan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => ({
        name: exercise.name, muscle: exercise.muscle, sets: 3, reps: '10-15',
        restSeconds: 45, tempo: exercise.tempo, notes: exercise.notes,
      })),
    }));
    const migrated = parsePersistedDatabase({
      schemaVersion: 6,
      users: [user], routineExercises: [], routinePlans: [{ ...currentPlan, days: legacyDays }],
      dietPlans: [], calorieCalculations: [], specialistProfiles: [], specialistRequests: [],
    });

    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.routinePlans[0]?.availableEquipment).toBe('');
    expect(migrated.routinePlans[0]?.days[0]?.exercises[0]).toMatchObject({
      muscle: 'Cardio', prescriptionType: 'duration', sets: null, reps: '',
      durationMinutes: 15, restSeconds: 0,
    });
  });
});
