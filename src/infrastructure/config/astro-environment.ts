import {
  APP_ACCESS_MODE,
  APP_ORIGIN,
  AUTH_PROVIDER,
  DATA_FILE_PATH,
  NODE_ENV,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  SESSION_TTL_SECONDS,
  UPLOADS_DIRECTORY,
} from 'astro:env/server';
import { loadServerEnvironment, type ServerEnvironment } from './environment';

/**
 * Adapta el esquema tipado de Astro al contrato interno de configuración.
 *
 * A diferencia de `process.env`, el módulo virtual aplica defaults de Astro,
 * carga `.env` en desarrollo y permite que el adaptador resuelva secretos en
 * tiempo de ejecución.
 */
export function loadAstroServerEnvironment(): ServerEnvironment {
  /*
   * Los secretos de `astro:env/server` pueden quedar temporalmente indefinidos
   * cuando el esquema cambia durante una recarga del servidor de desarrollo.
   * El cargador compartido valida los valores y aplica defaults antes de
   * resolver rutas, evitando pasar `undefined` a `node:path.resolve`.
   */
  return loadServerEnvironment({
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? NODE_ENV,
    APP_ORIGIN: process.env.APP_ORIGIN ?? APP_ORIGIN,
    APP_ACCESS_MODE: process.env.APP_ACCESS_MODE ?? APP_ACCESS_MODE,
    DATA_FILE_PATH: process.env.DATA_FILE_PATH ?? DATA_FILE_PATH,
    UPLOADS_DIRECTORY: process.env.UPLOADS_DIRECTORY ?? UPLOADS_DIRECTORY,
    AUTH_PROVIDER: process.env.AUTH_PROVIDER ?? AUTH_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? OPENAI_MODEL,
    SESSION_TTL_SECONDS:
      process.env.SESSION_TTL_SECONDS
      ?? (SESSION_TTL_SECONDS === undefined ? undefined : String(SESSION_TTL_SECONDS)),
  });
}
