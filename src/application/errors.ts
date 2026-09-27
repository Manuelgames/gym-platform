/** Códigos estables de fallos esperados por la capa de presentación. */
export type ApplicationErrorCode =
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'CURRENT_PASSWORD_INVALID'
  | 'PASSWORD_CHANGE_UNAVAILABLE'
  | 'PROFILE_UPDATE_CONFLICT'
  | 'USER_NOT_FOUND'
  | 'ROUTINE_EXERCISE_NOT_FOUND'
  | 'ROUTINE_PLAN_NOT_FOUND'
  | 'TRAINING_RELATION_REQUIRED'
  | 'CALORIE_CALCULATION_NOT_FOUND'
  | 'CALORIE_PROFILE_REQUIRED'
  | 'DIET_PLAN_NOT_FOUND'
  | 'NUTRITION_RELATION_REQUIRED'
  | 'SESSION_UNAVAILABLE'
  | 'SPECIALIST_PROFILE_ALREADY_EXISTS'
  | 'SPECIALIST_PROFILE_NOT_FOUND'
  | 'SPECIALIST_ROLE_UNAVAILABLE'
  | 'SPECIALIST_SELF_REQUEST'
  | 'SPECIALIST_REQUEST_CONFLICT'
  | 'SPECIALIST_REQUEST_NOT_FOUND';

/** Error de caso de uso que puede traducirse a una respuesta segura. */
export class ApplicationError extends Error {
  constructor(
    /** Código estable; no contiene información sensible. */
    readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
