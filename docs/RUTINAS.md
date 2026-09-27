# Rutinas semanales

## Modalidades

`/app/rutina` mantiene tres documentos independientes por usuario:

- `ai`: generación automática a partir de objetivo, nivel, lugar, duración, descansos y consideraciones.
- `manual`: documento creado y editado por el propio usuario.
- `specialist`: documento asignado por un entrenador mediante una solicitud `trainer` aceptada.

Las tres modalidades usan `RoutinePlan`, por lo que la pantalla, el editor profesional y el PDF comparten los mismos campos.

## Semana canónica

Cada documento contiene exactamente lunes, martes, miércoles, jueves, viernes, sábado y domingo. Un día se marca como entrenamiento o descanso:

- un descanso debe tener cero ejercicios;
- un entrenamiento debe tener al menos un ejercicio;
- cada ejercicio conserva nombre, grupo muscular, tipo de prescripción, pausa, tempo/ritmo y notas;
- fuerza y movimientos convencionales usan series y repeticiones;
- cardio y acondicionamiento usan una duración explícita en minutos;
- la semana necesita al menos un día activo.

El domingo puede configurarse como entrenamiento o descanso igual que cualquier otro día.

## Generación automática

El proveedor OpenAI usa Responses API, `store: false`, `safety_identifier` seudónimo y una salida JSON Schema estricta. La respuesta vuelve a validarse con `createRoutinePlan`. Cada grupo muscular anunciado debe aparecer en al menos un ejercicio; cardio y acondicionamiento deben indicar minutos y nunca se aceptan como series/repeticiones. La suma del trabajo cronometrado tampoco puede superar la duración seleccionada para la sesión. Si la respuesta incumple estas reglas, falta la credencial o hay un error externo, se utiliza un generador local determinista con las mismas restricciones.

## Autorización profesional

El entrenador abre al asesorado únicamente desde `/app/mi-trabajo`. Tanto la lectura como la escritura exigen que la solicitud:

- pertenezca al entrenador autenticado;
- tenga rol `trainer`;
- esté en estado `accepted`.

El formulario nunca recibe desde el navegador el propietario ni el autor del documento.

## Persistencia y migración

El esquema v7 agrega prescripciones por repeticiones o duración. Al leer v6, cardio se convierte en trabajo cronometrado y se elimina el texto histórico de equipo; v5 además recibe domingo como descanso. Los ejercicios de v4 se convierten en una rutina manual de siete días sin borrar `routineExercises`. La migración ocurre en memoria y solo se persiste dentro de una escritura atómica posterior.

Cada usuario puede conservar como máximo un plan vigente por modalidad. Una actualización mantiene el identificador y `createdAt`, salvo que cambie la relación profesional asociada.
