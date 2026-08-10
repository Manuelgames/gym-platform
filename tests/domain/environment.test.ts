import { describe, expect, it } from 'vitest';
import { loadServerEnvironment } from '../../src/infrastructure/config/environment';

describe('configuración de acceso', () => {
  it('falla cerrado en modo autenticado cuando no se configura', () => {
    const environment = loadServerEnvironment({}, process.cwd());
    expect(environment.appAccessMode).toBe('authenticated');
  });

  it('admite explícitamente el modo demo temporal', () => {
    const environment = loadServerEnvironment({ APP_ACCESS_MODE: 'demo' }, process.cwd());
    expect(environment.appAccessMode).toBe('demo');
  });

  it('rechaza políticas de acceso desconocidas', () => {
    expect(() => loadServerEnvironment({ APP_ACCESS_MODE: 'public' }, process.cwd()))
      .toThrow('APP_ACCESS_MODE debe ser authenticated o demo.');
  });
});
