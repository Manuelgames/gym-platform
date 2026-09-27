# Modelo de dominio

## Objetivo

El modelo representa los conceptos propios de Roman Colosseum sin depender del archivo JSON actual, Astro Sessions ni un futuro esquema de Firestore. La persistencia puede organizar documentos de otra forma, pero debe respetar estos campos e invariantes.

## Mapa del dominio

```text
User
 ├── 1..n UserIdentity
 ├── 0..n RoutineExercise
 ├── 0..1 DietPlan vigente
 └── 0..10 CalorieCalculation
```

`User` es la identidad interna estable. `UserIdentity` indica cómo se autentica. Los datos de progreso siempre pertenecen al `id` interno, nunca al email, al índice de un arreglo o al subject del proveedor.

Astro Sessions no forma parte de este modelo persistente: conserva únicamente el `userId` necesario para construir el contexto autenticado de una petición.

## Identificadores y fechas

Cada entidad usa un identificador opaco generado en servidor, preferentemente UUID. Los identificadores no contienen email ni datos personales.

Las fechas de auditoría se serializan como ISO 8601 UTC, por ejemplo `2026-08-05T18:30:00.000Z`. `birthDate` es una fecha civil `AAAA-MM-DD`; no se interpreta como un instante para evitar cambios por zona horaria.

## User

Representa el perfil persistente de la aplicación.

```ts
interface User {
  id: string;
  name: string;
  email: string;
  birthDate: string;
  sex: 'mujer' | 'hombre' | 'prefiero no decirlo';
  profilePhoto: StoredMediaReference | null;
  identities: UserIdentity[];
  createdAt: string;
  updatedAt: string;
}
```

| Campo | Regla |
| --- | --- |
| `id` | Único, opaco e inmutable |
| `name` | Espacios normalizados; entre 2 y 80 caracteres |
| `email` | `trim().toLowerCase()`, formato válido y único |
| `birthDate` | Fecha real `AAAA-MM-DD`, no futura |
| `sex` | Uno de los tres valores admitidos por el perfil |
| `profilePhoto` | Referencia opcional a una imagen privada servida únicamente a cuentas autenticadas |
| `identities` | Al menos una forma de autenticación válida |
| `createdAt` / `updatedAt` | Instantes asignados por el servidor |

El campo `sex` representa la selección de perfil actual. No selecciona automáticamente la ecuación calórica; la calculadora solicita por separado `male` o `female` porque esas son las dos constantes publicadas de Mifflin-St Jeor.

La normalización de email no aplica reglas particulares de Gmail u otros proveedores. El email puede cambiar; `user.id` permanece estable.

## UserIdentity

```ts
type IdentityProvider = 'password' | 'google' | 'firebase';

interface UserIdentity {
  provider: IdentityProvider;
  subject: string;
  credentialHash?: string;
  createdAt: string;
}
```

`subject` es el identificador estable dentro de cada proveedor:

- Para `password`, es el email canónico.
- Para Google, será el claim `sub` de un token verificado.
- Para Firebase, será el UID de un token verificado.

`credentialHash` solo existe con `provider=password` y contiene un hash `scrypt` autocontenido con sus parámetros y sal. Nunca contiene la contraseña original. Las identidades Google y Firebase no almacenan ID tokens, access tokens ni refresh tokens.

La combinación `(provider, subject)` debe ser única de forma lógica. Vincular una identidad externa requiere una política explícita; no se vincula silenciosamente por coincidencia de email.

## Contexto de sesión

La sesión HTTP es administrada por Astro y contiene exclusivamente:

```ts
interface SessionData {
  userId: string;
}
```

En registro e inicio correctos el endpoint regenera la sesión antes de guardar `userId`, lo que evita reutilizar un identificador de sesión anterior. En logout se destruye. Si middleware encuentra un `userId` cuyo usuario ya no existe, destruye esa sesión inválida.

La duración se deriva de `SESSION_TTL_SECONDS`. La forma interna de la cookie o del almacén de sesión pertenece a la configuración de Astro, no al dominio.

## RoutineExercise

```ts
interface RoutineExercise {
  id: string;
  userId: string;
  day: WeekDay;
  muscle: MuscleGroup;
  name: string;
  sets: number;
  reps: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
```

Los días usan claves estables sin acentos:

```ts
type WeekDay =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';
```

La presentación muestra `Miércoles` y `Sábado` con la ortografía correspondiente.

Grupos musculares permitidos:

```ts
type MuscleGroup =
  | 'Pecho'
  | 'Espalda'
  | 'Piernas'
  | 'Hombros'
  | 'Brazos'
  | 'Core'
  | 'Cardio'
  | 'Acondicionamiento';
```

Invariantes:

- `id` y `userId` obligatorios.
- `name`: 1–80 caracteres después de normalizar espacios.
- `sets`: entero entre 1 y 30.
- `reps`: 1–20 caracteres; admite expresiones como `8–12`.
- `notes`: máximo 240 caracteres.
- `day` y `muscle`: pertenecen a sus catálogos cerrados.

El orden actual es el de inserción dentro de cada día. Si en el futuro se permite reordenar manualmente, se añadirá un campo explícito y una migración de esquema.

Los documentos semanales enriquecidos (`RoutinePlan`) distinguen la prescripción de cada ejercicio:

```ts
type RoutinePrescription =
  | { prescriptionType: 'repetitions'; sets: number; reps: string; durationMinutes: null }
  | { prescriptionType: 'duration'; sets: null; reps: ''; durationMinutes: number };
```

`Cardio` y `Acondicionamiento` siempre usan `duration`; la suma de sus minutos dentro de un día no puede superar la duración configurada para la sesión.

## RoutineByDay

La vista semanal usa una proyección que siempre contiene los siete días:

```ts
type RoutineByDay = Record<WeekDay, RoutineExercise[]>;
```

Los días sin ejercicios contienen un arreglo vacío. Esta proyección se deriva de la lista plana persistida y no es una segunda fuente de verdad.

## DietPlan

```ts
interface DietPlan {
  id: string;
  userId: string;
  goal: 'ganar' | 'mantener' | 'perder';
  preference: 'general' | 'vegetariana' | 'rapida';
  meals: 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
}
```

El plan representa una guía general, no una prescripción médica. Las sugerencias se generan de forma determinista con el catálogo de la aplicación:

- el objetivo determina título y orientación;
- la preferencia selecciona una lista de plantillas;
- `meals` toma las primeras 3, 4 o 5 sugerencias.

Guardar solamente las selecciones evita duplicar texto estático en cada usuario. Si el catálogo cambia de forma que deba reproducir planes históricos, se añadirá una versión de reglas mediante una migración explícita.

Cada usuario mantiene un plan vigente. Guardar uno nuevo reemplaza el anterior y conserva la fecha original cuando la operación implementada sea una actualización.

## DietGuide

Es un resultado derivado para presentación:

```ts
interface DietGuide {
  title: string;
  objectiveGuidance: string;
  meals: Array<{
    name: string;
    description: string;
  }>;
}
```

No se persiste. Puede reconstruirse a partir de `DietPlan`.

## CalorieCalculation

```ts
interface CalorieCalculation {
  id: string;
  userId: string;
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  activityFactor: 1.2 | 1.375 | 1.55 | 1.725 | 1.9;
  bmr: number;
  maintenanceCalories: number;
  formulaVersion: 'mifflin-st-jeor-v1';
  createdAt: string;
}
```

Invariantes:

| Entrada | Límite |
| --- | --- |
| `age` | Entero de 14 a 100 |
| `sex` | `male` o `female` para esta fórmula |
| `weightKg` | 30–300 |
| `heightCm` | 120–230 |
| `activityFactor` | Uno de los cinco factores permitidos |

Factores:

| Nivel | Factor |
| --- | ---: |
| Sedentario | 1.2 |
| Ligero | 1.375 |
| Moderado | 1.55 |
| Alto | 1.725 |
| Muy alto | 1.9 |

Fórmula para `male`:

```text
BMR = 10 × pesoKg + 6.25 × alturaCm − 5 × edad + 5
```

Fórmula para `female`:

```text
BMR = 10 × pesoKg + 6.25 × alturaCm − 5 × edad − 161
```

`maintenanceCalories` es BMR por el factor de actividad. Ambos resultados se redondean. `formulaVersion` permite explicar el algoritmo utilizado.

La política actual conserva como máximo diez cálculos por usuario para mantener paridad con la aplicación anterior. Al insertar uno nuevo se eliminan los más antiguos que excedan ese límite. Si el producto necesita historial completo, esta política debe cambiarse de manera explícita.

## Resumen del panel

El panel deriva un DTO, sin persistir otra copia:

```ts
interface DashboardView {
  user: PublicUser;
  exerciseCount: number;
  hasDiet: boolean;
  calorieCalculationCount: number;
}
```

Los recuentos siempre se calculan dentro del alcance del usuario autenticado.

## Especialistas

Un usuario tiene como máximo un `SpecialistProfile`. El identificador del perfil es opaco y estable; los roles no se codifican dentro del ID porque pueden cambiar de estado:

```ts
interface SpecialistProfile {
  id: string;
  userId: string;
  presentation: string;
  experience: string;
  photo: SpecialistMediaReference;
  certificates: SpecialistMediaReference[];
  roles: Array<{
    role: 'trainer' | 'nutritionist';
    status: 'active' | 'inactive';
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

El alta actual exige presentación, experiencia, fotografía válida y uno o ambos roles. Admite hasta tres PDF opcionales. La fotografía tiene un máximo de 4 MB y cada certificado otro máximo de 4 MB.

`StoredMediaReference` contiene ID, clave de almacenamiento, nombre original validado, MIME, tamaño y fecha. `SpecialistMediaReference` es un alias especializado. Los bytes no forman parte del dominio ni del JSON; `MediaStorage` los administra de forma privada.

## Solicitud de orientación

```ts
interface SpecialistServiceRequest {
  id: string;
  clientUserId: string;
  specialistUserId: string;
  specialistProfileId: string;
  role: 'trainer' | 'nutritionist';
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'closed';
  createdAt: string;
  updatedAt: string;
}
```

`pending` y `accepted` ocupan el cupo. La unicidad de `(clientUserId, role)` para esos estados permite simultáneamente un entrenador y un nutricionista, pero nunca dos de la misma rama.

Transiciones:

```text
pending  --especialista/accept--> accepted
pending  --especialista/reject--> rejected
pending  --solicitante/cancel---> cancelled
accepted --solicitante/cancel---> cancelled
accepted --especialista/close---> closed
```

El solicitante nunca envía un `clientUserId` confiable desde el formulario; aplicación usa el propietario resuelto por middleware. Tampoco puede solicitar su propio perfil ni un rol inactivo.

## Errores

La validación pura produce un error de dominio con campo lógico y mensaje comprensible. La capa HTTP decide el estado y formato de respuesta.

Errores de aplicación relevantes:

- conflicto de email;
- credenciales inválidas;
- usuario inexistente;
- acceso sin sesión;
- recurso inexistente o no perteneciente al usuario;
- documento de persistencia inválido.

La respuesta de login no diferencia públicamente entre email inexistente y contraseña incorrecta.

## Concurrencia y límites de agregado

Rutinas, dietas y cálculos se guardan como colecciones planas separadas de `users`. Cambiar un ejercicio no reescribe conceptualmente todo el agregado de usuario.

La creación del usuario incluye su identidad `password` en la misma operación, por lo que el adaptador debe escribir ambas partes de forma atómica. Una migración futura a SQL usaría una transacción; Firestore puede usar una transacción o un lote según el modelo elegido.
