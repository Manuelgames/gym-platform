# Variables de entorno

## Principios

La configuración se lee y valida en un módulo exclusivo del servidor. El resto de la aplicación recibe un objeto de configuración ya tipado.

Reglas:

- Nunca incluir secretos reales en `.env.example`.
- No subir `.env`, `.env.local` ni archivos equivalentes.
- Solo las variables con prefijo `PUBLIC_` pueden llegar al navegador.
- Un client ID o configuración web identifica una aplicación, pero una cuenta de servicio y un client secret sí son secretos.
- Fallar al arrancar si falta una variable necesaria para el proveedor seleccionado.
- No exigir variables de proveedores que no están activos.
- No imprimir valores secretos en errores o logs.

## Variables generales

| Variable | Obligatoria | Ejemplo | Uso |
| --- | --- | --- | --- |
| `NODE_ENV` | Sí | `development` | Selecciona comportamiento de desarrollo o producción |
| `APP_ORIGIN` | Sí | `http://localhost:4321` | Origen canónico para redirecciones y comprobación de peticiones |
| `APP_ACCESS_MODE` | No | `demo` | `authenticated` exige identidad; `demo` usa un perfil compartido |
| `DATA_FILE_PATH` | Con persistencia de archivo | `.data/roman-colosseum.json` | Archivo JSON privado del servidor |
| `UPLOADS_DIRECTORY` | Con medios administrados | `.data/uploads` | Fotografías personales, profesionales y certificados privados |
| `AUTH_PROVIDER` | Sí | `password` | `password`, `google` o `firebase` |
| `SESSION_TTL_SECONDS` | Sí | `604800` | Duración máxima de sesión en segundos |
| `BREVO_API_KEY` | Para recuperación con Brevo | Secreto de Brevo | Permite enviar enlaces mediante API HTTPS sin dominio propio |
| `RECOVERY_EMAIL_FROM` | Para recuperación por correo | `tucorreo@gmail.com` | Dirección remitente verificada en el proveedor elegido |
| `RESEND_API_KEY` | Opcional, alternativa a Brevo | Secreto de Resend | Requiere un dominio propio verificado para usuarios reales |
| `OPENAI_API_KEY` | No | `sk-...` | Habilita generación remota de dietas; nunca llega al navegador |
| `OPENAI_MODEL` | No | `gpt-5.6-terra` | Modelo de Responses API; usa el valor predeterminado si se omite |

### `NODE_ENV`

Valores habituales:

- `development`
- `test`
- `production`

En producción las cookies deben usar `Secure` y la aplicación debe operar detrás de HTTPS.

### `APP_ORIGIN`

Debe contener esquema, host y puerto cuando aplique, sin una ruta adicional:

```dotenv
APP_ORIGIN=https://app.example.com
```

No se construye a partir de un encabezado `Host` no confiable para callbacks sensibles.

### `APP_ACCESS_MODE`

Valores admitidos:

```text
authenticated | demo
```

`authenticated` resuelve el usuario desde Astro Sessions y protege `/app`. Es el valor seguro usado si la variable no existe. `demo` oculta y bloquea las rutas de registro, login, recuperación y logout; middleware asigna el propietario persistente `demo-user-v1` a las páginas y APIs funcionales.

El perfil demo se comparte dentro de la instancia y no proporciona aislamiento entre visitantes. Debe limitarse al desarrollo o a una demostración controlada. Esta variable no selecciona Google, Firebase ni la base de datos; esas decisiones permanecen separadas.

### `DATA_FILE_PATH`

El directorio debe existir o poder crearse con permisos restringidos. No puede apuntar a `public/`. En plataformas de disco efímero no ofrece permanencia real.

### `UPLOADS_DIRECTORY`

Directorio privado, separado de `public/`, donde el adaptador local guarda fotografías personales, profesionales y certificados. Los nombres físicos son identificadores opacos; el nombre original solo se conserva como metadato validado.

La instancia debe disponer de escritura y almacenamiento persistente. En producción distribuida se sustituye por almacenamiento de objetos; no se comparte una carpeta local entre réplicas sin coordinación.

### `AUTH_PROVIDER`

Valores admitidos:

```text
password | google | firebase
```

La validación debe rechazar cualquier otro valor con un mensaje claro de configuración. En la versión inicial solo `password` tiene un adaptador operativo. `google` y `firebase` son valores reservados: seleccionarlos antes de implementar su integración debe producir un error explícito, no un fallback.

### `SESSION_TTL_SECONDS`

Debe ser un entero positivo. Siete días equivalen a `604800`. La configuración de Astro Sessions y la vigencia de su cookie deben derivarse del mismo valor.

El nombre `roman_colosseum_session` y los atributos `HttpOnly`, `SameSite=Lax`, `Secure` en producción y `Path=/` pertenecen a la configuración de Astro. No se introdujo otra variable de entorno para evitar una opción innecesaria; cambiar el nombre requiere actualizar esa configuración y las pruebas de integración.

### Confirmación y recuperación por correo

`BREVO_API_KEY` y `RECOVERY_EMAIL_FROM` se configuran juntas, exclusivamente en el servidor. Sirven tanto para activar cuentas nuevas como para recuperar contraseñas. Primero se verifica en Brevo una dirección de correo a la que tengas acceso. Brevo puede sustituir la dirección visible si se utiliza un correo gratuito; es una solución temporal y la entrega no está garantizada. El plan gratuito tiene un límite diario y la cuenta puede requerir aprobación para empezar a enviar. La alternativa `RESEND_API_KEY` requiere un dominio propio verificado para destinatarios reales; si se configuran ambas claves, se usa Brevo. Si faltan la clave del proveedor y el remitente, los formularios indican que el envío aún no está disponible; no se expone si la cuenta existe. Railway Hobby requiere una API HTTPS porque no habilita SMTP saliente. `APP_ORIGIN` debe coincidir con la URL pública HTTPS, ya que se usa para construir ambos enlaces.

### Generación de dietas con IA

`OPENAI_API_KEY` es opcional y exclusiva del servidor. Si no existe o el proveedor no responde, la aplicación genera un plan mediante el motor local, persiste `generationEngine=local` y lo identifica de esa forma en la interfaz. Nunca se sustituye silenciosamente el origen registrado del documento.

Las peticiones remotas usan Responses API, salida estructurada con JSON Schema estricto y `store=false`. `OPENAI_MODEL` permite cambiar el modelo sin modificar la aplicación; el valor predeterminado es `gpt-5.6-terra`.

## Google Identity Services

| Variable | Exposición | Uso |
| --- | --- | --- |
| `PUBLIC_GOOGLE_CLIENT_ID` | Cliente y servidor | Identifica la aplicación y se valida como audiencia |
| `GOOGLE_CLIENT_SECRET` | Solo servidor | Intercambio de código si el flujo lo requiere |
| `GOOGLE_REDIRECT_URI` | Solo servidor/configuración | Callback registrado en Google Cloud |

Cuando `AUTH_PROVIDER=google`, son obligatorios `PUBLIC_GOOGLE_CLIENT_ID` y `GOOGLE_REDIRECT_URI`. `GOOGLE_CLIENT_SECRET` solo se exige si la implementación usa código de autorización.

Ejemplo local, sin valores reales:

```dotenv
PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4321/api/auth/google/callback
```

El redirect URI debe coincidir exactamente con uno registrado en la consola de Google, incluido esquema, puerto y ruta.

## Firebase

### Configuración web

| Variable | Exposición | Uso |
| --- | --- | --- |
| `PUBLIC_FIREBASE_API_KEY` | Cliente | Identifica la aplicación web de Firebase |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | Cliente | Dominio de autenticación |
| `PUBLIC_FIREBASE_PROJECT_ID` | Cliente y servidor | Proyecto esperado |
| `PUBLIC_FIREBASE_APP_ID` | Cliente | Identificador de la aplicación web |

Estos valores aparecen normalmente en el JavaScript de una aplicación Firebase y no deben tratarse como autorización. La seguridad depende de Authentication, validación del servidor y reglas de acceso.

### Configuración administrativa

| Variable | Exposición | Uso |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | Solo servidor | Cuenta de servicio codificada en Base64 |
| `FIREBASE_DATABASE_ID` | Solo servidor/configuración | Base Firestore; puede ser `(default)` |

La cuenta de servicio concede privilegios. Debe guardarse en el gestor de secretos del entorno de despliegue, con el mínimo rol necesario.

Cuando `AUTH_PROVIDER=firebase`, la verificación en servidor exige al menos proyecto y credenciales administrativas, salvo que la plataforma use credenciales predeterminadas explícitamente soportadas por la implementación.

## Crear el valor Base64 de Firebase

El procedimiento se ejecuta localmente sobre un archivo de cuenta de servicio que no se versiona.

En PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('service-account.json'))
```

En macOS o Linux:

```bash
base64 < service-account.json | tr -d '\n'
```

El resultado completo se coloca como secreto `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`. No debe copiarse a documentación, incidencias, capturas ni logs.

## Matriz de validación

| Proveedor | Variables adicionales requeridas |
| --- | --- |
| `password` | Ninguna de Google o Firebase |
| `google` | Adaptador futuro; después requerirá `PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` y secret si usa code flow |
| `firebase` | Adaptador futuro; después requerirá configuración Firebase y credenciales Admin |

`DATA_FILE_PATH` sigue siendo necesario con cualquiera de los tres proveedores mientras el adaptador de persistencia sea el archivo. Seleccionar Google o Firebase Authentication no mueve automáticamente los datos.

## Desarrollo, pruebas y producción

### Desarrollo

```dotenv
NODE_ENV=development
APP_ORIGIN=http://localhost:4321
APP_ACCESS_MODE=demo
DATA_FILE_PATH=.data/roman-colosseum.json
UPLOADS_DIRECTORY=.data/uploads
AUTH_PROVIDER=password
SESSION_TTL_SECONDS=604800
```

### Pruebas

Las pruebas deben usar un archivo temporal independiente y nunca el archivo de desarrollo. Cada ejecución crea y elimina únicamente su directorio temporal controlado.

### Producción

- `APP_ORIGIN` usa HTTPS.
- `APP_ACCESS_MODE=authenticated`, salvo una demostración pública deliberada y desechable.
- Los secretos se inyectan desde la plataforma.
- El proceso tiene acceso mínimo al archivo o base de datos.
- Se confirma que el volumen sea persistente si aún se usa JSON.
- Se confirma que `UPLOADS_DIRECTORY` sea privado, persistente y respaldado.
- No se reutilizan credenciales de desarrollo.
- Se prueba el callback exacto del proveedor.

## Diagnóstico seguro

Al arrancar puede registrarse:

- entorno actual;
- proveedor seleccionado;
- si cada variable requerida está presente;
- ruta resuelta del archivo, si no revela información sensible de la plataforma.

No se registra:

- valor de cookies;
- contraseñas;
- tokens de identidad;
- cuenta de servicio decodificada;
- client secret;
- contenido del archivo de datos.
