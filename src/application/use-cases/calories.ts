import {
  CALORIE_HISTORY_LIMIT,
  createCalorieCalculation,
  type CalorieCalculation,
} from '../../domain/calories/calorie';
import type { CalculateCaloriesInput } from '../facade';
import { ApplicationError } from '../errors';
import type { FitnessRepository } from '../ports/repositories';
import type { Clock, IdGenerator } from '../ports/services';

/** Casos de uso de cálculo e historial energético reproducible. */
export class CalorieUseCases {
  constructor(
    private readonly fitness: FitnessRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Lista resultados del más reciente al más antiguo. */
  get(userId: string): Promise<CalorieCalculation[]> {
    return this.fitness.listCalorieCalculations(userId);
  }

  /** Calcula, persiste la entrada completa y aplica el límite histórico. */
  async calculate(userId: string, input: CalculateCaloriesInput): Promise<CalorieCalculation> {
    const calculation = createCalorieCalculation({
      ...input,
      id: this.ids.next(),
      userId,
      now: this.clock.now(),
    });
    await this.fitness.addCalorieCalculation(calculation, CALORIE_HISTORY_LIMIT);
    return calculation;
  }

  /** Elimina por id y propietario; nunca acepta una posición del historial. */
  async delete(userId: string, calculationId: string): Promise<void> {
    if (!calculationId.trim()
      || !(await this.fitness.deleteCalorieCalculation(userId, calculationId))) {
      throw new ApplicationError(
        'CALORIE_CALCULATION_NOT_FOUND',
        'No se encontró el cálculo de calorías.',
      );
    }
  }
}
