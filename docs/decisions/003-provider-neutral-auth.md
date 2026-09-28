# ADR 003: autenticación neutral al proveedor

- Estado: aceptada
- Fecha: 2026-08-05

## Contexto

La aplicación puede utilizar en el futuro Google Identity Services o Firebase Authentication, pero la decisión no es definitiva. El modelo original mezclaba usuario, contraseña, sesión y datos funcionales en un mismo objeto de `localStorage`.

Google Identity Services y Firebase Authentication emiten identidades con SDK y tokens distintos. Además, GIS no almacena datos funcionales y Firebase Authentication no implica necesariamente que se use Firestore.

## Decisión

Separar:

- `User`, identidad interna de la aplicación;
- `UserIdentity`, vínculo discriminado para `password`, `google` o `firebase`;
- `ExternalIdentityVerifier`, puerto para verificar credenciales externas;
- Astro Sessions, que conserva `userId` y `sessionVersion` después de autenticar;
- repositorios funcionales, independientes de autenticación.

Los verificadores de Google y Firebase producen un resultado común con proveedor, subject, email, estado de verificación y perfil opcional.

`AUTH_PROVIDER` seleccionará el adaptador activo sin introducir condicionales de proveedor en los casos de uso. La primera versión implementa solo `password`; `google` y `firebase` son contratos de evolución y provocan un error claro mientras no exista su adaptador.

## Consecuencias positivas

- El dominio no importa SDK de Google o Firebase.
- Se puede probar el inicio federado con un verificador falso.
- Cambiar autenticación no mueve rutinas ni dietas.
- Cambiar persistencia no obliga a cambiar login.
- Es posible vincular más de una identidad a un usuario en una evolución futura.
- Los tokens externos no se almacenan como datos de aplicación.

## Costes y decisiones pendientes

- Se necesita garantizar unicidad lógica de `(provider, subject)` aunque el adaptador actual guarde las identidades dentro de `User`.
- Debe definirse una política explícita de creación y vinculación.
- La configuración actual selecciona un único proveedor; habilitar varios simultáneamente requerirá evolucionarla.
- Cada adaptador debe validar issuer, audience, firma y expiración correctamente.
- La recuperación de cuenta depende del proveedor; para `password` se implementó mediante enlaces de un solo uso y un adaptador de correo sustituible.

## Política de seguridad

- Usar `subject`, no email, como identificador externo estable.
- No confiar en claims sin verificar la firma.
- No guardar ID tokens ni access tokens salvo una necesidad futura justificada y protegida.
- No vincular cuentas automáticamente solo por email.
- Derivar el usuario de la sesión en todas las operaciones.
- Regenerar Astro Session después de verificar identidad, guardar `userId` y `sessionVersion`, y emitir una cookie `HttpOnly`.

## Alternativas consideradas

### Importar directamente el SDK de proveedor en páginas y dominio

Descartado porque propaga tipos, errores y ciclo de vida del proveedor por toda la aplicación.

### Usar email como ID de usuario

Descartado porque el email puede cambiar, tiene información personal y no representa el subject estable del proveedor.

### Guardar el token de Google o Firebase en localStorage

Descartado por exposición a JavaScript y porque vuelve a convertir el navegador en almacén de credenciales.

### Hacer que Firebase Authentication determine la persistencia

Descartado como acoplamiento innecesario. Firebase Auth puede convivir con archivo, SQL o Firestore; GIS también puede convivir con cualquiera de ellos.

## Condiciones de revisión

Registrar un nuevo ADR si:

- se habilitan varios proveedores al mismo tiempo;
- se adoptan cookies de sesión de Firebase en lugar de Astro Sessions;
- se añaden refresh tokens o acceso a APIs de Google;
- se introduce recuperación de cuenta o vinculación automática;
- una aplicación móvil consume el mismo backend.
