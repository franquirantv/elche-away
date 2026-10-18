# Elche Away

**Donde tú vayas.** Archivo personal de viajes y estadios siguiendo al Elche CF. No es un producto oficial del club.

## Stack instalado

Next.js 16 (App Router), React 19, TypeScript 5 estricto, Tailwind CSS 4, PostgreSQL en Neon, Neon Auth con Google, Drizzle ORM y el driver `pg` (node-postgres). npm gestiona dependencias; ESLint comprueba código, `tsx` ejecuta scripts TypeScript y el runner de Node ejecuta pruebas. `package-lock.json` fija las versiones resueltas.

PostgreSQL es la única fuente persistente. Hay acceso con Google y edición privada de referencias; todavía no hay gestión de partidos/asistencias, importación/API de fútbol, fotos ni mapa interactivo. Los ejemplos son sintéticos: no representan resultados ni viajes reales. No hay datos JSON alternativos ni un fallback de demostración si falla PostgreSQL.

## Requisitos

- Node.js 22.20 o posterior dentro de la rama 22 recomendado (`.nvmrc`); versiones compatibles en `package.json`.
- npm 10.9.9 o posterior y Git. Node 22 instala una versión compatible; npm 10.8.2 bajo Node 20 falló al resolver el SDK de Auth.
- Un proyecto Neon exclusivamente no productivo con dos ramas: `development` y `testing`. Testing debe ser desechable. Para pruebas automatizadas también sirve PostgreSQL local con dos bases distintas; el acceso real con Google requiere Neon Auth configurado aparte.

Con nvm: `nvm install` y `nvm use` dentro del repositorio. No necesitas CLI Neon, Docker ni una clave API de Neon para usar cadenas de conexión ya disponibles.

## Instalación desde un clon limpio

```sh
git clone https://github.com/franquirantv/elche-away.git
cd elche-away
npm ci
cp .env.example .env.local
```

Rellena `.env.local` antes de continuar. Si ya existe, conserva su contenido en lugar de reemplazarlo. Al actualizar dependencias intencionadamente, usa npm y conserva el lockfile.

## Preparar PostgreSQL y variables de entorno

1. En la consola Neon, crea o reutiliza un proyecto **no productivo**, por ejemplo `elche-away-development`. Habilita solo PostgreSQL; no conectes Vercel ni otros servicios.
2. Nombra la rama inicial `development`. Si Neon la llama `production`, renómbrala en este proyecto nuevo: no es nuestro entorno de producción.
3. Crea `testing` desde `development` mientras todavía está vacía. Las ramas tienen endpoints independientes; las migraciones posteriores se aplican explícitamente a cada una. No uses una rama derivada de datos reales.
4. En **Connect**, copia las conexiones completas con sus parámetros SSL, seleccionando la rama correcta para cada variable:

| Variable | Destino | Tipo y uso |
| --- | --- | --- |
| `DATABASE_URL` | development | Pooled (`-pooler`): aplicación local. |
| `DATABASE_URL_UNPOOLED` | development | Directa: migraciones y seed. Debe apuntar a la misma base que la anterior. |
| `TEST_DATABASE_URL` | testing | Directa: pruebas; debe apuntar a otra rama/base. |

Los scripts leen `.env.local` como Next.js; las variables ya definidas en el proceso tienen prioridad (CI). El driver mantiene explícitamente verificación TLS completa para las conexiones Neon con `sslmode=require`. No uses conexiones de producción. Las cadenas no se imprimen en los scripts ni deben compartirse por chat.

`.env.local` está ignorado por Git. Compruébalo con `git check-ignore .env.local`; solo `.env.example`, sin valores, se versiona. Ninguna variable de base de datos lleva el prefijo `NEXT_PUBLIC_`.

## Acceso del propietario con Google (Milestone 3)

En el proyecto Neon no productivo, habilita **Auth** para `development` y `testing` y confirma que Google está disponible con las credenciales compartidas de desarrollo. Cada rama necesita su propia Auth URL. No actives Data API, Storage ni otros servicios. Si localhost no está permitido en Auth → configuración de dominios, habilítalo para estas ramas. No uses comodines de producción.

Añade a `.env.local`, sin sustituir las conexiones PostgreSQL:

| Variable | Uso |
| --- | --- |
| `NEON_AUTH_BASE_URL` | Auth URL completa de development, incluido su path. |
| `NEON_AUTH_COOKIE_SECRET` | Secreto local independiente de 32+ caracteres para el SDK. |
| `ADMIN_USER_ID` | Identificador exacto de tu usuario Neon Auth en development. Vacío inicialmente: nadie es admin. |
| `TEST_NEON_AUTH_BASE_URL` | Auth URL completa de testing; distinta de development. |
| `TEST_NEON_AUTH_COOKIE_SECRET` | Otro secreto independiente de 32+ caracteres. |
| `TEST_ADMIN_USER_ID` | Identificador explícito del propietario en testing; puede diferir del de development. |

Genera cada secreto ejecutando `openssl rand -base64 32` por separado. No son contraseñas de Google/PostgreSQL y Neon no los proporciona. No los compartas ni los subas a Git. Todas estas variables son de servidor y no llevan `NEXT_PUBLIC_`.

**Configurar tu identidad requiere un primer acceso, sin permisos automáticos:**

1. Arranca `npm run dev` y abre http://localhost:3000/auth/sign-in.
2. Pulsa **Continuar con Google** e inicia sesión con tu cuenta. Volverás a `/auth/account`.
3. La pantalla mostrará tu identificador y que aún no tienes permisos. Copia ese ID en `ADMIN_USER_ID` dentro de `.env.local`, revisando que sea tu propia sesión de development. No se acepta un email, rol ni el ID enviado por un formulario.
4. Reinicia el servidor y visita `/admin`. Solo la identidad configurada puede leer referencias y ejecutar cambios.
5. Para comprobar el otro entorno, ejecuta `npm run dev:testing` y usa http://localhost:3001/auth/sign-in. El script fuerza la base, Auth URL, secreto e identidad de testing; no reutiliza valores de development. Copia el ID de `/auth/account` de ese entorno en `TEST_ADMIN_USER_ID` y reinicia ese servidor. Usa los hosts `localhost` indicados para las comprobaciones de cookies/OAuth. Abre testing en otro perfil de navegador o en una ventana de incógnito: las cookies se comparten entre puertos del mismo host y usar 3001 no las aísla por sí solo.

`npm run dev:testing` usa `.next-testing/`; puede convivir con development y con la suite automática. Se niega a arrancar si falta configuración aislada. No crees una contraseña local ni actives permisos de administrador en Neon para conceder acceso al archivo: los roles del servicio no sustituyen nuestra allowlist.

El proxy de sesión cubre `/admin` y `/auth/account`, donde completa el intercambio nativo del verificador de OAuth; cada lectura/acción vuelve a verificar la sesión con Neon (sin confiar en el snapshot de cookie cacheado) y compara el ID. Falta de configuración, sesión caducada/revocada, otra cuenta o error de Auth impiden operar. La aplicación no ofrece una pantalla de registro público ni concede acceso al primer usuario; las cuentas de Auth se gestionan en Neon. La pantalla de cuenta muestra únicamente el ID de su propia sesión, no datos de administración.

En `/admin` puedes crear, editar y eliminar clubes, estadios, competiciones, divisiones y temporadas. Despliega una referencia para editarla. Los slugs existentes se conservan al cambiar nombres. Eliminar requiere confirmación y falla si existen referencias dependientes; Elche CF nunca se puede eliminar. Todavía no hay edición de partidos, notas, asistencias, fotos ni importaciones.

**Comprobación manual antes de integrar Milestone 3:** verifica en ambos entornos login real con Google, conservación de sesión tras recargar, acceso solo con el ID configurado y cierre de sesión. Si dispones de otra cuenta, confirma que puede autenticarse pero no administrar. Las pruebas automáticas cubren esos límites con sesiones sintéticas y el SDK real, pero no prueban el consentimiento real de Google.

Aceptación manual del Milestone 3 completada por el propietario el 2026-10-18 en development y testing: login con Google, acceso al admin, persistencia tras recargar y logout.

Neon gestiona sus tablas de Auth; no las migres con Drizzle ni las cargues con el seed. Para producción habrá que configurar OAuth/dominio propios posteriormente; no está configurada por este milestone.

## Migraciones y datos sintéticos

Primero verifica la migración en testing y carga sus ejemplos:

```sh
npm run db:migrate:test
npm run db:seed:test
npm test
```

Después prepara desarrollo:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Los scripts seleccionan su destino explícitamente; comprueban separación de testing y coherencia de las conexiones de desarrollo y se niegan a escribir con `NODE_ENV=production` o en Vercel. Esta comprobación no puede demostrar a qué entorno pertenece una credencial: tú debes configurar exclusivamente las ramas no productivas.

La migración inicial crea siete tablas y el registro de migraciones Drizzle. No borra tablas ni se ejecuta durante un request/build. Repetir el comando no reaplica migraciones ya registradas. Antes de cambiar el esquema, ejecuta `npm run db:generate`, revisa el SQL y prueba la actualización en testing; nunca uses schema push.

El seed es transaccional e idempotente: añade ejemplos ausentes con IDs estables, no elimina datos ni sobrescribe correcciones existentes. Incluye seis partidos ficticios, cinco asistencias, dos estadios visitados (uno con dos visitas), otro no visitado, liga/copa de ejemplo, división por temporada y datos incompletos. El único club real de referencia es Elche CF; todos los encuentros, rivales y estadios del seed son inventados. Los archivos TypeScript de fixtures solo son entrada para cargar PostgreSQL, nunca la persistencia ni la fuente de las páginas.

No hay comando de reset automático. No ejecutes semillas contra datos reales. Si alteras los fixtures de testing, las pruebas pueden fallar por esas diferencias; usa una base de testing nueva y vacía para recuperar un punto de partida limpio, sin borrar desarrollo.

## Desarrollo local y acceso

```sh
npm run dev
```

Abre **http://localhost:3000**. Si el puerto está ocupado, usa la URL que muestre Next.js. Detén el servidor con `Ctrl+C`. Las páginas del archivo leen PostgreSQL en cada petición; una corrección aparece sin reconstruir la aplicación.

| Ruta | Contenido |
| --- | --- |
| `/` | Shell de inicio; los totales se incorporarán en un milestone posterior. |
| `/trips` | Cronología de asistencias, con fechas desconocidas al final. |
| `/trips/[slug]` | Partido, temporada/división, competición, estadio y recuerdos del viaje. |
| `/stadiums` | Solo estadios con visitas registradas, con número de visitas. |
| `/stadiums/[slug]` | Información y viajes asociados al estadio visitado. |
| `/map` | Estado de próxima disponibilidad, sin mapa interactivo. |
| `/auth/sign-in` | Acceso con Google. |
| `/auth/account` | Sesión propia, identificador para configurar la allowlist y cierre de sesión. |
| `/admin` | Gestión protegida de referencias; requiere identidad configurada. |

Abre los detalles desde los enlaces de las listas: `[slug]` es un parámetro, no una URL literal. El seed ofrece `/stadiums/estadio-del-corcho-ejemplo` y un viaje de información incompleta en `/trips/viaje`. Los nombres/fechas corregidos no regeneran slugs. Un estadio no visitado o un viaje inexistente no es público; muestra 404.

Si la base está vacía, las listas muestran estados vacíos. Si falta configuración, la base no está migrada o PostgreSQL falla, se muestra un error genérico con opción de reintentar: no se inventan datos ni se presentan fallos como un archivo vacío.

## Scripts y pruebas

| Comando | Función |
| --- | --- |
| `npm run dev` | Desarrollo con recarga automática en development. |
| `npm run dev:testing` | QA manual con la base/Auth/identidad de testing en localhost:3001. |
| `npm run lint` | ESLint, incluidas advertencias como errores. |
| `npm run typecheck` | Tipos de rutas Next.js y TypeScript sin emitir código. |
| `npm test` | Migra y carga datos sintéticos en testing; ejecuta integración PostgreSQL y HTTP. |
| `npm run build` | Compilación de producción; no ejecuta migraciones ni consulta la base. |
| `npm start` | Sirve el build local; necesita configuración de base para consultar el archivo. |
| `npm run db:generate` | Genera migración SQL/snapshot Drizzle sin conectarse a una base. |
| `npm run db:migrate` / `npm run db:seed` | Migra / carga ejemplos en development. |
| `npm run db:migrate:test` / `npm run db:seed:test` | Migra / carga ejemplos en testing. |

`npm test` nunca usa development para consultar ni modificar registros. Sus tests SQL usan transacciones/savepoints con rollback; las pruebas HTTP arrancan su servidor con `DATABASE_URL` reemplazada por testing y restauran la corrección sintética usada para verificar lecturas frescas. No se borran ni reinician bases automáticamente. El servidor HTTP de pruebas usa un puerto libre y su propia salida `.next-test/`, sin reutilizar el servidor ni las credenciales de desarrollo. Para Auth levanta un upstream de loopback con sesiones sintéticas; ejercita el SDK, middleware y Server Actions reales sin tocar usuarios de Google/Neon Auth. Ningún bypass de login está disponible en la aplicación. Ejecuta una sola suite a la vez sobre la rama testing compartida. La variable interna `ARCHIVE_TEST_SERVER` se configura automáticamente en el runner y en `dev:testing`; no la añadas a `.env.local`.

Se verifican restricciones, nulos, sedes repetidas, separación asistencia/partido, competición/división, orden de fechas, correcciones y slugs, páginas y exclusión de fixtures no asistidos. Revisa también foco y presentación móvil/escritorio al cambiar UI.

El SDK oficial está fijado a `@neondatabase/auth@0.6.0-beta`; incluye dependencias UI transitivas aunque esta aplicación no utiliza su kit visual. npm avisa de algunos peers transitivos incompatibles; la instalación limpia, tipos y pruebas se verifican con el lockfile. Revisar en actualizaciones deliberadas, sin forzar versiones internas del SDK.

La CI usa PostgreSQL 17 efímero con bases separadas y credenciales locales de prueba; no requiere secretos Neon ni accede a tus ramas. Ejecuta npm ci, lint, tipos, tests y build en push/PR, sin despliegue.

La auditoría actual muestra avisos altos en la cadena de ESLint y moderados en el esbuild transitivo de Drizzle Kit; este último también aparece al auditar producción por los peers del SDK. No se utiliza un servidor esbuild de desarrollo en la aplicación. No se han aplicado downgrades ni overrides forzados.

Se mantiene ESLint 9 por compatibilidad declarada de los plugins de Next.js, aunque npm avisa que esa rama ya no tiene soporte. Revisa los avisos de `npm audit` al actualizar tooling; no apliques `npm audit fix --force` sin evaluar los cambios.

## Estructura

- `src/app/`: layout, estilos y rutas públicas de lectura.
- `src/components/`: navegación, estado vacío y lista de viajes.
- `src/db/`: esquema Drizzle, conexión, consultas públicas y entrada de fixtures sintéticos.
- `src/lib/`: identidad estable de Elche, formato, geografía y slugs.
- `src/server/`: sesión Neon Auth, allowlist y límites de administración.
- `src/proxy.ts`: middleware nativo de sesión para `/admin` y el retorno OAuth en `/auth/account`.
- `drizzle/`: migraciones SQL y metadatos generados; estos JSON describen el esquema, no almacenan partidos.
- `scripts/`: comandos locales explícitos de base de datos.
- `tests/`: integración PostgreSQL y HTTP.
- `.github/workflows/`: CI; `.agents/skills/`: workflows para agentes.

## Documentación interna

- [AGENTS.md](AGENTS.md): reglas recurrentes, comunicación y verificaciones.
- [PRODUCT.md](docs/PRODUCT.md): vocabulario, alcance y reglas.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): límites de aplicación e integraciones.
- [DATABASE.md](docs/DATABASE.md): modelo, restricciones y migraciones.
- [DESIGN.md](docs/DESIGN.md): dirección visual/UX.
- [ROADMAP.md](docs/ROADMAP.md): milestones y límite del MVP.

## Estado del proyecto

**Milestone 3 implementado; pendiente de configurar las identidades reales y completar la aceptación manual de Google.** La edición de referencias y los límites de autorización se verifican automáticamente con datos sintéticos. No integrar hasta confirmar la comprobación manual anterior. Milestone 4a (gestión de partidos/asistencias) no se ha iniciado; importaciones, fotos y mapa interactivo siguen pendientes.

Este README se actualiza cuando cambia la forma de instalar, configurar, ejecutar o desarrollar el proyecto.
