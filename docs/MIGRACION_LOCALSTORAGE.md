# Migración desde localStorage

## Situación heredada

La versión estática utilizaba el navegador como base de datos y como almacén de sesión. Esto produce tres problemas:

- los datos solo existen en un navegador y dispositivo;
- cualquier script de la página o persona con acceso al navegador puede leerlos y modificarlos;
- las contraseñas se almacenaban en texto plano.

La nueva aplicación no considera `localStorage` una fuente confiable de identidad.

## Claves detectadas

### Formato consolidado

| Clave | Contenido |
| --- | --- |
| `romanColosseum.users.v2` | Arreglo de usuarios con perfil y datos anidados |
| `romanColosseum.session.v2` | Identificador del usuario activo |

Cada usuario consolidado podía contener:

```text
id
name
email
password
birthDate
sex
createdAt
data.routine
data.diet
data.calorieHistory
```

### Formato anterior

| Clave | Contenido |
| --- | --- |
| `nombreRegistro` | Nombres por índice |
| `correoRegistro` | Emails por índice |
| `claveRegistro` | Contraseñas por índice |
| `nacimientoRegistro` | Fechas de nacimiento por índice |
| `sexoRegistro` | Valores de perfil por índice |
| `rutinaUsuarios` | Rutinas asociadas por índice |
| `sesionIniciada` | Indicador de sesión |
| `usuarioActivo` | Índice del usuario activo |

También aparecen variantes inconsistentes como `rutinaUsuarioStorage` y `rutinaUsuariosStorage`. Un importador no debe asumir que ambas tienen el mismo esquema.

## Decisión de seguridad

Nunca se importan como prueba de identidad:

- contraseñas heredadas;
- identificadores de sesión;
- índice de usuario activo;
- IDs generados en cliente sin validación.

Los datos del navegador son modificables. Permitir que creen una cuenta autenticada sin nueva verificación permitiría suplantación.

## Estrategia predeterminada

La opción más segura es comenzar con una cuenta nueva en el servidor:

1. El usuario se registra con una contraseña nueva o con el proveedor elegido.
2. La sesión nueva se emite desde el servidor.
3. Las credenciales y sesiones antiguas se ignoran.
4. El progreso comienza vacío salvo que se habilite el importador voluntario descrito abajo.

La interfaz debe comunicar claramente si el progreso local anterior no se migrará.

## Importación voluntaria de progreso

Si conservar datos es un requisito, la importación debe ser temporal, visible y posterior a una autenticación nueva.

```text
Cuenta nueva autenticada
        │
        ▼
Herramienta temporal lee datos del navegador
        │
        ▼
Usuario revisa el resumen a importar
        │
        ▼
Servidor valida y asocia todo al userId de la sesión
        │
        ▼
Informe de aceptados y rechazados
```

El cuerpo enviado no incluye un `userId` confiable. El servidor usa exclusivamente el usuario de la cookie.

Para mantener la aplicación principal completamente libre de `localStorage`, la herramienta puede ser:

- una página temporal servida solo durante el periodo de migración;
- un exportador independiente ejecutado sobre la versión heredada;
- una utilidad manual que genere un archivo JSON de progreso para subir después de iniciar sesión.

Una vez terminada la transición, se elimina la herramienta y su permiso de importación.

## Mapeo del perfil

| Legado | Nuevo dominio | Transformación |
| --- | --- | --- |
| `name` / `nombreRegistro[i]` | `name` | Recortar, normalizar espacios y validar 2–80 caracteres |
| `email` / `correoRegistro[i]` | No se usa para autorizar importación | Solo referencia informativa |
| `birthDate` | `birthDate` | Validar `AAAA-MM-DD` |
| `sex` | `sex` | Conservar `mujer`/`hombre`; otro → `prefiero no decirlo` |
| `password` / `claveRegistro[i]` | Ninguno | Descartar |
| sesión antigua | Ninguno | Descartar |

Por defecto no se sobrescribe el nombre o email verificado de la cuenta nueva con valores heredados. El usuario puede elegir actualizar campos de perfil admitidos.

## Mapeo de rutina

La rutina consolidada usa días como claves. El formato más antiguo podía usar una matriz `semana` en este orden:

```text
0 lunes
1 martes
2 miércoles
3 jueves
4 viernes
5 sábado
6 domingo
```

Mapeo de ejercicio:

| Legado | Nuevo campo |
| --- | --- |
| `muscle` o `grupoMuscular` | `muscle` |
| `name` o `nombreEjercicio` | `name` |
| `sets` o `numeroSeries` | `sets` |
| `reps` o `numeroRepeticiones` | `reps` |
| `notes` o `descripcionEjercicio` | `notes` |

Transformaciones:

- generar un ID nuevo en servidor;
- convertir series a entero entre 1 y 30;
- recortar textos;
- normalizar el día;
- conservar el orden de inserción original dentro de cada día;
- rechazar ejercicios incompletos en lugar de inventar contenido;
- mostrar cada rechazo en el informe.

## Mapeo de dieta

El objeto `data.diet` puede aportar:

- `goal`;
- `preference`;
- `meals`;
- `createdAt`.

Los valores admitidos permanecen en español: objetivo `ganar`, `mantener` o `perder`; preferencia `general`, `vegetariana` o `rapida`. Solo se acepta 3, 4 o 5 comidas. El plan importado recibe ID y `updatedAt` nuevos del servidor, mientras que una fecha original válida puede conservarse como `createdAt`.

Si el objeto es parcial o contiene valores desconocidos, se omite sin afectar la rutina.

## Mapeo de cálculos

El historial consolidado guardaba principalmente:

- calorías de mantenimiento;
- BMR;
- fecha.

No siempre contiene edad, peso, altura, selección de fórmula o actividad. El dominio nuevo exige todas las entradas para que un resultado sea reproducible. Por ello, un cálculo incompleto se omite y se informa al usuario; nunca se inventan valores.

Si existen cálculos completos, se validan, se marca `formulaVersion=mifflin-st-jeor-v1`, se recalculan los resultados y se conservan solo los diez más recientes conforme a la política actual.

## Validación y conflictos

El servidor aplica límites actuales a todos los registros. La importación debe definir:

- máximo de ejercicios por solicitud;
- tamaño máximo del archivo;
- máximo de longitud por texto;
- política para duplicados;
- fecha mínima y máxima aceptable;
- versión del esquema de importación.

Política sugerida para duplicados:

- crear IDs nuevos;
- comparar día, nombre, series y repeticiones;
- mostrar posibles duplicados antes de confirmar;
- nunca eliminar automáticamente datos que ya existen en servidor.

## Informe de importación

La respuesta debe ser comprensible:

```text
Ejercicios detectados: 24
Ejercicios importados: 22
Ejercicios omitidos: 2
Plan de dieta importado: sí
Cálculos heredados importados: 0
Contraseñas y sesiones descartadas: sí
```

Cada elemento omitido incluye un motivo sin exponer datos sensibles en logs.

## Eliminación de datos locales

No se borran claves automáticamente antes de confirmar que el servidor aceptó los datos. Después del éxito, la herramienta puede ofrecer al usuario eliminarlas explícitamente.

La nueva aplicación no necesita conservar compatibilidad permanente. El código de importación debe tener fecha o versión de retirada.

## Fases de migración

1. Inventariar datos y fijar esquema de importación.
2. Publicar la aplicación de servidor con cuentas nuevas.
3. Habilitar el importador solo si el producto lo requiere.
4. Medir importaciones sin registrar contenido personal.
5. Comunicar fecha de cierre.
6. Retirar herramienta, endpoints y lectura de claves.
7. Comprobar que una búsqueda de `localStorage` y `sessionStorage` no encuentra uso en la aplicación final.

## Criterios de aceptación

- Ninguna contraseña heredada llega a persistencia.
- Ninguna sesión heredada crea autorización.
- Todo progreso se asocia al usuario autenticado del servidor.
- Datos inválidos se rechazan con un informe.
- Un fallo parcial no corrompe el archivo principal.
- Reintentar no duplica silenciosamente el mismo contenido.
- La herramienta temporal se puede retirar sin tocar dominio ni repositorios normales.
