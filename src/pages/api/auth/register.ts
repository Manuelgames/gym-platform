import type { APIRoute } from 'astro';
import { getApplication } from '../../../infrastructure/composition/container';
import { loadAstroServerEnvironment } from '../../../infrastructure/config/astro-environment';
import { assertTrustedFormOrigin, readServerForm, readTextField } from '../../../infrastructure/http/forms';
import { redirectAfterPost, redirectEndpointError } from '../../../infrastructure/http/responses';
import { AUTH_RATE_LIMITS, getAuthRateLimiter } from '../../../infrastructure/security/rate-limiter';

export const prerender = false;

/** Registra credenciales, rota la sesión y conserva usuario y versión de sesión. */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const environment = loadAstroServerEnvironment();
    assertTrustedFormOrigin(request, environment.appOrigin);
    getAuthRateLimiter().consume(`register:${clientAddress}`, AUTH_RATE_LIMITS.register);
    const form = await readServerForm(request);
    const delivery = await getApplication().register({
      name: readTextField(form, 'name', { maxRawLength: 80 }),
      email: readTextField(form, 'email', { maxRawLength: 254 }),
      password: readTextField(form, 'password', { maxRawLength: 128 }),
      birthDate: readTextField(form, 'birthDate', { maxRawLength: 10 }),
      sex: readTextField(form, 'sex', { maxRawLength: 32 }),
    });
    // Esperamos la rotación antes de responder para no perder la nueva cookie.
    return redirectAfterPost(request, '/confirmar-correo', delivery === 'sent'
      ? { registered: '1', sent: '1' }
      : { registered: '1', error: 'verification-delivery-failed' });
  } catch (error) {
    return redirectEndpointError(request, '/registro', error);
  }
};
