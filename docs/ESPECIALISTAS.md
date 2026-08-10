# Módulo de especialistas

## Objetivo

El módulo reúne en una misma pantalla tres necesidades:

1. Elegir un entrenador personal.
2. Elegir un nutricionista.
3. Registrar al usuario actual como especialista en uno o ambos roles.

Después del registro profesional aparece `Mi trabajo`, con un tablero independiente por rol activo. Cada tablero separa solicitudes pendientes y relaciones aceptadas.

## Decisiones de producto aplicadas

- Un usuario puede tener simultáneamente **un entrenador** y **un nutricionista**.
- No puede mantener dos solicitudes pendientes/aceptadas de la misma rama.
- Una solicitud pendiente ya ocupa el cupo para evitar enviar solicitudes paralelas.
- El especialista puede aceptar o rechazar una solicitud pendiente.
- Aceptar la mueve de `Solicitantes` a `Asesorados`.
- El solicitante puede cancelar una solicitud o terminar una orientación aceptada.
- El especialista puede cerrar una asesoría aceptada.
- Rechazar, cancelar o cerrar libera el cupo de esa rama.
- Un usuario no puede solicitar orientación a su propio perfil.
- El alta profesional activa inmediatamente los roles elegidos; no existe todavía revisión administrativa.

Si posteriormente se requiere aprobación, se añadirá un estado del perfil como `draft | pendingReview | approved | rejected | suspended`. No debe reutilizarse el estado de cada rol para representar la revisión del perfil completo.

## Pantalla Especialistas

Ruta: `/app/especialistas`.

Orden de contenido:

1. Resumen de las dos elecciones actuales.
2. Buscador por identificador único.
3. División de entrenadores personales.
4. División de nutricionistas.
5. Formulario para formar parte del directorio.

El buscador realiza una coincidencia exacta del identificador, ignorando espacios exteriores y diferencias entre mayúsculas y minúsculas. Si el perfil tiene ambos roles activos, aparece como resultado tanto en entrenamiento como en nutrición.

Cada tarjeta muestra identificador, fotografía, presentación, experiencia, certificados y estado de selección. Si el cupo de la rama está ocupado, las demás tarjetas no permiten otra solicitud.

El perfil del propio usuario puede aparecer en el directorio para comprobar cómo se presenta, pero su botón de solicitud queda bloqueado.

## Registro profesional

Campos:

| Campo | Regla |
| --- | --- |
| Presentación | Obligatoria, 40–800 caracteres |
| Experiencia | Obligatoria, 20–2000 caracteres |
| Roles | Entrenador, nutricionista o ambos |
| Fotografía | Obligatoria; JPEG, PNG o WebP; máximo 4 MB |
| Certificados | Opcionales; hasta tres PDF; máximo 4 MB cada uno |

La aplicación comprueba tanto MIME como firma inicial del archivo. Cambiar la extensión de otro archivo a `.pdf` o `.png` no supera la validación.

El alta crea un identificador opaco como `SpecialistProfile.id`. Los roles se almacenan por separado:

```ts
roles: [
  { role: 'trainer', status: 'active', updatedAt: '...' },
  { role: 'nutritionist', status: 'active', updatedAt: '...' },
]
```

Por eso el mismo ID continúa siendo válido si más adelante un rol cambia a `inactive` o vuelve a `active`.

## Mi trabajo

Ruta: `/app/mi-trabajo`.

La navegación genera este enlace únicamente si el usuario posee al menos un rol activo. Entrar directamente sin perfil redirige a Especialistas.

Por cada rol activo se muestran:

- `Solicitantes`: solicitudes con estado `pending`.
- `Asesorados`: solicitudes con estado `accepted`.

Un perfil con ambos roles obtiene dos tableros. Las solicitudes nunca se mezclan entre entrenamiento y nutrición.

## Estados y autorización

```text
pending  --accept, especialista--> accepted
pending  --reject, especialista--> rejected
pending  --cancel, solicitante---> cancelled
accepted --cancel, solicitante---> cancelled
accepted --close, especialista---> closed
```

La identidad del actor procede de `Astro.locals.user`. Los endpoints solo reciben `requestId` y acción; nunca aceptan como confiables `clientUserId` ni `specialistUserId` enviados por el navegador.

La escritura usa compare-and-set: si dos peticiones intentan responder la misma solicitud, solo la que conserva el estado esperado puede completarse.

## Persistencia de medios

`UPLOADS_DIRECTORY` se encuentra fuera de `public/`. El navegador no recibe rutas del sistema de archivos.

Flujo:

```text
Formulario multipart
  → límite total de petición
  → validación de nombre, tamaño, MIME y firma
  → LocalMediaStore.save
  → referencia opaca en SpecialistProfile
  → GET autorizado /api/specialists/media/:mediaId
```

Si falla el alta del perfil, aplicación intenta eliminar los archivos que ya había guardado. Las imágenes se muestran inline; los PDF fuerzan descarga y usan `nosniff`. Únicamente usuarios resueltos por middleware pueden consultarlos.

En un despliegue distribuido se sustituye `LocalMediaStore` por Cloud Storage, S3 o equivalente. El caso de uso y las páginas no cambian.

## Modo demo

En `APP_ACCESS_MODE=demo` todos los visitantes comparten `demo-user-v1`. Por tanto también comparten su perfil profesional, solicitudes y trabajo. Además, un único perfil demo no puede solicitarse orientación a sí mismo.

Para probar relaciones entre personas se debe usar `APP_ACCESS_MODE=authenticated` y crear al menos dos cuentas, o preparar datos controlados de prueba. El smoke test automatizado usa dos cuentas y valida el flujo completo.

## Evolución de roles

El modelo ya admite `active | inactive`, aunque la primera interfaz no incluye edición. Al habilitarla deberán definirse estas políticas antes de implementar:

- si se permite desactivar un rol con solicitudes pendientes;
- qué sucede con asesorías aceptadas;
- quién puede cambiar el estado: propietario, administrador o ambos;
- si se conserva visible el historial de un rol inactivo;
- si una reactivación requiere una nueva revisión.

La opción segura es impedir desactivar mientras existan solicitudes abiertas, o cerrar/reasignar esas relaciones dentro de una transacción explícita.

## Esquema futuro

En SQL se recomiendan tablas separadas:

```text
specialist_profiles
specialist_roles
specialist_media
specialist_requests
```

La unicidad abierta se implementa con un índice parcial sobre `(client_user_id, role)` para estados `pending` y `accepted`.

En Firestore se proponen:

```text
specialistProfiles/{profileId}
specialistRequests/{requestId}
specialistSlots/{clientUserId_role}
```

`specialistSlots` permite reservar la rama en la misma transacción que crea la solicitud. Los archivos viven en Cloud Storage y Firestore conserva únicamente metadatos y claves.

Google Identity Services o Firebase Authentication solo cambian cómo se obtiene `userId`. No modifican los roles, solicitudes, restricciones ni almacenamiento funcional del módulo.
