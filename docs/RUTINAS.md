# Rutinas semanales

## Modalidades

`/app/rutina` mantiene tres documentos independientes por usuario:

- `ai`: generación automática a partir de objetivo, nivel, lugar, duración, descansos, equipo y consideraciones.
- `manual`: documento creado y editado por el propio usuario.
- `specialist`: documento asignado por un entrenador mediante una solicitud `trainer` aceptada.

Las tres modalidades usan `RoutinePlan`, por lo que la pantalla, el editor profesional y el PDF comparten los mismos campos.

## Semana canónica

Cada documento contiene exactamente lunes, martes, miércoles, jueves, viernes, sábado y domingo. Un día se marca como entrenamiento o descanso:

- un descanso debe tener cero ejercicios;
- un entrenamiento debe tener al menos un ejercicio;
- cada ejercicio conserva nombre, grupo muscular, series, repeticiones, descanso en segundos, tempo y notas;
- la semana necesita al menos un día activo.

El domingo puede configurarse como entrenamiento o descanso igual que cualquier otro día.

## Generación automática

El proveedor OpenAI usa Responses API, `store: false`, `safety_identifier` seudónimo y una salida JSON Schema estricta. La respuesta vuelve a validarse con `createRoutinePlan`. Además, cada grupo muscular anunciado debe aparecer en al menos un ejercicio y ningún ejercicio puede pertenecer a un grupo omitido en el enfoque declarado. Si la respuesta incumple esas reglas, falta la credencial o hay un error externo, se utiliza un generador local determinista que reparte los ejercicios entre todos los grupos de la sesión.

## Autorización profesional

El entrenador abre al asesorado únicamente desde `/app/mi-trabajo`. Tanto la lectura como la escritura exigen que la solicitud:

- pertenezca al entrenador autenticado;
- tenga rol `trainer`;
- esté en estado `accepted`.

El formulario nunca recibe desde el navegador el propietario ni el autor del documento.

## Persistencia y migración

El esquema v6 amplía `routinePlans` hasta el domingo. Al leer v5, agrega domingo como descanso sin modificar las sesiones existentes; al leer v4, los ejercicios históricos se convierten en una rutina manual de siete días sin borrar `routineExercises`. La migración ocurre en memoria y solo se persiste dentro de una escritura atómica posterior.

Cada usuario puede conservar como máximo un plan vigente por modalidad. Una actualización mantiene el identificador y `createdAt`, salvo que cambie la relación profesional asociada.
