# Roman Colosseum

Roman Colosseum es una aplicación web para organizar una rutina semanal, generar una guía de alimentación y registrar estimaciones de gasto calórico. La interfaz conserva la identidad visual inspirada en la antigua Grecia, mientras que la aplicación se migra a Astro con renderizado en servidor y una arquitectura desacoplada de cualquier proveedor de datos o identidad.

## Estado de la arquitectura

La aplicación se diseña con estas decisiones principales:

- Astro funciona en modo SSR para proteger rutas y ejecutar operaciones de datos en el servidor.
- `APP_ACCESS_MODE` permite una vista demo temporal sin desmontar la autenticación futura.
- Los datos persistentes dejan de guardarse en `localStorage`.
- La persistencia inicial usa un archivo JSON del servidor mediante repositorios intercambiables.
- Las sesiones usan Astro Sessions y cookies `HttpOnly`; el JavaScript del navegador no recibe ni administra la sesión.
- La autenticación se mantiene separada de la persistencia para poder adoptar después Google Identity Services o Firebase Authentication.
- Google Identity Services autentica usuarios, pero **no almacena rutinas, dietas ni cálculos**.

La persistencia en archivo está pensada para desarrollo, demostraciones y despliegues de una sola instancia. Antes de escalar horizontalmente o desplegar en infraestructura con disco efímero se debe cambiar el adaptador por una base de datos como Firestore, SQLite o PostgreSQL.

## Funciones de la aplicación

- Registro e inicio de sesión con correo y contraseña cuando `APP_ACCESS_MODE=authenticated`.
- Acceso directo al menú y sus módulos cuando `APP_ACCESS_MODE=demo`.
- Sesión segura administrada por el servidor.
- Panel personal con resumen de actividad.
- Tres modalidades de rutina compatibles: automática con IA, creación manual y asignación por entrenador.
- Semana visual de lunes a domingo con descansos, series, repeticiones, pausas, tempo y descarga PDF.
- Tres modalidades de dieta compatibles: automática con IA, creación manual y asignación por nutricionista.
- Ingredientes con cantidad y unidad, objetivos nutricionales aproximados y descarga PDF real.
- La dieta automática exige un cálculo previo de peso, altura y edad.
- Cálculo de metabolismo basal y mantenimiento con Mifflin-St Jeor.
- Historial personal de estimaciones calóricas.
- Perfil de cuenta editable con fotografía, nombre visible y cambio seguro de contraseña.
- Directorio conjunto de entrenadores personales y nutricionistas, con búsqueda directa por identificador.
- Una solicitud o asesoría activa por usuario en cada especialidad.
- Perfil profesional con uno o dos roles, fotografía y certificados PDF opcionales.
- Apartado Mi trabajo con solicitantes y asesorados separados por rol.
- Blog público de entrenamiento, alimentación y recuperación.

## Requisitos

- Node.js en una versión LTS compatible con la versión de Astro declarada por el proyecto.
- npm.
- Permiso de escritura en el directorio configurado mediante `DATA_FILE_PATH`.
- Permiso de escritura en `UPLOADS_DIRECTORY` para fotografías y certificados.

No se necesita una cuenta de Firebase ni credenciales de Google para ejecutar el modo inicial con `AUTH_PROVIDER=password`.

## Inicio rápido

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea el archivo de entorno local a partir del ejemplo:

   En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   En macOS o Linux:

   ```bash
   cp .env.example .env
   ```

3. Revisa al menos estas variables:

   ```dotenv
   APP_ORIGIN=http://localhost:4321
   APP_ACCESS_MODE=demo
   DATA_FILE_PATH=.data/roman-colosseum.json
   UPLOADS_DIRECTORY=.data/uploads
   AUTH_PROVIDER=password
   SESSION_TTL_SECONDS=604800
   ```

4. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abre `http://localhost:4321`.

Los directorios de `DATA_FILE_PATH` y `UPLOADS_DIRECTORY` deben poder escribirse. Ninguno debe colocarse dentro de `public/` ni subirse al repositorio.

## Comandos habituales

Los comandos definitivos están declarados en `package.json`:

```bash
npm run dev
npm run check
npm test
npm run build
npm run preview
npm run test:smoke
```

`test:smoke` prueba el artefacto SSR de `dist/` en ambos modos: autenticación, archivos profesionales, directorio, solicitud/aceptación, los módulos fitness, persistencia después de reiniciar el servidor y cierre de sesión. Por eso debe ejecutarse después de `npm run build`.

## Rutas funcionales

| Ruta | Acceso | Responsabilidad |
| --- | --- | --- |
| `/` | Público | Portada y navegación principal |
| `/blog` | Público | Contenido educativo |
| `/iniciar-sesion` | Invitado | Inicio de sesión; redirige a `/app` en modo demo |
| `/registro` | Invitado | Creación de cuenta; redirige a `/app` en modo demo |
| `/app` | Autenticado | Resumen personal |
| `/app/rutina` | Autenticado | Rutina automática, manual y de especialista |
| `/app/dieta` | Autenticado | Dieta automática, manual y de especialista |
| `/app/calculadora` | Autenticado | Estimación e historial calórico |
| `/app/perfil` | Autenticado | Fotografía, nombre visible y contraseña de la cuenta |
| `/app/especialistas` | Autenticado | Directorios, elecciones y registro profesional |
| `/app/mi-trabajo` | Especialista | Solicitantes y asesorados por rol activo |
| `/app/mi-trabajo/nutricion/[requestId]` | Nutricionista asignado | Crear o editar la dieta de un asesorado |
| `/app/mi-trabajo/entrenamiento/[requestId]` | Entrenador asignado | Crear o editar la rutina de un asesorado |

Las URLs heredadas bajo `/pages/*.html` deben redirigirse a sus rutas canónicas durante la transición.

## Organización conceptual

```text
Presentación Astro
        │
        ▼
Casos de uso de la aplicación
        │
        ▼
Dominio y contratos de salida
        ▲
        │
Adaptadores de infraestructura
```

- `src/domain`: entidades, tipos y reglas que no dependen de Astro ni de un proveedor.
- `src/application`: casos de uso y puertos de repositorio, sesión, contraseña e identidad.
- `src/infrastructure`: configuración, persistencia, criptografía e integraciones externas.
- `src/pages`, `src/components` y `src/layouts`: entrada HTTP y presentación.
- `src/middleware.ts`: resolución de sesión y protección de páginas privadas.

La composición de dependencias ocurre en un punto único del servidor. La presentación consume casos de uso; no instancia repositorios ni lee archivos directamente.

## Datos y seguridad

- No se guardan datos funcionales en `localStorage` ni `sessionStorage`.
- Las contraseñas se almacenan únicamente como hashes `scrypt` con sal dentro de la identidad `password`.
- Astro Sessions guarda únicamente el `userId`; rutina, dieta y cálculos nunca se duplican en la sesión.
- El identificador del usuario se obtiene de la sesión, nunca del cuerpo de una petición.
- Las páginas privadas se validan antes de renderizarse.
- `.env`, el archivo de datos y cualquier credencial de proveedor deben permanecer fuera de Git.

## Modo demo temporal

El entorno local incluido usa `APP_ACCESS_MODE=demo`. Login, registro, logout y sus endpoints quedan ocultos o redirigidos, mientras `/app`, rutina, dieta, calculadora y especialistas funcionan con el propietario reservado `demo-user-v1`. Sus datos siguen guardándose en el servidor y sobreviven reinicios.

El perfil es compartido por todos los visitantes de esa instancia. No debe exponerse así en producción pública: cualquier visitante podría leer o modificar el mismo progreso. Para restaurar el comportamiento privado basta cambiar:

```dotenv
APP_ACCESS_MODE=authenticated
```

El valor predeterminado del código es `authenticated`, de forma que omitir la variable no abre accidentalmente la aplicación. Los datos demo no se transfieren automáticamente a una cuenta futura.

Los datos antiguos de `localStorage` no constituyen una fuente confiable de identidad. Las contraseñas y sesiones heredadas se descartan. Si se ofrece una importación temporal, solo debe copiar progreso hacia una cuenta nueva ya autenticada.

## Elegir autenticación futura

`AUTH_PROVIDER` reserva la selección del mecanismo de identidad y es independiente de `APP_ACCESS_MODE`:

- `password`: credenciales administradas por la aplicación; es el único modo operativo en la versión inicial.
- `google`: contrato preparado para un futuro adaptador de Google Identity Services.
- `firebase`: contrato preparado para un futuro adaptador de Firebase Authentication.

Seleccionar `google` o `firebase` antes de instalar su adaptador debe detener el arranque con un error claro. La aplicación nunca cambia silenciosamente a contraseña.

La elección de autenticación es independiente de dónde se guardan los datos. Es posible, por ejemplo, usar Google Identity Services con Firestore o Firebase Authentication con PostgreSQL.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Modelo de dominio](docs/MODELO_DE_DOMINIO.md)
- [Persistencia](docs/PERSISTENCIA.md)
- [Autenticación](docs/AUTENTICACION.md)
- [Variables de entorno](docs/VARIABLES_DE_ENTORNO.md)
- [Migración desde localStorage](docs/MIGRACION_LOCALSTORAGE.md)
- [Módulo de especialistas](docs/ESPECIALISTAS.md)
- [Módulo de dietas](docs/DIETAS.md)
- [Perfil de cuenta](docs/PERFIL.md)
- [ADR 001: Astro SSR](docs/decisions/001-astro-ssr.md)
- [ADR 002: persistencia en archivo](docs/decisions/002-file-persistence.md)
- [ADR 003: autenticación neutral al proveedor](docs/decisions/003-provider-neutral-auth.md)

## Versión estática archivada

La implementación anterior se conserva íntegra en [`legacy-static/`](legacy-static/README.md) únicamente como referencia de migración. Astro no compila ni publica ese directorio. Sus recursos visuales activos se copiaron a `public/assets/`; el JavaScript heredado y su uso de almacenamiento del navegador no forman parte de la aplicación nueva.

## Convenciones de documentación del código

Los nombres técnicos deben ser consistentes y los textos visibles permanecer en español. Cada entidad, puerto, caso de uso, adaptador y función exportada debe explicar mediante TSDoc:

- su responsabilidad;
- entradas y salidas;
- invariantes relevantes;
- errores esperados;
- efectos persistentes o de seguridad.

Los comentarios internos deben explicar el motivo de una decisión no obvia. No deben repetir literalmente lo que ya expresa el código.
