import { describe, expect, it } from 'vitest';
import {
  calculateCalories,
  createCalorieCalculation,
} from '../../src/domain/calories/calorie';
import { buildDietGuide, createDietPlan } from '../../src/domain/diet/diet';
import { createRoutineExercise, groupRoutineByDay, WEEK_DAYS } from '../../src/domain/routine/routine';
import { DomainValidationError } from '../../src/domain/shared/errors';
import {
  createPasswordUser,
  normalizeEmail,
  validateNewPassword,
  validatePassword,
} from '../../src/domain/users/user';

describe('reglas de usuario', () => {
  it('normaliza correo y nombre sin alterar datos autenticables', () => {
    const user = createPasswordUser({
      id: 'user-1',
      name: '  Ana   María  ',
      email: ' ANA@Example.COM ',
      passwordHash: 'hash-de-prueba',
      birthDate: '1995-06-17',
      sex: 'mujer',
      now: '2026-08-05T12:00:00.000Z',
    });

    expect(user.name).toBe('Ana María');
    expect(user.email).toBe('ana@example.com');
    expect(user.identities[0]).toMatchObject({
      provider: 'password',
      subject: 'ana@example.com',
      credentialHash: 'hash-de-prueba',
    });
    expect(normalizeEmail(' USUARIO@DOMINIO.MX ')).toBe('usuario@dominio.mx');
  });

  it('separa credenciales heredadas de la política para contraseñas nuevas', () => {
    expect(() => validatePassword('1234567')).toThrow(DomainValidationError);
    expect(validatePassword('claveheredada')).toBe('claveheredada');
    expect(() => validateNewPassword('clave-segura')).toThrow(
      expect.objectContaining({ field: 'password' }),
    );
    expect(() => validateNewPassword('ClaveSegura1')).toThrow(
      expect.objectContaining({ field: 'password' }),
    );
    expect(validateNewPassword('Clave-Segura1')).toBe('Clave-Segura1');
  });

  it('rechaza fechas futuras', () => {
    expect(() => createPasswordUser({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.com',
      passwordHash: 'hash',
      birthDate: '2027-01-01',
      sex: 'mujer',
      now: '2026-08-05T12:00:00.000Z',
    })).toThrow(expect.objectContaining({ field: 'birthDate' }));
  });
});

describe('reglas de rutina', () => {
  it('valida, normaliza y agrupa siempre los siete días', () => {
    const exercise = createRoutineExercise({
      id: 'exercise-1',
      userId: 'user-1',
      day: 'miercoles',
      muscle: 'Espalda',
      name: '  Remo   con barra ',
      sets: 4,
      reps: ' 8 - 12 ',
      notes: ' Técnica controlada ',
      now: '2026-08-05T12:00:00.000Z',
    });
    const routine = groupRoutineByDay([exercise]);

    expect(Object.keys(routine)).toEqual(WEEK_DAYS);
    expect(routine.miercoles[0]).toMatchObject({
      name: 'Remo con barra',
      reps: '8 - 12',
      notes: 'Técnica controlada',
    });
    expect(routine.lunes).toEqual([]);
  });

  it('rechaza series decimales y días inventados', () => {
    const base = {
      id: 'exercise-1',
      userId: 'user-1',
      day: 'lunes',
      muscle: 'Pecho',
      name: 'Press',
      sets: 4,
      reps: '10',
      now: '2026-08-05T12:00:00.000Z',
    };
    expect(() => createRoutineExercise({ ...base, sets: 2.5 })).toThrow(
      expect.objectContaining({ field: 'sets' }),
    );
    expect(() => createRoutineExercise({ ...base, day: 'octavodia' })).toThrow(
      expect.objectContaining({ field: 'day' }),
    );
  });
});

describe('reglas de dieta', () => {
  it('deriva una guía del plan sin duplicar sugerencias en persistencia', () => {
    const plan = createDietPlan({
      id: 'diet-1',
      userId: 'user-1',
      goal: 'perder',
      preference: 'vegetariana',
      meals: 4,
      now: '2026-08-05T12:00:00.000Z',
    });
    const guide = buildDietGuide(plan);

    expect(guide.title).toContain('déficit');
    expect(guide.meals).toHaveLength(4);
    expect(guide.meals[1]?.description).toContain('Lentejas');
  });
});

describe('reglas de calorías', () => {
  it('reproduce Mifflin-St Jeor y conserva el snapshot de entradas', () => {
    const input = {
      age: 30,
      sex: 'male',
      weightKg: 80,
      heightCm: 180,
      activityFactor: 1.55,
    };
    expect(calculateCalories(input)).toEqual({
      bmr: 1780,
      maintenanceCalories: 2759,
      formulaVersion: 'mifflin-st-jeor-v1',
    });
    expect(createCalorieCalculation({
      ...input,
      id: 'calculation-1',
      userId: 'user-1',
      now: '2026-08-05T12:00:00.000Z',
    })).toMatchObject({ ...input, bmr: 1780, maintenanceCalories: 2759 });
  });

  it('rechaza factores de actividad fuera del conjunto publicado', () => {
    expect(() => calculateCalories({
      age: 30,
      sex: 'female',
      weightKg: 65,
      heightCm: 165,
      activityFactor: 1.4,
    })).toThrow(expect.objectContaining({ field: 'activity' }));
  });
});
