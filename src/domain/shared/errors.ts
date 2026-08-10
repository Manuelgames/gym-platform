/**
 * Error producido cuando un valor no cumple una regla del dominio.
 *
 * La capa HTTP puede usar `field` para señalar el control inválido sin exponer
 * detalles internos ni acoplar las reglas a Astro.
 */
export class DomainValidationError extends Error {
  readonly code = 'DOMAIN_VALIDATION_ERROR' as const;

  constructor(
    /** Campo lógico que originó el error. */
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

/**
 * Exige una condición de negocio y produce un error uniforme si no se cumple.
 */
export function assertDomain(
  condition: unknown,
  field: string,
  message: string,
): asserts condition {
  if (!condition) {
    throw new DomainValidationError(field, message);
  }
}
