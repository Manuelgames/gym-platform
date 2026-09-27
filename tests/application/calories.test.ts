import { describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '../../src/application/errors';
import { CalorieUseCases } from '../../src/application/use-cases/calories';
import type { FitnessRepository } from '../../src/application/ports/repositories';

function fixture(deleteResult: boolean) {
  const fitness = {
    deleteCalorieCalculation: vi.fn(async () => deleteResult),
  } as unknown as FitnessRepository;
  const useCases = new CalorieUseCases(
    fitness,
    { now: () => '2026-08-05T12:00:00.000Z' },
    { next: () => 'calculation-1' },
  );
  return { fitness, useCases };
}

describe('eliminación del historial calórico', () => {
  it('solicita el borrado usando el propietario autenticado y el id estable', async () => {
    const { fitness, useCases } = fixture(true);

    await expect(useCases.delete('user-1', 'calculation-1')).resolves.toBeUndefined();
    expect(fitness.deleteCalorieCalculation).toHaveBeenCalledWith('user-1', 'calculation-1');
  });

  it('no consulta el repositorio con un id vacío y reporta un fallo seguro', async () => {
    const { fitness, useCases } = fixture(true);

    await expect(useCases.delete('user-1', '   ')).rejects.toEqual(expect.objectContaining({
      code: 'CALORIE_CALCULATION_NOT_FOUND',
    } satisfies Partial<ApplicationError>));
    expect(fitness.deleteCalorieCalculation).not.toHaveBeenCalled();
  });

  it('reporta como inexistente un registro ajeno o ya eliminado', async () => {
    const { useCases } = fixture(false);

    await expect(useCases.delete('user-1', 'calculation-2')).rejects.toEqual(expect.objectContaining({
      code: 'CALORIE_CALCULATION_NOT_FOUND',
    } satisfies Partial<ApplicationError>));
  });
});
