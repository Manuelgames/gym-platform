# ADR 002: persistencia inicial en archivo JSON

- Estado: aceptada con alcance limitado
- Fecha: 2026-08-05

## Contexto

El proyecto debe abandonar `localStorage`, pero todavía no ha elegido una base de datos definitiva. Se desea una implementación comprensible que funcione localmente y permita evaluar la lógica sin crear de inmediato una cuenta de nube.

La futura elección de Firebase se mezcla a menudo con Google Identity Services, aunque GIS solo autentica y no persiste datos. La arquitectura necesita mantener ambas decisiones independientes.

## Decisión

Implementar inicialmente repositorios sobre un documento JSON versionado almacenado únicamente en el servidor. La ruta procede de `DATA_FILE_PATH`.

Las escrituras se serializan dentro del proceso y se publican mediante reemplazo atómico de un archivo temporal. Los casos de uso consumen interfaces asíncronas, no el archivo directamente.

La versión 1 contiene `users`, `routineExercises`, `dietPlans` y `calorieCalculations`. Las identidades forman parte de cada usuario. Las sesiones son responsabilidad de Astro Sessions y no se guardan en este documento.

La evolución v2 agrega `specialistProfiles` y `specialistRequests`. Fotografías y certificados se guardan en un directorio privado mediante otro puerto; el documento conserva únicamente referencias. La migración v1 → v2 es aditiva y ocurre al leer, validándose de nuevo antes de la siguiente escritura atómica.

## Alcance permitido

- desarrollo;
- pruebas de integración;
- demostraciones;
- despliegue Node de una sola instancia con volumen persistente.

## Alcance no permitido

- varias instancias o procesos escribiendo el mismo archivo;
- funciones serverless;
- disco efímero;
- alta concurrencia;
- presentación de la solución como base de datos de producción escalable.

Un bloqueo en memoria solo protege un proceso. No existe coordinación distribuida.

## Consecuencias positivas

- Cero dependencia de un proveedor de nube.
- Datos fuera del navegador y disponibles entre reinicios.
- Formato fácil de inspeccionar durante desarrollo.
- Permite construir y probar contratos de repositorio.
- La adopción futura de Firestore o SQL queda localizada en infraestructura y composición.

## Costes y riesgos

- Cada escritura puede serializar el documento completo.
- Las consultas son en memoria.
- La recuperación y el respaldo son responsabilidad del despliegue.
- Un volumen efímero pierde los datos.
- No se puede escalar horizontalmente de manera segura.
- El archivo contiene información personal y requiere permisos y respaldo adecuados.

## Medidas obligatorias

- `schemaVersion` explícita.
- Validación al leer y antes de escribir.
- Archivo temporal y reemplazo atómico.
- Exclusión mutua dentro del proceso.
- Contraseñas con hash y sal.
- Ninguna contraseña, token externo ni contenido de sesión en texto plano.
- Archivo fuera de `public/` y Git.
- Error claro ante datos corruptos; nunca reemplazarlos silenciosamente por un documento vacío.

## Alternativas consideradas

### SQLite

Ofrece transacciones, restricciones e índices con poca infraestructura. Es una buena siguiente opción para una sola instancia con datos más importantes. No se eligió inicialmente para mantener la transición neutral y reducir dependencias, pero usa los mismos puertos.

### Firestore

Es apropiado para despliegue gestionado y varias instancias. No se eligió aún porque el producto no ha decidido Firebase y requiere proyecto, credenciales, índices, costes y operación específicos.

### Continuar con localStorage

Descartado porque no ofrece aislamiento, seguridad, acceso entre dispositivos ni control del servidor.

### Memoria sin archivo

Descartado porque perdería todos los datos al reiniciar.

## Ruta de salida

La sustitución requiere:

1. Implementar repositorios nuevos con los mismos contratos.
2. Ejecutar pruebas de contrato.
3. Crear una migración desde el documento versionado.
4. Cambiar la composición.
5. Verificar recuentos e integridad.
6. Conservar respaldo y plan de reversión durante la transición.

## Condiciones de revisión

La decisión debe revisarse antes de:

- publicar para usuarios reales;
- desplegar más de una réplica;
- usar una plataforma sin volumen persistente;
- necesitar respaldos y recuperación formal;
- superar un volumen de datos o escritura que vuelva costosa la serialización completa.
