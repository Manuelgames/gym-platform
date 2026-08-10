# Módulo de dietas

## Modalidades

`/app/dieta` presenta tres paneles independientes que comparten el mismo documento de dominio:

1. `ai`: plan automático a partir del último cálculo energético del usuario.
2. `manual`: documento creado y editado por su propietario.
3. `specialist`: documento creado por el nutricionista de una asesoría aceptada.

Cada plan contiene comidas ordenadas. Una comida declara tipo libre, título, hora opcional, preparación, notas, calorías aproximadas e ingredientes. Cada ingrediente separa `amount` y `unit`; las unidades admitidas incluyen gramos, mililitros, piezas, rebanadas, tazas, cucharadas, cucharaditas y porciones.

La interfaz manual no impone el límite anterior de cinco comidas. El dominio conserva un máximo técnico de 24 comidas y 40 ingredientes por comida para limitar formularios abusivos; estos valores permiten representar horarios reales con múltiples colaciones.

## Requisito de la calculadora

La API de generación automática solo recibe `goal`, `preference` y `meals`. El caso de uso recupera peso, altura, edad, sexo de fórmula, actividad y mantenimiento desde el último `CalorieCalculation` persistido.

Si no existe ese cálculo, responde con `CALORIE_PROFILE_REQUIRED`. El formulario de Dieta no puede inyectar ni sustituir las medidas corporales.

## Generación automática

Con `OPENAI_API_KEY`, el adaptador usa Responses API y exige un JSON Schema estricto para título, resumen, objetivos, comidas, ingredientes, cantidades y unidades. La petición usa `store=false` y un identificador de seguridad derivado mediante SHA-256; no envía nombre ni correo.

Sin credencial o ante un fallo externo, `buildLocalAutomaticDiet` produce un documento válido con las mismas estructuras. `generationEngine` distingue `openai` de `local` para que la aplicación nunca atribuya falsamente el origen del contenido.

## Autoría profesional

El botón de nutrición en `/app/mi-trabajo` abre `/app/mi-trabajo/nutricion/[requestId]`. Antes de leer o escribir, el caso de uso exige simultáneamente:

- rol `nutritionist`;
- estado `accepted`;
- especialista autenticado igual a `specialistUserId`;
- cliente obtenido desde la solicitud, nunca desde el formulario.

Un nuevo nutricionista no recibe el documento creado durante una relación anterior. Al guardar, el cliente lo ve en Dieta de especialista.

## PDF

`GET /api/diet/pdf/[source]` recupera exclusivamente el plan del usuario autenticado y genera un PDF A4. El archivo incluye resumen, objetivos aproximados, comidas, ingredientes, porciones, preparación, notas y aviso educativo. Se sirve como descarga privada con `Cache-Control: private, no-store`.

## Migración

El esquema v4 migra cada plan v3 a `source=ai`, `generationEngine=local` y convierte sus sugerencias anteriores en entradas con una porción explícita. Conserva `id`, propietario, objetivo, preferencia, `createdAt` y `updatedAt`. La migración se valida antes de permitir cualquier escritura.
