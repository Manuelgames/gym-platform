import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError, requireWritableSession } from '../../../infrastructure/http/responses';
import {
  AUTH_RATE_LIMITS,
  getAuthRateLimiter,
  rateLimitSubject,
  type RateLimitLease,
} from '../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Autentica, regenera el identificador de sesión y guarda usuario y versión de sesión. */
export const POST: APIRoute = async ({ request, session, clientAddress }) => {
  try {
    const environment = loadAstroServerEnvironment();
    assertTrustedFormOrigin(request, environment.appOrigin);
    const writableSession = requireWritableSession(session);
    const form = await readServerForm(request);
    const email = readTextField(form, 'email', { maxRawLength: 254 });
    const password = readTextField(form, 'password', { maxRawLength: 128 });
    const limiter = getAuthRateLimiter();
    const ipLease = limiter.consume(`login-ip:${clientAddress}`, AUTH_RATE_LIMITS.loginIp);
    let accountLease: RateLimitLease;
    try {
      accountLease = limiter.consume(
        `login-account:${rateLimitSubject(email)}`,
        AUTH_RATE_LIMITS.loginAccount,
      );
    } catch (error) {
      limiter.release(ipLease);
      throw error;
    }
    const user = await getApplication().login({
      email,
      password,
    });
    limiter.release(ipLease);
    limiter.release(accountLease);
    // La rotación elimina la posibilidad de fijar un identificador previo.
    await writableSession.regenerate();
    writableSession.set('userId', user.id, { ttl: environment.sessionTtlSeconds });
    writableSession.set('sessionVersion', user.sessionVersion, { ttl: environment.sessionTtlSeconds });
    return redirectAfterPost(request, '/app');
  } catch (error) {
    return redirectEndpointError(request, '/iniciar-sesion', error);
  }
};
