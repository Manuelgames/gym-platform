import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';

// Astro evalúa este archivo antes de cargar `.env`; Vite permite leerlo aquí.
const fileEnvironment = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
const configurationEnvironment = { ...fileEnvironment, ...process.env };
const sessionTtl = Number.parseInt(configurationEnvironment.SESSION_TTL_SECONDS ?? '604800', 10);
const isProduction = configurationEnvironment.NODE_ENV === 'production';

/**
 * Astro se ejecuta en SSR porque la autorización y la persistencia pertenecen
 * al servidor. El esquema declara de forma explícita qué valores pueden llegar
 * al navegador y mantiene secretos de proveedor exclusivamente server-side.
 */
export default defineConfig({
  site: configurationEnvironment.APP_ORIGIN ?? 'http://localhost:4321',
  output: 'server',
  adapter: node({
    mode: 'standalone',
    // El formulario profesional admite una foto y hasta tres PDF de 4 MB.
    bodySizeLimit: 18 * 1024 * 1024,
  }),
  compressHTML: true,
  devToolbar: { enabled: false },
  session: {
    ttl: Number.isInteger(sessionTtl) && sessionTtl > 0 ? sessionTtl : 604800,
    cookie: {
      name: 'roman_colosseum_session',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: Number.isInteger(sessionTtl) && sessionTtl > 0 ? sessionTtl : 604800,
    },
  },
  env: {
    schema: {
      NODE_ENV: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['development', 'test', 'production'],
        default: 'development',
      }),
      APP_ORIGIN: envField.string({
        context: 'server',
        access: 'public',
        url: true,
        default: 'http://localhost:4321',
      }),
      APP_ACCESS_MODE: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['authenticated', 'demo'],
        default: 'authenticated',
      }),
      DATA_FILE_PATH: envField.string({
        context: 'server',
        access: 'secret',
        default: '.data/roman-colosseum.json',
      }),
      UPLOADS_DIRECTORY: envField.string({
        context: 'server',
        access: 'secret',
        default: '.data/uploads',
      }),
      AUTH_PROVIDER: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['password', 'google', 'firebase'],
        default: 'password',
      }),
      SESSION_TTL_SECONDS: envField.number({
        context: 'server',
        access: 'secret',
        int: true,
        min: 300,
        default: 604800,
      }),
      OPENAI_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      OPENAI_MODEL: envField.string({
        context: 'server',
        access: 'secret',
        default: 'gpt-5.6-terra',
      }),
      PUBLIC_GOOGLE_CLIENT_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_REDIRECT_URI: envField.string({ context: 'server', access: 'public', url: true, optional: true }),
      PUBLIC_FIREBASE_API_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_FIREBASE_AUTH_DOMAIN: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_FIREBASE_PROJECT_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_FIREBASE_APP_ID: envField.string({ context: 'client', access: 'public', optional: true }),
      FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: envField.string({ context: 'server', access: 'secret', optional: true }),
      FIREBASE_DATABASE_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  redirects: {
    '/index.html': '/',
    '/pages/blog.html': '/blog',
    '/pages/ingresar.html': '/iniciar-sesion',
    '/pages/registro.html': '/registro',
    '/pages/menu.html': '/app',
    '/pages/rutina.html': '/app/rutina',
    '/pages/dieta.html': '/app/dieta',
    '/pages/calculadora.html': '/app/calculadora',
  },
});
