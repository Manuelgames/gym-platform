import { describe, expect, it } from 'vitest';
import type { SpecialistProfileView } from '../../src/application/facade';
import { filterSpecialistsById } from '../../src/presentation/specialist-search';

function profile(id: string, roles: SpecialistProfileView['roles']): SpecialistProfileView {
  return {
    id,
    userId: `user-${id}`,
    name: `Especialista ${id}`,
    profilePhotoId: null,
    presentation: 'Presentación profesional para las pruebas del buscador.',
    experience: 'Experiencia profesional suficiente para la prueba.',
    roles,
    photo: {
      id: `photo-${id}`,
      storageKey: `photo-${id}.webp`,
      originalName: 'perfil.webp',
      mimeType: 'image/webp',
      sizeBytes: 512,
      createdAt: '2026-08-06T12:00:00.000Z',
    },
    certificates: [],
  };
}

describe('buscador de especialistas por identificador', () => {
  const hybrid = profile('550e8400-e29b-41d4-a716-446655440000', ['trainer', 'nutritionist']);
  const trainer = profile('trainer-only', ['trainer']);

  it('encuentra el identificador completo ignorando espacios y mayúsculas', () => {
    expect(filterSpecialistsById([hybrid, trainer], ' 550E8400-E29B-41D4-A716-446655440000 '))
      .toEqual([hybrid]);
  });

  it('no acepta coincidencias parciales y conserva el directorio sin consulta', () => {
    expect(filterSpecialistsById([hybrid, trainer], '550e8400')).toEqual([]);
    expect(filterSpecialistsById([hybrid, trainer], '   ')).toEqual([hybrid, trainer]);
  });

  it('permite mostrar un perfil híbrido en los dos directorios filtrados', () => {
    const trainers = filterSpecialistsById([hybrid, trainer], hybrid.id);
    const nutritionists = filterSpecialistsById([hybrid], hybrid.id);

    expect(trainers).toEqual([hybrid]);
    expect(nutritionists).toEqual([hybrid]);
  });
});
