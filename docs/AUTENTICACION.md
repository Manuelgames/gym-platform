# Autenticación

## Responsabilidades separadas

Roman Colosseum distingue:

- **Identidad:** cómo una persona demuestra quién es mediante contraseña, Google o Firebase.
- **Sesión:** cómo Astro conserva temporalmente el `userId` autenticado entre peticiones.
- **Persistencia funcional:** dónde se guardan usuarios, rutinas, dietas y cálculos.

Cambiar el proveedor de identidad no mueve el progreso. Cambiar la base de datos no cambia las reglas de login.

Google Identity Services cubre identidad. **No guarda rutinas, dietas ni cálculos.** Firebase Authentication también cubre identidad; Firestore es el producto de Firebase que puede cubrir persistencia.

## Modelo neutral al proveedor

Un usuario mantiene una o más identidades:

```ts
type IdentityProvider = 'password' | 'google' | 'firebase';

interface UserIdentity {
  provider: IdentityProvider;
  subject: string;
  credentialHash?: string;
  createdAt: string;
}
```

Reglas:

- `subject` identifica a la cuenta dentro de su proveedor.
- La combinación `(provider, subject)` es única.
- `credentialHash` solo está permitido para `password`.
- Google y Firebase nunca guardan ID tokens, access tokens ni refresh tokens.

Los adaptadores externos producen un resultado común:

```ts
interface VerifiedExternalIdentity {
  provider: 'google' | 'firebase';
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
}

interface ExternalIdentityVerifier {
  readonly provider: 'google' | 'firebase';
  verifyIdToken(idToken: string): Promise<VerifiedExternalIdentity>;
}
```

Los tipos y errores propios de cada SDK quedan dentro de infraestructura.

## Acceso temporal sin login

`APP_ACCESS_MODE=demo` es una política de presentación y autorización temporal; no es un proveedor de identidad. En este modo:

1. `/iniciar-sesion`, `/registro` y las pantallas de recuperación redirigen a `/app`.
2. Los endpoints `/api/auth/*` no ejecutan registro, login, recuperación ni logout.
3. Middleware obtiene o crea `demo-user-v1` y lo publica como `Astro.locals.user` solo para las rutas funcionales.
4. Rutina, dieta y cálculos siguen recibiendo el propietario desde `locals`, nunca desde el formulario.
5. No se crea una cookie de sesión para el perfil demo.

El usuario reservado tiene una identidad password con un hash derivado de un secreto aleatorio descartado inmediatamente. Por ello no existe una contraseña con la cual iniciar sesión como ese perfil. El usuario y su progreso se conservan al volver a `authenticated`, pero no se asignan automáticamente a otra cuenta.

El modo demo comparte datos entre visitantes y solo es adecuado para desarrollo o entornos controlados. La ausencia o un valor inválido de la variable nunca debe habilitarlo silenciosamente.

## Proveedor `password`

Con `AUTH_PROVIDER=password`, la aplicación administra una identidad local.

### Registro

`POST /api/auth/register` ejecuta:

1. Lectura y validación del formulario.
2. Normalización de email y nombre.
3. Validación de contraseña de 8 a 128 caracteres, con al menos un número y un carácter especial.
4. Comprobación server-side de que la confirmación coincide.
5. Comprobación de unicidad del email.
6. Hash `scrypt` con sal aleatoria.
7. Creación atómica de `User` con identidad `password`.
8. Emisión de un token aleatorio cuya única huella se guarda durante 24 horas.
9. Envío del enlace de confirmación mediante Brevo o Resend.
10. Redirección a `/confirmar-correo` sin crear todavía una sesión.

La contraseña original solo existe durante la petición y nunca se persiste ni se registra. El enlace abre `/verificar-correo` y se consume mediante POST para evitar que un previsualizador de correo active la cuenta. Después de confirmarlo, la persona inicia sesión normalmente. Solicitar otro enlace invalida el anterior y usa respuestas genéricas para no revelar si una cuenta existe.

La política reforzada solo se aplica al crear una credencial nueva (registro, cambio o recuperación). El inicio de sesión conserva la validación de longitud compatible con cuentas anteriores: un hash `scrypt` no permite inspeccionar retroactivamente la composición de la contraseña original.

### Inicio de sesión

`POST /api/auth/login`:

1. Normaliza el email.
2. Busca el usuario y su identidad `password`.
3. Verifica el hash con el servicio de seguridad.
4. Rechaza la cuenta si su correo aún no fue confirmado.
5. Regenera la sesión para prevenir fijación.
6. Guarda `userId` y `sessionVersion`.
7. Redirige al panel.

La respuesta pública debe ser genérica, por ejemplo “Correo o contraseña incorrectos”. Diferenciar email inexistente de contraseña incorrecta facilita enumerar cuentas.

Los endpoints aplican un limitador por proceso: login por IP y cuenta seudonimizada, registro por IP, y confirmación/reenvío por IP y cuenta seudonimizada. Los intentos correctos de login liberan su reserva para no penalizar al usuario legítimo. Este adaptador protege una sola instancia; un despliegue con varias réplicas debe sustituirlo por un limitador compartido (por ejemplo, Redis o el servicio equivalente de la plataforma).

Railway termina HTTPS delante del proceso Node y le entrega una URL interna diferente del `Origin` público. Por ello se desactiva `security.checkOrigin` de Astro, que compararía esos dos valores y rechazaría formularios legítimos. La protección CSRF no se elimina: todos los endpoints POST llaman `assertTrustedFormOrigin` y comparan el encabezado del navegador contra el origen exacto de `APP_ORIGIN`. Una prueba de cobertura impide añadir un POST sin esa validación.

Las páginas que reciben tokens por URL (`/verificar-correo` y `/restablecer-contrasena`) usan `Referrer-Policy: strict-origin`. Así el navegador no comparte la ruta ni el token como referencia, pero conserva un encabezado `Origin` válido al enviar su formulario. `no-referrer` no se usa en estas páginas porque convierte el origen de un POST de navegación en `null` y bloquearía la comprobación CSRF.

### Recuperación de contraseña

Desde `/iniciar-sesion` se accede a `/recuperar-contrasena`. El servidor siempre muestra la misma confirmación para un correo existente o desconocido. Para una cuenta local genera 32 bytes aleatorios, guarda únicamente SHA-256 del token en `User.passwordReset` con vencimiento de 30 minutos y envía un enlace mediante una API HTTPS. Un nuevo enlace reemplaza el anterior.

`/restablecer-contrasena` permite establecer una nueva contraseña con el token. La actualización del hash, el consumo del enlace y el incremento de `sessionVersion` ocurren en una sola actualización condicional del usuario. El middleware rechaza las sesiones con una versión anterior. El enlace no inicia sesión automáticamente. Se limita la frecuencia por IP y correo seudonimizado.

El envío de recuperación y confirmación usa la API HTTPS de Brevo, compatible con Railway Hobby y su plan gratuito. Se configuran `BREVO_API_KEY` y `RECOVERY_EMAIL_FROM` con una dirección propia verificada en Brevo; no hace falta comprar un dominio al inicio. Si el remitente es un correo gratuito, Brevo puede sustituir la dirección visible por una propia y la entrega puede ser menos fiable. Al contar con dominio propio, se podrá verificar para mejorar la entrega o cambiar a Resend mediante `RESEND_API_KEY`; si ambas claves están presentes, se prefiere Brevo. Sin clave y remitente, ambos formularios informan que el correo no está disponible. Los adaptadores comparten el mismo puerto y no cambian el caso de uso. Los enlaces se construyen con `APP_ORIGIN`, nunca con la cabecera Host.

## Astro Sessions

La aplicación no crea un repositorio propio de sesiones dentro de `DATA_FILE_PATH`. Usa la API nativa de Astro.

Contenido funcional de sesión:

```ts
interface SessionData {
  userId: string;
  sessionVersion: number;
}
```

No se guardan perfil, rutina, dieta, email, hash ni resultado de cálculo en la sesión.

Configuración esperada:

| Propiedad | Valor |
| --- | --- |
| Nombre de cookie | `roman_colosseum_session` |
| `HttpOnly` | Activado |
| `SameSite` | `Lax` |
| `Secure` | Activado en producción HTTPS |
| `Path` | `/` |
| TTL | `SESSION_TTL_SECONDS` |

La forma concreta de almacenamiento y el identificador interno son responsabilidad del driver de Astro. Antes de cambiar adaptador de despliegue se debe confirmar que el driver elegido ofrece la permanencia y concurrencia esperadas.

### Middleware

Con `APP_ACCESS_MODE=authenticated`, en cada ruta privada:

1. Lee `userId` y `sessionVersion` desde `Astro.session`.
2. Busca el usuario actual.
3. Coloca un DTO seguro en `Astro.locals` si existe.
4. Si el usuario ya no existe o la versión no coincide, destruye la sesión inválida.
5. Si no hay usuario, redirige a `/iniciar-sesion` antes de renderizar datos privados.

El middleware no acepta `userId` desde query, formulario, cabecera personalizada ni cuerpo HTTP.

### Logout

`POST /api/auth/logout` llama a `Astro.session.destroy()`, permite que Astro expire la cookie y redirige a una página pública.

Logout no usa `GET`, ya que una precarga, robot o enlace externo podría activarlo sin intención.

### Revocación

Un restablecimiento o cambio de contraseña incrementa `sessionVersion` e invalida todas las sesiones anteriores del usuario en su siguiente petición. Listar dispositivos o invalidar una sesión concreta requiere capacidades adicionales del driver o un registro explícito de sesiones.

## Google Identity Services

### Qué aporta

- Interfaz de inicio con Google.
- Consentimiento administrado por Google.
- Token firmado con un subject estable y claims de perfil.

### Qué no aporta

- No persiste usuarios internos.
- No guarda rutina.
- No guarda dieta.
- No guarda historial calórico.
- No reemplaza Firestore, SQL ni el archivo JSON.

### Flujo implementado

```text
Navegador
  │ obtiene credencial de GIS
  ▼
Endpoint Astro
  │ invoca GoogleIdentityServicesVerifier
  ▼
Firma · issuer · audience · expiración · email verificado
  │
  ▼
SignInWithFederatedIdentity
  │ resuelve UserIdentity por google + subject
  ▼
Astro.session.regenerate()
  │ guarda userId y sessionVersion
  ▼
Cookie de Astro Session
```

El servidor valida:

- firma con claves vigentes de Google;
- issuer permitido;
- `aud` igual a `PUBLIC_GOOGLE_CLIENT_ID`;
- expiración;
- `email_verified` cuando la política depende del email;
- cookie CSRF de doble envío emitida por Google Identity Services en login;
- token CSRF de sesión y mismo origen al vincular Google desde un perfil autenticado.

Decodificar un JWT no equivale a verificarlo.

El flujo utiliza un ID token y no solicita acceso a APIs de Google, por lo que no requiere ni configura un `GOOGLE_CLIENT_SECRET`.

## Firebase Authentication

El navegador puede autenticar con Firebase y enviar un ID token al endpoint. `FirebaseAuthVerifier` usa Admin SDK y produce `VerifiedExternalIdentity`.

Debe comprobar:

- firma y proyecto emisor;
- audiencia;
- expiración;
- UID de Firebase como `subject`;
- email verificado según la política.

Las variables `PUBLIC_FIREBASE_*` identifican la aplicación web y no conceden privilegios administrativos. `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` sí es un secreto crítico y solo existe en servidor.

Firebase Authentication puede usar Google como proveedor ascendente. Para Roman Colosseum esa identidad se registra como `firebase` y su subject es el UID de Firebase, no el access token de Google.

Después de verificar el token, el endpoint regenera Astro Session y guarda `userId` y `sessionVersion`, igual que los otros proveedores.

## Creación y vinculación

Si una identidad Google no está vinculada, se conserva temporalmente en Astro Sessions únicamente `provider`, `subject`, correo, nombre y vencimiento. La aplicación solicita nacimiento e identidad personal y después crea el usuario interno. El ID token nunca se persiste.

No se debe vincular silenciosamente con una cuenta existente solo porque coincide el email. Para vincular otra identidad se recomienda que la persona:

- ya tenga una Astro Session válida; y
- vuelva a autenticar el proveedor que desea vincular.

Una transacción debe garantizar la unicidad de `(provider, subject)`.

## Selección mediante entorno

`AUTH_PROVIDER` reserva estos valores:

- `password`
- `google`
- `firebase`

`password` habilita solamente credenciales locales. `google` mantiene el acceso por contraseña y añade Google Identity Services, permitiendo vincular ambas identidades al mismo usuario. `firebase` continúa reservado y detiene el arranque porque su adaptador todavía no existe.

## Protección de peticiones

- Mutaciones solo mediante `POST` en los endpoints actuales.
- Comprobar `Origin` en peticiones autenticadas.
- Usar `SameSite=Lax` como defensa adicional, no única.
- Añadir token CSRF si se admiten escenarios cross-site.
- Validar `Content-Type`, tamaño y campos.
- Limitar intentos de login y registro.
- No interpolar tokens, cookies, hashes o cuentas de servicio en logs.
- Traducir errores externos a respuestas genéricas.

## Privacidad

- Recopilar solo atributos necesarios.
- Explicar por qué se solicita fecha de nacimiento o selección de fórmula.
- Diseñar eliminación de cuenta y progreso antes de producción.
- Rotar credenciales administrativas mediante el gestor de secretos.
- Mantener el reloj del servidor sincronizado para validar expiraciones.

## Pruebas mínimas

- Dos hashes de la misma contraseña usan sales diferentes.
- Contraseña correcta e incorrecta se verifican apropiadamente.
- Registro y login regeneran sesión.
- Una sesión autenticada contiene `userId` y `sessionVersion`; el alta con Google conserva claims mínimos durante un máximo de diez minutos.
- Logout destruye la sesión.
- Middleware destruye sesión de un usuario eliminado.
- Ruta privada sin sesión redirige antes de renderizar.
- Token Google con audiencia incorrecta es rechazado.
- Token Firebase de otro proyecto es rechazado.
- Una identidad duplicada no crea dos usuarios.
- Un fallo de proveedor no concede sesión ni filtra detalles.
