# ADR 001: usar Astro con renderizado en servidor

- Estado: aceptada
- Fecha: 2026-08-05

## Contexto

La aplicación original estaba formada por archivos HTML, CSS y JavaScript ejecutados en el navegador. La sesión y los datos se resolvían después de cargar la página mediante `localStorage`. Una página marcada como privada podía empezar a cargarse antes de que un script comprobara la sesión.

La nueva versión necesita:

- persistencia fuera del navegador;
- protección real de páginas privadas;
- cookies `HttpOnly`;
- endpoints para modificar rutina, dieta y cálculos;
- una futura integración de identidad que requiere verificar tokens en servidor.

## Decisión

Usar Astro en modo SSR con un adaptador de servidor. Astro Sessions guarda únicamente `userId`; el middleware resuelve ese usuario y las páginas protegidas se autorizan antes de renderizarse.

La portada, el blog y los formularios también pueden renderizarse en servidor para producir una navegación consistente con la sesión. La interactividad se implementa con JavaScript cliente pequeño y mejora progresiva.

## Consecuencias positivas

- Los secretos y credenciales administrativas permanecen en servidor.
- La sesión no se expone a JavaScript.
- Las rutas privadas no dependen de una redirección cliente.
- Los componentes Astro sustituyen HTML duplicado.
- No se necesita un framework de interfaz adicional para las funciones actuales.
- Los proveedores de identidad pueden verificarse en endpoints seguros.

## Costes y limitaciones

- La aplicación requiere un runtime de servidor; ya no es suficiente publicar solo archivos estáticos.
- El despliegue debe usar un adaptador compatible con la plataforma.
- Las páginas dependientes de sesión no pueden servirse como HTML estático compartido sin una estrategia adicional.
- El equipo debe distinguir con claridad código server-only y código enviado al cliente.

## Alternativas consideradas

### Astro completamente estático

Descartado porque obliga a resolver autorización y persistencia mediante servicios consumidos directamente desde el navegador. No satisface por sí solo la sesión `HttpOnly` ni la protección SSR.

### Aplicación SPA con otro framework

No se justifica por la complejidad actual. Las vistas existentes son principalmente formularios y contenido. Agregaría hidratación y estado cliente sin resolver la necesidad de servidor.

### Mantener HTML y añadir un backend separado

Es viable, pero conservaría duplicación de layout y dos estructuras de proyecto. Astro permite reunir presentación y endpoints sin introducir reglas de dominio en las páginas.

## Condiciones de revisión

Revisar esta decisión si:

- se separa formalmente frontend y backend;
- aparece una aplicación móvil que exige una API pública versionada;
- la plataforma elegida no puede ejecutar el adaptador SSR;
- el contenido público necesita una estrategia de caché o prerenderizado independiente.
