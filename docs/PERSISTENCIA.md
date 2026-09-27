# Persistencia

## Principio principal

Los datos funcionales de Roman Colosseum pertenecen al servidor. El navegador no usa `localStorage` ni `sessionStorage` como base de datos o caché duradera.

Los casos de uso conocen interfaces de repositorio. El archivo JSON actual y un futuro Firestore son adaptadores sustituibles. Astro Sessions administra por separado el contexto de sesión y conserva únicamente `userId`.

## Estrategia actual: archivo JSON

Mientras no se elija una base de datos definitiva, el adaptador inicial guarda un documento JSON versionado en `DATA_FILE_PATH`.

Esquema raíz v7:

```ts
interface DatabaseDocumentV7 {
  schemaVersion: 7;
  users: User[];
  routineExercises: RoutineExercise[];
  routinePlans: RoutinePlan[];
  dietPlans: DietPlan[];
  calorieCalculations: CalorieCalculation[];
  specialistProfiles: SpecialistProfile[];
  specialistRequests: SpecialistServiceRequest[];
}
```

Ejemplo vacío:

```json
{
  "schemaVersion": 7,
  "users": [],
  "routineExercises": [],
  "routinePlans": [],
  "dietPlans": [],
  "calorieCalculations": [],
  "specialistProfiles": [],
  "specialistRequests": []
}
```

Las identidades se almacenan dentro de cada `User.identities`. Una identidad `password` contiene `credentialHash`; Google y Firebase contienen únicamente provider, subject y fecha. El documento nunca contiene contraseñas originales ni tokens externos.

En `APP_ACCESS_MODE=demo`, el mismo esquema contiene un único usuario reservado con `id=demo-user-v1`. Rutina, dieta y cálculos se relacionan con ese ID como cualquier otro agregado. Su credencial se genera desde un secreto aleatorio descartado y nunca habilita login. El contenido demo es compartido por toda la instancia y no se migra automáticamente a cuentas reales.

Las sesiones no forman parte de este archivo. Su ciclo de vida pertenece a Astro Sessions y al driver de sesión configurado por Astro.

## Ubicación

Configuración local:

```dotenv
DATA_FILE_PATH=.data/roman-colosseum.json
UPLOADS_DIRECTORY=.data/uploads
```

Reglas:

- Nunca colocar el archivo en `public/`.
- Nunca versionarlo en Git.
- Dar lectura y escritura solo al usuario del proceso.
- Usar un volumen persistente si los datos deben sobrevivir reemplazos del servidor.
- No registrar contenido, hashes ni información personal en logs.
- Mantener `UPLOADS_DIRECTORY` fuera de `public/`; los medios se sirven mediante un endpoint autorizado.

Una ruta relativa se resuelve desde el directorio de trabajo del proceso. En producción es preferible una ruta persistente explícita administrada por la plataforma.

## Ciclo de escritura

Cada modificación se ejecuta como una unidad:

1. Adquirir el bloqueo interno del almacén.
2. Leer y validar la última versión.
3. Aplicar una mutación sobre una copia controlada.
4. Validar el resultado.
5. Serializar a un archivo temporal en el mismo volumen.
6. Reemplazar el documento principal.
7. Liberar el bloqueo incluso si ocurre un error.

No se escribe directamente sobre el documento principal porque una interrupción podría dejar JSON incompleto.

El bloqueo en memoria solo coordina peticiones dentro de **un proceso Node**. No coordina réplicas, contenedores ni procesos diferentes.

## Alcance y límites

El adaptador de archivo sirve para:

- desarrollo local;
- pruebas de integración;
- demostraciones;
- una instancia Node con disco persistente y concurrencia moderada.

No sirve como solución final para:

- varias instancias;
- serverless concurrente;
- volúmenes efímeros;
- alto ritmo de escrituras;
- grandes consultas o analítica;
- recuperación y respaldo con requisitos avanzados.

Dos instancias podrían sobrescribir cambios aunque ambas implementen un bloqueo propio. Plataformas como Vercel o Cloud Run pueden reemplazar el sistema de archivos local. Antes de desplegar en un entorno así debe utilizarse una base de datos compartida.

## Repositorios

Los contratos de aplicación son asíncronos desde el inicio:

- `UserRepository` resuelve, crea y actualiza usuarios mediante compare-and-set.
- `FitnessRepository` agrupa rutina, dieta, cálculos y resumen porque el almacén de archivo puede leerlos sobre una misma instantánea consistente.
- `SpecialistRepository` conserva perfiles, roles y solicitudes, incluida la reserva atómica de un cupo por usuario y rol.
- `MediaStorage` guarda fotos y documentos fuera del JSON y permite reemplazar disco por almacenamiento de objetos.

Un futuro adaptador puede implementar estas interfaces en una sola clase o repartir internamente su acceso sin cambiar `ApplicationFacade`.

Propiedades que todo adaptador debe respetar:

- Email normalizado y único.
- `(provider, subject)` único de forma lógica.
- Los resultados no exponen `credentialHash` a la presentación.
- Las operaciones de rutina reciben el `userId` derivado de sesión.
- Eliminar un ejercicio comprueba simultáneamente ID y propietario.
- Cada usuario tiene como máximo un plan vigente por origen: `ai`, `manual` y `specialist`.
- La dieta profesional referencia una solicitud nutricional aceptada o cerrada y conserva el especialista autor.
- La dieta automática puede referenciar únicamente un cálculo calórico perteneciente al mismo usuario.
- Los cálculos se ordenan por fecha descendente.
- La política vigente conserva como máximo diez cálculos por usuario.
- Cada usuario tiene como máximo un perfil profesional.
- Un perfil puede activar entrenamiento, nutrición o ambos con el mismo identificador.
- Cada solicitante tiene como máximo una solicitud pendiente o aceptada por rol.
- Aceptar/rechazar/cancelar/cerrar usa compare-and-set sobre el estado leído.
- Errores de conflicto y ausencia se traducen a errores estables de aplicación.

Aunque un repositorio de archivo pueda completar operaciones inmediatamente, sus métodos permanecen asíncronos para que un adaptador remoto no cambie los casos de uso.

## Sesiones Astro

El documento funcional no implementa un repositorio de sesiones. En registro e inicio de sesión el endpoint:

1. autentica mediante el caso de uso;
2. regenera la Astro Session;
3. guarda solamente `userId`;
4. permite que Astro emita la cookie configurada.

Logout llama a `destroy()`. Middleware también destruye una sesión cuyo `userId` ya no corresponde a un usuario.

La expiración procede de `SESSION_TTL_SECONDS`. La forma en que Astro almacena identificadores, cookies o estado interno depende del driver configurado y debe revisarse al cambiar de adaptador de despliegue.

La revocación individual o global de sesiones no está incluida en el documento funcional. Si se convierte en requisito, debe elegirse un driver que exponga esa capacidad o introducir un registro explícito mediante un ADR.

## Contraseñas e identidades

Para una identidad `password`, `credentialHash` es un valor `scrypt` con versión, parámetros, sal aleatoria y derivación. La comparación se realiza en servidor.

Nunca se persisten:

- contraseña original o confirmación;
- credenciales heredadas de `localStorage`;
- tokens de Google o Firebase;
- contenido completo de una Astro Session dentro del documento funcional.

## Versionado y migraciones

`schemaVersion` indica cómo interpretar el documento. Una migración segura:

1. Detecta la versión actual.
2. Rechaza versiones futuras desconocidas.
3. Valida el documento de origen.
4. Crea un respaldo.
5. Transforma en memoria.
6. Valida el resultado.
7. Escribe de forma atómica la versión nueva.

Un error no debe reemplazar silenciosamente los datos con un documento vacío.

Las migraciones implementadas son aditivas: v1 agrega las colecciones profesionales y v1/v2 agregan `profilePhoto: null` a cada usuario. La siguiente escritura atómica deja persistida la versión 3.

## Copias de seguridad

Cuando existan datos importantes:

- coordinar el respaldo con el almacén para obtener una vista consistente;
- copiar documento, versión y `UPLOADS_DIRECTORY` como una unidad coherente;
- cifrar el respaldo;
- limitar su acceso;
- definir retención y eliminación;
- probar una restauración periódicamente.

El respaldo contiene información personal y hashes de credenciales; requiere la misma protección que la fuente.

## Evolución a SQL

SQLite es una mejora natural para una sola instancia porque aporta transacciones, restricciones e índices. PostgreSQL permite varias instancias.

Índices mínimos:

- email normalizado único;
- `(provider, subject)` único;
- ejercicios por `(userId, day, createdAt)`;
- dieta por `userId`;
- cálculos por `(userId, createdAt)`.
- perfil profesional por `userId` único;
- solicitudes por `(clientUserId, role, status)` y `(specialistUserId, role, status)`;
- índice único parcial para `(clientUserId, role)` cuando el estado sea pendiente o aceptado.

El adaptador SQL implementa los mismos puertos. Las páginas y casos de uso no cambian.

## Evolución a Firestore

Google Identity Services no persiste datos. Usar GIS requiere conservar el adaptador JSON, elegir Firestore o elegir otra base.

Modelo propuesto:

```text
users/{userId}
users/{userId}/routineExercises/{exerciseId}
users/{userId}/dietPlans/{dietPlanId}
users/{userId}/calorieCalculations/{calculationId}
specialistProfiles/{profileId}
specialistRequests/{requestId}
identityIndex/{provider_subjectKey}
```

### `users/{userId}`

```json
{
  "name": "Nombre",
  "email": "persona@example.com",
  "birthDate": "2000-01-31",
  "sex": "prefiero no decirlo",
  "identities": [
    {
      "provider": "google",
      "subject": "subject-verificado",
      "createdAt": "Timestamp"
    }
  ],
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Una identidad con contraseña incluye `credentialHash`; una externa jamás incluye tokens. Si Firebase Authentication administra por completo cuentas locales, puede dejar de ser necesario guardar hashes en Firestore.

### `routineExercises/{exerciseId}`

```json
{
  "day": "lunes",
  "muscle": "Pecho",
  "name": "Press con barra",
  "sets": 4,
  "reps": "8-12",
  "notes": "",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

El `userId` se deduce del documento padre; si también se guarda como campo debe coincidir.

### `dietPlans/{dietPlanId}`

Contiene `goal`, `preference`, `meals`, `createdAt` y `updatedAt`. La aplicación actual tiene un plan vigente; se puede guardar con un ID estable `current` o mantener historial y una referencia explícita.

### `calorieCalculations/{calculationId}`

Contiene edad, selección de fórmula, peso, altura, actividad, BMR, mantenimiento, versión de fórmula y fecha. Una transacción elimina resultados más antiguos cuando se supera el límite de diez.

### `identityIndex/{provider_subjectKey}`

Permite resolver de manera única una identidad externa sin consultar todos los usuarios. La clave debe construirse sin exponer innecesariamente el subject en URLs o logs; una opción es un hash determinista de `provider + subject`. El documento referencia `userId`.

La creación o vinculación escribe usuario e índice en una transacción para impedir duplicados.

### `specialistProfiles/{profileId}`

Contiene `userId`, presentación, experiencia, referencias de foto/certificados y una lista de roles `{ role, status, updatedAt }`. Debe existir un índice o documento auxiliar único por `userId`. Los bytes viven en Cloud Storage u otro object storage privado, no en Firestore.

### `specialistRequests/{requestId}`

Contiene solicitante, especialista, perfil, rol, estado y fechas. Crear una solicitud requiere una transacción que compruebe el rol activo y el cupo libre del cliente. Una opción de Firestore es un documento de reserva estable `specialistSlots/{clientUserId_role}` creado junto con la solicitud; se elimina al rechazar, cancelar o cerrar.

## Firestore desde servidor

La opción recomendada usa Firebase Admin SDK en infraestructura:

- los componentes no importan Firestore;
- el navegador no recibe credenciales administrativas;
- los casos de uso conservan autorización y reglas;
- cada repositorio aplica el alcance de `userId`.

Si se adopta acceso directo desde cliente se necesitan reglas de seguridad y pruebas con Emulator Suite. Sería una nueva decisión arquitectónica, no una simple sustitución de archivo.

Las sesiones pueden continuar con Astro Sessions usando un driver compatible con la plataforma. Usar Firebase Authentication no obliga a guardar el estado funcional en Firestore, y usar Firestore no obliga a usar Firebase Authentication.

## Pruebas de contrato

Todos los adaptadores deben superar la misma batería:

- crear y encontrar usuario;
- rechazar email e identidad duplicados;
- no devolver hashes en DTO públicos;
- separar ejercicios entre usuarios;
- eliminar solo recursos propios;
- crear o reemplazar dieta vigente;
- conservar solo diez cálculos por usuario, ordenados;
- impedir un segundo perfil del mismo usuario;
- impedir dos solicitudes abiertas de la misma rama para un cliente;
- rechazar solicitudes al propio perfil o a un rol inactivo;
- aplicar transiciones de solicitud solo al actor autorizado;
- autorizar medios únicamente si siguen referenciados;
- mantener datos tras reiniciar el adaptador;
- completar cada mutación de manera atómica.
