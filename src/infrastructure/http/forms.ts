import { timingSafeEqual } from 'node:crypto';
import { DomainValidationError } from '../../domain/shared/errors';

const MAX_FORM_BYTES = 64 * 1024;

/** Verifica origen cuando el navegador lo envía para reducir CSRF en POST. */
export function assertTrustedFormOrigin(
  request: Request,
  appOrigin: string,
  options: { allowedOrigins?: readonly string[]; allowMissingOrigin?: boolean } = {},
): void {
  const origin = request.headers.get('origin');
  const configuredOrigin = new URL(appOrigin).origin;
  if (!origin && options.allowMissingOrigin) return;
  const allowedOrigins = new Set([
    configuredOrigin,
    ...(options.allowedOrigins ?? []).map((allowedOrigin) => new URL(allowedOrigin).origin),
  ]);
  if (!origin || !allowedOrigins.has(origin)) {
    throw new DomainValidationError('form', 'El origen del formulario no está permitido.');
  }
}

/** Lee únicamente formularios nativos y aplica un límite temprano de tamaño. */
export async function readServerForm(
  request: Request,
  maximumBytes: number = MAX_FORM_BYTES,
): Promise<FormData> {
  const contentType = request.headers.get('content-type') ?? '';
  if (
    !contentType.startsWith('application/x-www-form-urlencoded')
    && !contentType.startsWith('multipart/form-data')
  ) {
    throw new DomainValidationError('form', 'Se esperaba un formulario válido.');
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new DomainValidationError('form', 'El formulario supera el tamaño permitido.');
  }
  try {
    return await request.formData();
  } catch {
    throw new DomainValidationError('form', 'No se pudo interpretar el formulario.');
  }
}

/** Aplica el double-submit cookie exigido por Google Identity Services. */
export function assertGoogleCsrfToken(form: FormData, cookieToken: string | undefined): void {
  const formToken = readTextField(form, 'g_csrf_token', { maxRawLength: 512 });
  assertMatchingCsrfToken(cookieToken, formToken);
}

/** Compara tokens CSRF opacos sin revelar diferencias parciales. */
export function assertMatchingCsrfToken(expected: string | undefined, received: string): void {
  if (!expected || expected.length > 512 || expected.length !== received.length) {
    throw new DomainValidationError('form', 'No fue posible validar la solicitud de Google.');
  }
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  if (expectedBytes.length !== receivedBytes.length || !timingSafeEqual(expectedBytes, receivedBytes)) {
    throw new DomainValidationError('form', 'No fue posible validar la solicitud de Google.');
  }
}

/** Lee valores repetidos de checkbox sin aceptar archivos ni listas enormes. */
export function readTextFields(
  form: FormData,
  name: string,
  options: { maxItems?: number; maxRawLength?: number } = {},
): string[] {
  const values = form.getAll(name);
  if (values.length > (options.maxItems ?? 10)) {
    throw new DomainValidationError(name, 'Se recibieron demasiados valores.');
  }
  return values.map((value) => {
    if (typeof value !== 'string') {
      throw new DomainValidationError(name, 'El campo debe ser texto.');
    }
    if (value.length > (options.maxRawLength ?? 64)) {
      throw new DomainValidationError(name, 'El campo supera el tamaño permitido.');
    }
    return value;
  });
}

/** Obtiene un archivo requerido u opcional; la aplicación validará su firma. */
export function readFileField(
  form: FormData,
  name: string,
  options: { optional?: boolean } = {},
): File | null {
  const value = form.get(name);
  if (value instanceof File && value.size > 0) return value;
  if (options.optional) return null;
  throw new DomainValidationError(name, 'Selecciona un archivo.');
}

/** Obtiene archivos repetidos e ignora controles vacíos emitidos por el navegador. */
export function readFileFields(form: FormData, name: string, maxItems: number): File[] {
  const values = form.getAll(name).filter((value): value is File => (
    value instanceof File && value.size > 0
  ));
  if (values.length > maxItems) {
    throw new DomainValidationError(name, `Solo se permiten hasta ${maxItems} archivos.`);
  }
  return values;
}

/** Obtiene el primer campo textual disponible; nunca acepta objetos File. */
export function readTextField(
  form: FormData,
  names: string | readonly string[],
  options: { optional?: boolean; maxRawLength?: number } = {},
): string {
  const candidates = typeof names === 'string' ? [names] : names;
  let value: FormDataEntryValue | null = null;
  let selectedName = candidates[0] ?? 'field';
  for (const name of candidates) {
    const candidate = form.get(name);
    if (candidate !== null) {
      value = candidate;
      selectedName = name;
      break;
    }
  }
  if (value === null && options.optional) return '';
  if (typeof value !== 'string') {
    throw new DomainValidationError(selectedName, 'El campo debe ser texto.');
  }
  const maxRawLength = options.maxRawLength ?? 512;
  if (value.length > maxRawLength) {
    throw new DomainValidationError(selectedName, 'El campo supera el tamaño permitido.');
  }
  return value;
}

/** Convierte un campo decimal sin aceptar cadenas vacías, NaN o infinito. */
export function readNumberField(
  form: FormData,
  names: string | readonly string[],
): number {
  const value = readTextField(form, names).trim();
  const field = typeof names === 'string' ? names : (names[0] ?? 'number');
  if (!value) throw new DomainValidationError(field, 'El número es obligatorio.');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new DomainValidationError(field, 'El número no es válido.');
  }
  return parsed;
}
