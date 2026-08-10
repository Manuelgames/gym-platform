# Aplicación estática archivada

Este directorio conserva la versión anterior a la migración a Astro. Se mantiene para poder auditar reglas, textos, estilos y formatos históricos durante la transición; **no es parte de la aplicación activa**.

## Contenido

- `index.html` y `pages/`: páginas HTML antiguas.
- `scrips/`: JavaScript heredado, incluido el acceso a `localStorage`.
- `styles/`: CSS original.
- `assets/`: copia original de los recursos visuales.

Los recursos usados por Astro viven en `public/assets/`. Las rutas antiguas continúan funcionando mediante redirecciones declaradas en `astro.config.mjs`, no sirviendo estos archivos.

## Advertencia de seguridad

Esta versión guardaba cuentas, contraseñas, sesión y progreso en el navegador. No debe desplegarse ni reutilizarse como sistema de autenticación. La aplicación Astro descarta esas credenciales y conserva la información funcional exclusivamente en persistencia server-side.

La estrategia segura para una importación voluntaria de progreso se documenta en [`../docs/MIGRACION_LOCALSTORAGE.md`](../docs/MIGRACION_LOCALSTORAGE.md).
