import { resolve } from 'node:path';
import type { IdentityProvider } from '../../domain/users/user';

/** Política de acceso a la interfaz, independiente del proveedor de identidad. */
export type AppAccessMode = 'authenticated' | 'demo';

/** Configuración server-side ya validada y sin secretos de cliente. */
export interface ServerEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  appOrigin: string;
  appAccessMode: AppAccessMode;
  dataFilePath: string;
  uploadsDirectory: string;
  authProvider: IdentityProvider;
  sessionTtlSeconds: number;
  openAiApiKey: string | null;
  openAiModel: string;
}

function readNodeEnv(value: string | undefined): ServerEnvironment['nodeEnv'] {
  if (value === 'production' || value === 'test') return value;
  return 'development';
}

/** Valida el origen absoluto usado para formularios y redirecciones. */
export function readAppOrigin(value: string | undefined): string {
  const appOrigin = value?.trim() || 'http://localhost:4321';
  try {
    new URL(appOrigin);
  } catch {
    throw new Error('APP_ORIGIN debe ser una URL absoluta válida.');
  }
  return appOrigin;
}

function readAuthProvider(value: string | undefined): IdentityProvider {
  if (!value || value === 'password') return 'password';
  if (value === 'google' || value === 'firebase') return value;
  throw new Error('AUTH_PROVIDER debe ser password, google o firebase.');
}

/** Valida la política de acceso y falla cerrada cuando no está configurada. */
export function readAppAccessMode(value: string | undefined): AppAccessMode {
  if (!value || value === 'authenticated') return 'authenticated';
  if (value === 'demo') return value;
  throw new Error('APP_ACCESS_MODE debe ser authenticated o demo.');
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Lee variables en tiempo de ejecución para que el mismo build pueda desplegarse
 * con rutas de datos distintas. Las variables `PUBLIC_*` nunca se usan aquí.
 */
export function loadServerEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  workingDirectory: string = process.cwd(),
): ServerEnvironment {
  const dataFile = env.DATA_FILE_PATH?.trim() || '.data/roman-colosseum.json';
  const uploadsDirectory = env.UPLOADS_DIRECTORY?.trim() || '.data/uploads';
  const appOrigin = readAppOrigin(env.APP_ORIGIN);

  return {
    nodeEnv: readNodeEnv(env.NODE_ENV),
    appOrigin,
    appAccessMode: readAppAccessMode(env.APP_ACCESS_MODE),
    dataFilePath: resolve(workingDirectory, dataFile),
    uploadsDirectory: resolve(workingDirectory, uploadsDirectory),
    authProvider: readAuthProvider(env.AUTH_PROVIDER),
    sessionTtlSeconds: readPositiveInteger(env.SESSION_TTL_SECONDS, 60 * 60 * 24 * 7),
    openAiApiKey: env.OPENAI_API_KEY?.trim() || null,
    openAiModel: env.OPENAI_MODEL?.trim() || 'gpt-5.6-terra',
  };
}
