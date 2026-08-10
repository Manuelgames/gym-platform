# Arquitectura

## Propósito

Esta arquitectura permite migrar la aplicación estática a Astro sin acoplar las reglas de Roman Colosseum a `localStorage`, al sistema de archivos ni a un proveedor de autenticación. El objetivo es que la lógica de rutina, dieta y cálculo permanezca comprensible y testeable aunque cambien la interfaz, la base de datos o el mecanismo de inicio de sesión.

## Contexto funcional

La aplicación contiene cuatro áreas:

1. Cuenta y sesión del usuario.
2. Rutina semanal con ejercicios por día.
3. Plan actual de alimentación.
4. Cálculos calóricos e historial.

El blog y la portada son públicos. El panel, la rutina, la dieta y la calculadora pertenecen a un usuario autenticado.

## Estilo arquitectónico

Se aplica una arquitectura limpia orientada a casos de uso:

```text
┌─────────────────────────────────────────────┐
│ Presentación: Astro, HTML, CSS y HTTP        │
│ páginas · componentes · middleware · API    │
└──────────────────────┬──────────────────────┘
                       │ invoca
┌──────────────────────▼──────────────────────┐
│ Aplicación                                  │
│ casos de uso · DTO · puertos                │
└──────────────────────┬──────────────────────┘
                       │ usa
┌──────────────────────▼──────────────────────┐
│ Dominio                                     │
│ entidades · objetos de valor · políticas    │
└─────────────────────────────────────────────┘
                       ▲
                       │ implementa puertos
┌──────────────────────┴──────────────────────┐
│ Infraestructura                             │
│ archivo JSON · seguridad · Google · Firebase│
└─────────────────────────────────────────────┘
```

La dirección de las dependencias apunta hacia el dominio. El dominio no conoce Astro, rutas HTTP, cookies, archivos, Firebase ni Google.

## Capas

### Dominio

Contiene las reglas que seguirían siendo ciertas aunque la aplicación se ejecutara fuera de la web:

- estructura e invariantes de usuario, ejercicio, dieta y cálculo;
- días de la semana y valores permitidos;
- fórmula Mifflin-St Jeor;
- política para construir una guía de alimentación;
- errores de dominio con códigos estables.

No realiza entrada/salida ni lee variables de entorno.

### Aplicación

Coordina el dominio mediante casos de uso. Define contratos asíncronos para:

- usuarios y credenciales;
- identidades externas;
- ejercicios;
- planes de dieta;
- cálculos calóricos;
- perfiles de especialistas y solicitudes por rama;
- almacenamiento privado de fotografías y certificados;
- reloj, generación de identificadores y hash de contraseñas cuando se necesiten como dependencias sustituibles.

Los casos de uso reciben datos ya convertidos a DTO, aplican autorización y validación, y devuelven resultados que la presentación puede traducir a HTML o JSON.

La presentación depende de un único `ApplicationFacade`:

| Método | Responsabilidad |
| --- | --- |
| `register(input)` | Crea usuario con identidad de contraseña y devuelve `PublicUser` |
| `login(input)` | Verifica identidad de contraseña y devuelve `PublicUser` |
| `getCurrentUser(userId)` | Resuelve un usuario seguro para middleware y UI |
| `getDashboard(userId)` | Obtiene perfil y contadores sobre una vista consistente |
| `getRoutine(userId)` | Devuelve los siete días y total de ejercicios |
| `addRoutineExercise(userId, input)` | Valida y añade un ejercicio |
| `deleteRoutineExercise(userId, exerciseId)` | Elimina únicamente un ejercicio propio |
| `getDiet(userId)` | Devuelve plan vigente y guía derivada |
| `saveDiet(userId, input)` | Crea o reemplaza el plan vigente |
| `getCalories(userId)` | Lista el historial más reciente primero |
| `calculateCalories(userId, input)` | Calcula, versiona y persiste una estimación |
| `getSpecialistsPage(userId)` | Construye ambos directorios, elecciones y perfil propio |
| `registerSpecialist(userId, input)` | Crea perfil, roles y referencias de archivos privados |
| `requestSpecialist(userId, profileId, role)` | Reserva el único cupo abierto de la rama |
| `actOnSpecialistRequest(userId, requestId, action)` | Acepta, rechaza, cancela o cierra según el actor |
| `getMyWork(userId)` | Separa solicitantes y asesorados por rol activo |
| `getMySpecialistRoles(userId)` | Genera condicionalmente la navegación Mi trabajo |
| `getSpecialistMedia(userId, mediaId)` | Autoriza y recupera foto o certificado referenciado |

`PublicUser` excluye por diseño `identities` y `credentialHash`. Los métodos que reciben `userId` solo se invocan con el valor resuelto por Astro Sessions.

### Infraestructura

Implementa los contratos de la aplicación:

- almacén JSON del servidor;
- almacenamiento local privado de medios, reemplazable por object storage;
- repositorios sobre ese almacén;
- hash de contraseñas;
- integración con Astro Sessions para guardar únicamente el identificador interno del usuario;
- lectura y validación centralizada de entorno;
- verificadores futuros de Google Identity Services y Firebase Authentication;
- adaptadores futuros de Firestore u otra base de datos.

Un punto único de composición, por ejemplo `getApplication()`, selecciona adaptadores según el entorno y entrega casos de uso listos. Ninguna página debe construir manualmente estas dependencias.

### Presentación

Astro se ocupa de:

- traducir la URL y el método HTTP a un caso de uso;
- validar el formato superficial de formularios y JSON;
- resolver la sesión en middleware;
- renderizar vistas y componentes;
- aplicar mejora progresiva para las interacciones.

La presentación no contiene fórmulas, consultas al archivo ni reglas de pertenencia de datos.

## Organización recomendada

```text
src/
├── domain/
│   ├── users/
│   ├── routine/
│   ├── diet/
│   ├── calories/
│   └── shared/
├── application/
│   ├── facade.ts
│   ├── ports/
│   └── use-cases/
├── infrastructure/
│   ├── composition/
│   ├── config/
│   ├── identity/
│   ├── persistence/file/
│   ├── security/
│   └── system/
├── components/
├── layouts/
├── pages/
│   └── api/
├── styles/
├── app.d.ts
└── middleware.ts
```

La composición efectiva se expone mediante `getApplication()` en infraestructura. Es código exclusivo del servidor y no se importa desde scripts enviados al navegador.

## Flujo de una petición pública

```text
Navegador
   │ GET /
   ▼
Middleware ── intenta resolver cookie, sin exigir sesión
   │
   ▼
Página Astro ── recibe usuario opcional desde Astro.locals
   │
   ▼
HTML con navegación apropiada para invitado o usuario
```

No se necesita una consulta desde el navegador para decidir qué enlaces mostrar.

## Flujo de una página protegida

La política de acceso se evalúa antes de resolver el propietario:

```text
APP_ACCESS_MODE=authenticated → userId de Astro Sessions
APP_ACCESS_MODE=demo          → perfil persistente demo-user-v1, sin cookie
```

En modo demo las rutas y endpoints de autenticación redirigen a `/app`; los endpoints funcionales conservan el mismo contrato basado en `Astro.locals.user`.

```text
Navegador
   │ GET /app/rutina + cookie HttpOnly
   ▼
Middleware
   │ solicita userId a Astro Sessions
   │ comprueba que todavía exista en UserRepository
   ▼
Astro.locals.user
   │
   ├── sin usuario → destruye sesión inválida y redirige a /iniciar-sesion
   └── con usuario → renderizado SSR
```

La página nunca confía en un `userId` incluido en la URL o en el navegador.

## Flujo de una modificación

El alta de un ejercicio ilustra el patrón general:

1. El navegador envía los campos del ejercicio.
2. El endpoint obtiene `userId` de la sesión resuelta.
3. La capa de presentación valida tipos básicos.
4. `AddExercise` aplica límites e invariantes del dominio.
5. `RoutineRepository.add` persiste el ejercicio asociado al usuario de sesión.
6. El endpoint devuelve un DTO seguro o aplica Post/Redirect/Get.
7. La interfaz actualiza la vista sin almacenar una copia persistente en el navegador.

Eliminar un recurso requiere tanto `userId` como `resourceId` en el repositorio. Así, conocer el identificador de otro usuario no concede acceso.

## Renderizado e interactividad

Astro entrega el estado inicial desde el servidor. El JavaScript cliente se limita a comportamiento de interfaz:

- abrir y cerrar diálogos;
- navegación móvil;
- enviar formularios de manera progresiva;
- actualizar una sección con la respuesta del servidor.

No mantiene una segunda fuente de verdad. Tras una recarga, la vista se reconstruye desde la persistencia del servidor.

No es necesario incorporar React, Vue o Svelte para reproducir las interacciones actuales. Si más adelante se usa una isla de otro framework, esa isla continúa llamando a los mismos endpoints o acciones.

## Rutas

Las rutas canónicas recomendadas son:

```text
Públicas:     / · /blog · /iniciar-sesion · /registro
Protegidas:  /app · /app/rutina · /app/dieta · /app/calculadora
             /app/especialistas · /app/mi-trabajo
Servidor:    POST /api/auth/register · /api/auth/login · /api/auth/logout
             POST /api/routine/add · /api/routine/delete
             POST /api/diet/save · /api/calories/calculate
             POST /api/specialists/profile/create
             POST /api/specialists/request/create · /request/action
             GET  /api/specialists/media/:mediaId
```

Los nombres exactos de los endpoints forman parte de presentación, no de los contratos del dominio. Cambiar un endpoint no debe obligar a cambiar un caso de uso.

## Manejo de errores

Los errores se separan por nivel:

- Dominio: valor no permitido o invariante incumplida.
- Aplicación: email duplicado, credencial inválida, sesión ausente o recurso no encontrado.
- Infraestructura: archivo inaccesible, documento corrupto o proveedor externo no disponible.
- Presentación: petición mal formada o método no permitido.

Los casos de uso deben devolver errores con códigos estables. Los endpoints los convierten en estados HTTP y mensajes en español, sin exponer rutas, hashes, tokens ni detalles de proveedor.

## Configuración y composición

La lectura de `import.meta.env` se centraliza. La configuración validada es un objeto inmutable que se inyecta a infraestructura. Esto evita que cada módulo interprete variables de forma distinta.

La composición selecciona:

- adaptador de persistencia;
- verificador de identidad indicado por `AUTH_PROVIDER`;
- repositorios;
- servicio de contraseña;
- casos de uso.

La creación, regeneración y destrucción de sesión se realiza en el borde HTTP mediante Astro Sessions. Los casos de uso devuelven el usuario autenticado y reciben `userId` desde el contexto seguro; no importan APIs de Astro.

La versión inicial compone únicamente autenticación por contraseña. Los contratos de Google y Firebase documentan la extensión futura; elegir uno de esos valores sin su adaptador instalado produce un error explícito de arranque.

Los contratos se mantienen asíncronos aunque el archivo local pueda leerse de forma síncrona. Firestore y otros servicios remotos podrán implementarlos sin alterar llamadas.

## Pruebas recomendadas

### Unitarias

- Fórmula calórica y redondeo.
- Catálogo de planes de dieta.
- Validación de ejercicios.
- Normalización de email.
- Expiración de sesiones.

### Casos de uso

Se ejecutan con repositorios falsos en memoria:

- registro duplicado;
- credenciales inválidas;
- acceso sin sesión;
- separación de datos entre usuarios;
- alta y eliminación de ejercicio;
- reemplazo de dieta;
- registro de cálculos.

### Contrato de repositorios

La misma batería debe ejecutarse contra el adaptador de archivo y cualquier adaptador futuro. Esto es lo que hace verificable la sustitución por Firestore.

### Integración y extremo a extremo

- La sesión sobrevive una nueva petición.
- Los datos sobreviven el reinicio del servidor.
- Una sesión expirada deja de autorizar.
- Una persona no puede eliminar recursos ajenos.
- Las páginas privadas redirigen antes de renderizar contenido.

## Documentar el código

Cada símbolo exportado de dominio, aplicación e infraestructura debe indicar responsabilidad, parámetros, resultado, errores y efectos. Los comentarios se escriben para explicar decisiones como la separación entre identidad y usuario, la regeneración de sesión o una normalización; no para traducir cada instrucción a prosa.

Las decisiones que afectan a varias capas se registran como ADR en `docs/decisions/`.
