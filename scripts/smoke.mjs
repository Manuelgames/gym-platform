import { spawn } from 'node:child_process';
import { randomBytes, scrypt } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const workspace = process.cwd();
const dataDirectory = resolve(workspace, '.data');
const dataFile = resolve(dataDirectory, 'smoke-test.json');
const uploadsDirectory = resolve(dataDirectory, 'smoke-uploads');
// Puerto deliberadamente distinto al de desarrollo para no probar otro proceso
// que el usuario pueda tener abierto en localhost:4321.
const origin = 'http://127.0.0.1:43921';
const port = new URL(origin).port;
const cookies = new Map();
let server;
let serverOutput = '';

if (dirname(dataFile) !== dataDirectory || dirname(uploadsDirectory) !== dataDirectory) {
  throw new Error('La prueba solo puede eliminar su archivo dentro de .data.');
}

function derivePassword(password, salt) {
  return new Promise((resolveHash, rejectHash) => {
    scrypt(password, salt, 64, { N: 32_768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, digest) => (
      error ? rejectHash(error) : resolveHash(digest)
    ));
  });
}

async function passwordHash(password) {
  const salt = randomBytes(16);
  const digest = await derivePassword(password, salt);
  return `scrypt$v1$32768$8$3$${salt.toString('base64')}$${digest.toString('base64')}`;
}

async function seedVerifiedUsers(users) {
  const now = '2026-09-27T12:00:00.000Z';
  const storedUsers = await Promise.all(users.map(async (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    birthDate: user.birthDate,
    sex: 'prefiero no decirlo',
    profilePhoto: null,
    identities: [{
      provider: 'password',
      subject: user.email,
      credentialHash: await passwordHash(user.password),
      createdAt: now,
    }],
    passwordReset: null,
    emailVerification: null,
    emailVerifiedAt: now,
    sessionVersion: 0,
    createdAt: now,
    updatedAt: now,
  })));
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFile, JSON.stringify({
    schemaVersion: 9,
    users: storedUsers,
    routineExercises: [],
    routinePlans: [],
    dietPlans: [],
    calorieCalculations: [],
    specialistProfiles: [],
    specialistRequests: [],
  }), 'utf8');
}

function rememberCookies(response) {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0];
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }
}

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

function startServer(accessMode = 'authenticated') {
  serverOutput = '';
  server = spawn(process.execPath, ['./dist/server/entry.mjs'], {
    cwd: workspace,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: port,
      NODE_ENV: 'test',
      APP_ORIGIN: origin,
      APP_ACCESS_MODE: accessMode,
      AUTH_PROVIDER: 'password',
      DATA_FILE_PATH: dataFile,
      UPLOADS_DIRECTORY: uploadsDirectory,
      SESSION_TTL_SECONDS: '600',
    },
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    once(server, 'exit'),
    new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server?.exitCode !== null) throw new Error(`El servidor terminó antes de iniciar.\n${serverOutput}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // El puerto aún no está listo; el siguiente intento vuelve a comprobarlo.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`El servidor no respondió a tiempo.\n${serverOutput}`);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  const cookie = cookieHeader();
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(`${origin}${path}`, { redirect: 'manual', ...options, headers });
  rememberCookies(response);
  return response;
}

async function post(path, values, expectedLocation) {
  const response = await request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      origin,
    },
    body: new URLSearchParams(values),
  });
  if (response.status !== 303 || response.headers.get('location') !== expectedLocation) {
    throw new Error(`${path} respondió ${response.status} → ${response.headers.get('location')}.`);
  }
}

async function postMultipart(path, form, expectedLocation) {
  const response = await request(path, {
    method: 'POST',
    headers: { origin },
    body: form,
  });
  if (response.status !== 303 || response.headers.get('location') !== expectedLocation) {
    throw new Error(`${path} respondió ${response.status} → ${response.headers.get('location')}.`);
  }
}

async function pageHtml(path) {
  const response = await request(path);
  const html = await response.text();
  if (response.status !== 200) throw new Error(`${path} respondió ${response.status}.`);
  return html;
}

async function expectPage(path, text) {
  const response = await request(path);
  const html = await response.text();
  if (response.status !== 200 || !html.includes(text)) {
    const visibleClue = html.match(/(?:Construye|Vista demo)[^<]{0,80}/)?.[0] ?? 'sin pista visible';
    throw new Error(`${path} no mostró el contenido esperado: ${text}. Respuesta: ${visibleClue}.\n${serverOutput}`);
  }
}

async function expectRedirect(path, expectedLocation, expectedStatus = 302) {
  const response = await request(path);
  if (response.status !== expectedStatus || response.headers.get('location') !== expectedLocation) {
    throw new Error(`${path} respondió ${response.status} → ${response.headers.get('location')}.`);
  }
}

try {
  await rm(dataFile, { force: true });
  await rm(uploadsDirectory, { recursive: true, force: true });
  const email = `smoke-${Date.now()}@example.test`;
  const clientEmail = `cliente-${Date.now()}@example.test`;
  let password = 'Prueba-segura-2026';
  const renewedPassword = 'Prueba-renovada-2026';
  await seedVerifiedUsers([
    { id: 'smoke-user', name: 'Usuario de prueba', email, password, birthDate: '1990-05-10' },
    { id: 'smoke-client', name: 'Cliente de prueba', email: clientEmail, password: renewedPassword, birthDate: '1994-02-20' },
  ]);
  startServer();
  await waitForServer();

  await post('/api/auth/login', { email, password }, '/app');
  await expectPage('/app', 'Construye, Usuario.');
  const dashboardHtml = await pageHtml('/app');
  for (const label of ['Mi Imperio', 'Herramientas', 'Blog', 'Perfil']) {
    if (!dashboardHtml.includes(label)) {
      throw new Error(`El header no mostró la opción ${label}.`);
    }
  }
  await expectPage('/app/perfil', 'Mi perfil');
  await post('/api/profile/name', { name: 'Usuario actualizado' }, '/app/perfil?updated=name');
  await expectPage('/app/perfil', 'Usuario actualizado');
  await post('/api/profile/password', {
    currentPassword: password,
    newPassword: renewedPassword,
    passwordConfirmation: renewedPassword,
  }, '/app/perfil?updated=password');
  password = renewedPassword;

  await post('/api/routine/automatic/generate', {
    goal: 'hipertrofia', level: 'intermedio', location: 'gimnasio',
    sessionDurationMinutes: '60', restDaysCount: '2',
    limitations: '',
  }, '/app/rutina?tab=ai&saved=ai');
  await expectPage('/app/rutina?tab=ai', 'Rutina semanal de hipertrofia');
  const automaticRoutinePdf = await request('/api/routine/pdf/ai');
  if (automaticRoutinePdf.status !== 200 || automaticRoutinePdf.headers.get('content-type') !== 'application/pdf') {
    throw new Error('La rutina automática no produjo una descarga PDF válida.');
  }
  const routineDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((day, index) => ({
    day,
    title: index === 6 ? 'Recuperación' : `Sesión manual ${index + 1}`,
    focus: index === 6 ? 'Descanso' : 'Técnica de prueba',
    isRestDay: index === 6,
    exercises: index === 6 ? [] : [{
      name: `Ejercicio manual ${index + 1}`, muscle: index % 2 ? 'Espalda' : 'Pecho',
      prescriptionType: 'repetitions', sets: 3, reps: '8-12', durationMinutes: null,
      restSeconds: 90, tempo: '3-1-1', notes: 'Registro end-to-end',
    }],
  }));
  await post('/api/routine/manual/save', {
    title: 'Rutina manual de prueba', summary: 'Documento semanal creado por el usuario.',
    goal: 'general', level: 'principiante', location: 'casa', sessionDurationMinutes: '45',
    limitations: '', days: JSON.stringify(routineDays),
  }, '/app/rutina?tab=manual&saved=manual');
  await expectPage('/app/rutina?tab=manual', 'Rutina manual de prueba');
  const manualRoutinePdf = await request('/api/routine/pdf/manual');
  if (manualRoutinePdf.status !== 200 || manualRoutinePdf.headers.get('content-type') !== 'application/pdf') {
    throw new Error('La rutina manual no produjo una descarga PDF válida.');
  }

  await post('/api/calories/calculate', {
    age: '36', sex: 'female', weightKg: '65', heightCm: '165', activityFactor: '1.55',
  }, '/app/calculadora?calculated=1');
  await expectPage('/app/calculadora', 'Tus últimas estimaciones');

  await post('/api/diet/save', {
    goal: 'mantener', preference: 'vegetariana', meals: '4',
  }, '/app/dieta?tab=ai&saved=ai');
  await expectPage('/app/dieta?tab=ai', 'Plan para mantener energía y rendimiento');
  const aiPdf = await request('/api/diet/pdf/ai');
  if (
    aiPdf.status !== 200
    || aiPdf.headers.get('content-type') !== 'application/pdf'
    || !aiPdf.headers.get('content-disposition')?.startsWith('attachment;')
  ) {
    throw new Error('La dieta automática no produjo una descarga PDF válida.');
  }

  const manualEntries = Array.from({ length: 7 }, (_, index) => ({
    type: index === 0 ? 'Desayuno' : `Colación ${index}`,
    title: `Comida manual ${index + 1}`,
    time: '',
    ingredients: [{ name: 'Avena', amount: 60 + index, unit: 'g', note: 'Peso en seco' }],
    preparation: 'Mezclar y servir.',
    notes: '',
    estimatedCaloriesKcal: 250,
  }));
  await post('/api/diet/manual/save', {
    title: 'Plan manual de siete comidas',
    summary: 'Documento personalizado en la prueba completa.',
    goal: 'mantener',
    preference: 'general',
    entries: JSON.stringify(manualEntries),
    caloriesKcal: '', proteinG: '', carbsG: '', fatG: '',
  }, '/app/dieta?tab=manual&saved=manual');
  await expectPage('/app/dieta?tab=manual', 'Plan manual de siete comidas');

  const professionalForm = new FormData();
  professionalForm.set(
    'presentation',
    'Acompaño objetivos de fuerza y nutrición con seguimiento claro, humano y progresivo.',
  );
  professionalForm.set(
    'experience',
    'Más de cinco años documentando programas de entrenamiento y educación alimentaria.',
  );
  professionalForm.append('roles', 'trainer');
  professionalForm.append('roles', 'nutritionist');
  professionalForm.set('photo', new File([
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  ], 'perfil-prueba.png', { type: 'image/png' }));
  professionalForm.append('certificates', new File([
    new TextEncoder().encode('%PDF-1.4\n%%EOF'),
  ], 'certificado-prueba.pdf', { type: 'application/pdf' }));
  await postMultipart(
    '/api/specialists/profile/create',
    professionalForm,
    '/app/mi-trabajo?registered=1',
  );
  await expectPage('/app/mi-trabajo', 'Entrenamiento');
  await expectPage('/app/mi-trabajo', 'Nutrición');

  const specialistPage = await pageHtml('/app/especialistas');
  const mediaPaths = [...new Set(
    [...specialistPage.matchAll(/\/api\/specialists\/media\/[^"']+/g)].map((match) => match[0]),
  )];
  const mediaPath = mediaPaths[0];
  if (!mediaPath) throw new Error('El perfil no publicó una referencia segura a su fotografía.');
  const mediaResponse = await request(mediaPath);
  if (mediaResponse.status !== 200 || mediaResponse.headers.get('content-type') !== 'image/png') {
    throw new Error('La fotografía privada del especialista no pudo recuperarse.');
  }
  const certificatePath = mediaPaths.find((path) => path !== mediaPath);
  if (!certificatePath) throw new Error('El perfil no publicó el certificado opcional.');
  const certificateResponse = await request(certificatePath);
  if (
    certificateResponse.status !== 200
    || certificateResponse.headers.get('content-type') !== 'application/pdf'
    || !certificateResponse.headers.get('content-disposition')?.startsWith('attachment;')
  ) {
    throw new Error('El certificado privado no se sirvió como descarga PDF segura.');
  }

  const profilePhotoForm = new FormData();
  profilePhotoForm.set('photo', new File([
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  ], 'foto-personal.png', { type: 'image/png' }));
  await postMultipart('/api/profile/photo', profilePhotoForm, '/app/perfil?updated=photo');
  const profileHtml = await pageHtml('/app/perfil');
  const profilePhotoPath = profileHtml.match(/\/api\/profile\/photo\/[^"']+/)?.[0];
  if (!profilePhotoPath) throw new Error('Mi perfil no mostró la fotografía personal guardada.');
  const profilePhotoResponse = await request(profilePhotoPath);
  if (profilePhotoResponse.status !== 200 || profilePhotoResponse.headers.get('content-type') !== 'image/png') {
    throw new Error('La fotografía personal no pudo recuperarse desde una cuenta autenticada.');
  }

  await stopServer();
  cookies.clear();
  startServer();
  await waitForServer();
  await post('/api/auth/login', { email, password }, '/app');
  await expectPage('/app/rutina?tab=ai', 'Rutina semanal de hipertrofia');
  await expectPage('/app/mi-trabajo', 'Mi trabajo');

  await post('/api/auth/logout', {}, '/');
  await post('/api/auth/login', { email: clientEmail, password }, '/app');
  const directoryHtml = await pageHtml('/app/especialistas');
  if (!directoryHtml.includes('Usuario actualizado')) {
    throw new Error('El directorio no mostró al especialista registrado.');
  }
  const profileId = directoryHtml.match(/name="specialistProfileId" value="([^"]+)"/)?.[1];
  if (!profileId) throw new Error('El directorio no expuso un identificador de perfil solicitables.');
  const searchHtml = await pageHtml(
    `/app/especialistas?specialistId=${encodeURIComponent(` ${profileId.toUpperCase()} `)}`,
  );
  const foundProfileIds = [...searchHtml.matchAll(
    /name="specialistProfileId" value="([^"]+)"/g,
  )].map((match) => match[1]);
  if (
    !searchHtml.includes('Especialista encontrado')
    || foundProfileIds.length !== 2
    || foundProfileIds.some((id) => id !== profileId)
  ) {
    throw new Error('El buscador no mostró el perfil híbrido en sus dos especialidades.');
  }
  const missingSearchHtml = await pageHtml('/app/especialistas?specialistId=no-existe');
  if (
    !missingSearchHtml.includes('No encontramos ese especialista')
    || missingSearchHtml.includes('name="specialistProfileId"')
  ) {
    throw new Error('El buscador no representó correctamente un identificador inexistente.');
  }
  await post('/api/specialists/request/create', {
    specialistProfileId: profileId,
    role: 'nutritionist',
  }, '/app/especialistas?requested=nutritionist');
  await expectPage('/app/especialistas', 'Esperando respuesta');

  await post('/api/auth/logout', {}, '/');
  await post('/api/auth/login', { email, password }, '/app');
  const workHtml = await pageHtml('/app/mi-trabajo');
  if (!workHtml.includes('Cliente de prueba') || !workHtml.includes('Solicitantes')) {
    throw new Error('Mi trabajo no clasificó la nueva solicitud como solicitante.');
  }
  const requestId = workHtml.match(/name="requestId" value="([^"]+)"/)?.[1];
  if (!requestId) throw new Error('Mi trabajo no expuso el identificador de solicitud.');
  await post('/api/specialists/request/action', {
    requestId,
    action: 'accept',
  }, '/app/mi-trabajo?updated=accept');
  const acceptedHtml = await pageHtml('/app/mi-trabajo');
  if (!acceptedHtml.includes('Asesorados') || !acceptedHtml.includes('Cliente de prueba')) {
    throw new Error('La solicitud aceptada no pasó a Asesorados.');
  }
  const nutritionEditorPath = acceptedHtml.match(/\/app\/mi-trabajo\/nutricion\/[^"']+/)?.[0];
  if (!nutritionEditorPath) throw new Error('El nutricionista no recibió acceso al editor del asesorado.');
  await expectPage(nutritionEditorPath, 'Crear dieta de especialista');
  const specialistEntries = manualEntries.slice(0, 5).map((entry, index) => ({
    ...entry,
    title: `Comida profesional ${index + 1}`,
  }));
  await post('/api/diet/specialist/save', {
    requestId,
    title: 'Plan profesional de prueba',
    summary: 'Documento asignado por el nutricionista.',
    goal: 'mantener', preference: 'general',
    entries: JSON.stringify(specialistEntries),
    caloriesKcal: '', proteinG: '', carbsG: '', fatG: '',
  }, `${nutritionEditorPath}?saved=specialist`);
  await expectPage(nutritionEditorPath, 'Plan profesional de prueba');

  await post('/api/auth/logout', {}, '/');
  await post('/api/auth/login', { email: clientEmail, password }, '/app');
  await expectPage('/app/dieta?tab=specialist', 'Plan profesional de prueba');
  const specialistPdf = await request('/api/diet/pdf/specialist');
  if (specialistPdf.status !== 200 || specialistPdf.headers.get('content-type') !== 'application/pdf') {
    throw new Error('El usuario no pudo descargar la dieta asignada por su especialista.');
  }

  await post('/api/specialists/request/create', {
    specialistProfileId: profileId,
    role: 'trainer',
  }, '/app/especialistas?requested=trainer');
  await post('/api/auth/logout', {}, '/');
  await post('/api/auth/login', { email, password }, '/app');
  const trainerWorkHtml = await pageHtml('/app/mi-trabajo');
  const trainerRequestId = [...trainerWorkHtml.matchAll(/name="requestId" value="([^"]+)"/g)]
    .map((match) => match[1])
    .find((id) => id !== requestId);
  if (!trainerRequestId) throw new Error('Mi trabajo no expuso la solicitud de entrenamiento.');
  await post('/api/specialists/request/action', {
    requestId: trainerRequestId,
    action: 'accept',
  }, '/app/mi-trabajo?updated=accept');
  const acceptedTrainerHtml = await pageHtml('/app/mi-trabajo');
  const trainingEditorPath = acceptedTrainerHtml.match(/\/app\/mi-trabajo\/entrenamiento\/[^"']+/)?.[0];
  if (!trainingEditorPath) throw new Error('El entrenador no recibió acceso al editor del asesorado.');
  await expectPage(trainingEditorPath, 'Crear rutina de especialista');
  const specialistRoutineDays = routineDays.map((day, index) => ({
    ...day,
    title: day.isRestDay ? 'Recuperación profesional' : `Sesión profesional ${index + 1}`,
  }));
  await post('/api/routine/specialist/save', {
    requestId: trainerRequestId,
    title: 'Rutina profesional de prueba', summary: 'Documento asignado por el entrenador.',
    goal: 'fuerza', level: 'intermedio', location: 'gimnasio', sessionDurationMinutes: '60',
    limitations: '', days: JSON.stringify(specialistRoutineDays),
  }, `${trainingEditorPath}?saved=specialist`);
  await expectPage(trainingEditorPath, 'Rutina profesional de prueba');

  await post('/api/auth/logout', {}, '/');
  await post('/api/auth/login', { email: clientEmail, password }, '/app');
  await expectPage('/app/rutina?tab=specialist', 'Rutina profesional de prueba');
  const trainerPdf = await request('/api/routine/pdf/specialist');
  if (trainerPdf.status !== 200 || trainerPdf.headers.get('content-type') !== 'application/pdf') {
    throw new Error('El usuario no pudo descargar la rutina asignada por su entrenador.');
  }

  await post('/api/auth/logout', {}, '/');
  const protectedResponse = await request('/app');
  if (protectedResponse.status !== 302 || !protectedResponse.headers.get('location')?.startsWith('/iniciar-sesion')) {
    throw new Error('La ruta privada no rechazó la sesión cerrada.');
  }

  await stopServer();
  cookies.clear();
  await rm(dataFile, { force: true });
  await rm(uploadsDirectory, { recursive: true, force: true });
  startServer('demo');
  await waitForServer();

  await expectRedirect('/iniciar-sesion', '/app');
  await expectRedirect('/registro', '/app');
  const demoHome = await request('/');
  const demoHomeHtml = await demoHome.text();
  if (
    demoHome.status !== 200
    || !demoHomeHtml.includes('Explorar el menú')
    || demoHomeHtml.includes('Iniciar sesión')
    || demoHomeHtml.includes('Crear cuenta')
  ) {
    throw new Error('La portada demo no ocultó correctamente login y registro.');
  }
  await expectPage('/app', 'Vista demo compartida');
  await expectPage('/app/especialistas', 'Forma parte de los especialistas');
  await post('/api/auth/register', {}, '/app');
  await post('/api/routine/automatic/generate', {
    goal: 'fuerza', level: 'principiante', location: 'casa',
    sessionDurationMinutes: '45', restDaysCount: '2',
    limitations: '',
  }, '/app/rutina?tab=ai&saved=ai');
  await expectPage('/app/rutina?tab=ai', 'Rutina semanal de fuerza');

  await stopServer();
  cookies.clear();
  startServer('demo');
  await waitForServer();
  await expectPage('/app/rutina?tab=ai', 'Rutina semanal de fuerza');

  console.log('Smoke test SSR completado: auth, especialistas, archivos, solicitudes, modo demo y persistencia funcionan.');
} finally {
  await stopServer();
  await rm(dataFile, { force: true });
  await rm(uploadsDirectory, { recursive: true, force: true });
}
