import { defineMiddleware } from 'astro:middleware';
import { getApplication } from './infrastructure/composition/container';
import { loadAstroServerEnvironment } from './infrastructure/config/astro-environment';

const PRIVATE_API_PREFIXES = [
  '/api/routine/',
  '/api/diet/',
  '/api/calories/',
  '/api/specialists/',
  '/api/profile/',
] as const;

function isPrivatePage(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/');
}

function isPrivateApi(pathname: string): boolean {
  return PRIVATE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthenticationPage(pathname: string): boolean {
  return pathname === '/iniciar-sesion'
    || pathname === '/registro'
    || pathname === '/confirmar-correo'
    || pathname === '/verificar-correo'
    || pathname === '/recuperar-contrasena'
    || pathname === '/restablecer-contrasena';
}

function isAuthenticationApi(pathname: string): boolean {
  return pathname.startsWith('/api/auth/');
}

function withSessionAwareCacheHeaders(
  response: Response,
  options: {
    noStore: boolean;
    varyCookie: boolean;
    referrerPolicy?: 'no-referrer' | 'strict-origin';
  },
): Response {
  const headers = new Headers(response.headers);
  if (options.referrerPolicy) headers.set('Referrer-Policy', options.referrerPolicy);
  if (options.noStore) {
    headers.set('Cache-Control', 'private, no-store, max-age=0');
    headers.set('Pragma', 'no-cache');
  }
  if (options.varyCookie) {
    const vary = new Set((headers.get('Vary') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean));
    vary.add('Cookie');
    headers.set('Vary', [...vary].join(', '));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Aplica el modo de acceso y resuelve el propietario de datos para SSR/APIs.
 *
 * En modo autenticado usa exclusivamente Astro Sessions. En modo demo asigna
 * un perfil reservado persistente, sin cookie, y bloquea las rutas de auth.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const environment = loadAstroServerEnvironment();
  const pathname = context.url.pathname;
  const privatePage = isPrivatePage(pathname);
  const privateApi = isPrivateApi(pathname);

  context.locals.accessMode = environment.appAccessMode;
  context.locals.user = null;
  context.locals.specialistRoles = [];

  if (environment.appAccessMode === 'demo') {
    if (isAuthenticationPage(pathname) || isAuthenticationApi(pathname)) {
      const status = context.request.method === 'GET' || context.request.method === 'HEAD'
        ? 302
        : 303;
      return withSessionAwareCacheHeaders(context.redirect('/app', status), {
        noStore: true,
        varyCookie: false,
      });
    }

    if (privatePage || privateApi) {
      context.locals.user = await getApplication().getDemoUser();
    }
  } else {
    const storedUserId = await context.session?.get('userId');
    if (typeof storedUserId === 'string' && storedUserId.length > 0) {
      const user = await getApplication().getCurrentUser(storedUserId);
      const sessionVersion = await context.session?.get('sessionVersion');
      if (user && sessionVersion === user.sessionVersion) context.locals.user = user;
      else context.session?.destroy();
    } else if (storedUserId !== undefined) {
      context.session?.destroy();
    }
  }

  if ((privatePage || privateApi) && !context.locals.user) {
    const destination = new URL('/iniciar-sesion', context.url);
    destination.searchParams.set('error', 'authentication-required');
    if (privatePage) destination.searchParams.set('next', pathname);
    return withSessionAwareCacheHeaders(
      context.redirect(`${destination.pathname}${destination.search}`, privateApi ? 303 : 302),
      { noStore: true, varyCookie: true },
    );
  }

  if (context.locals.user) {
    context.locals.specialistRoles = await getApplication().getMySpecialistRoles(
      context.locals.user.id,
    );
  }

  if (
    context.locals.user
    && context.request.method === 'GET'
    && (pathname === '/iniciar-sesion' || pathname === '/registro')
  ) {
    return withSessionAwareCacheHeaders(
      context.redirect('/app', 302),
      { noStore: true, varyCookie: true },
    );
  }

  const response = await next();
  const isHtml = response.headers.get('Content-Type')?.includes('text/html') ?? false;
  const isApi = pathname.startsWith('/api/');
  return withSessionAwareCacheHeaders(response, {
    noStore: privatePage || privateApi || isApi || isAuthenticationPage(pathname) || Boolean(context.locals.user),
    varyCookie: isHtml || isApi,
    referrerPolicy: pathname === '/restablecer-contrasena' || pathname === '/verificar-correo'
      ? 'strict-origin'
      : undefined,
  });
});
