import type { SpecialistProfileView } from '../application/facade';

/**
 * Filtra el directorio por el identificador completo del perfil.
 *
 * La comparación ignora espacios exteriores y mayúsculas para que un UUID
 * copiado o escrito manualmente siga siendo fácil de encontrar. No se aceptan
 * coincidencias parciales porque el identificador es la referencia única que
 * el especialista comparte con otros usuarios.
 */
export function filterSpecialistsById(
  profiles: readonly SpecialistProfileView[],
  rawIdentifier: string,
): readonly SpecialistProfileView[] {
  const identifier = rawIdentifier.trim().toLowerCase();
  if (!identifier) return profiles;
  return profiles.filter((profile) => profile.id.toLowerCase() === identifier);
}
