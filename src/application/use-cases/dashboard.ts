import { ApplicationError } from '../errors';
import type { DashboardView } from '../facade';
import type { FitnessRepository, UserRepository } from '../ports/repositories';
import { toPublicUser } from './auth';

/** Consulta agregada de la portada privada. */
export class DashboardUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly fitness: FitnessRepository,
  ) {}

  /** Obtiene perfil y métricas consistentes sin exponer credenciales. */
  async get(userId: string): Promise<DashboardView> {
    const [user, summary] = await Promise.all([
      this.users.findById(userId),
      this.fitness.getSummary(userId),
    ]);
    if (!user) {
      throw new ApplicationError('USER_NOT_FOUND', 'No se encontró el usuario de la sesión.');
    }
    return { user: toPublicUser(user), ...summary };
  }
}
