# Milestone 6: preparación y aceptación del MVP

Estado: preparación local; **no autoriza provisioning, push, despliegue, cambios de dominio, credenciales ni datos reales**. No marcar el MVP publicado hasta completar los controles externos y obtener aceptación del propietario. Alcance cerrado a milestones 1–6; sin fotos ni estadísticas nuevas.

## 1. Verificación reproducible sin producción

Usar Node de `.nvmrc`, conexiones development/testing no productivas distintas y rol de testing con CREATEDB:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run db:rehearse-backup
```

`db:rehearse-backup` requiere `pg_dump`/`pg_restore` 17 o posteriores (certificados del sistema), compatibles con la versión del servidor en PATH. En este Mac ya están instalados en `/opt/homebrew/opt/libpq/bin`; no es necesario instalar herramientas. Crea dos bases aleatorias en el servidor de testing, migra/siembra exclusivamente la primera, exporta `public` y `drizzle` a un directorio temporal privado, restaura en la segunda (limpiando solo su esquema inicial con `--clean --if-exists`), compara todas las filas y el journal y verifica que migrar la restaurada es un no-op. Finalmente elimina exclusivamente sus propias bases confirmadas y el archivo temporal. Nunca exporta/restaura las bases configuradas. Ante SIGKILL/interrupción pueden quedar bases: conservar los nombres impresos y eliminar solo esas bases propias; no ejecutar limpiezas por prefijo indiscriminadas.

Este ensayo prueba el archivo relacional y las referencias a escudos, **no** los bytes de Storage ni el servicio gestionado Auth. No es un backup de los datos del propietario. Las pruebas HTTP emplean upstreams sintéticos Auth/S3; no sustituyen login Google ni aceptación en hosting.

## 2. Decisiones y autorización antes de servicios externos

Solicitar al propietario autorización y confirmar el inventario sin secretos antes de actuar:

- Proyecto/cuenta Vercel, elegibilidad y límites de coste 0 €, región cercana a Frankfurt, versión Node compatible y estrategia de pool para el runtime elegido. Revisar Fluid compute/pool antes del despliegue; no introducir dependencias de hosting sin necesidad comprobada.
- Proyecto/rama Neon de producción, PostgreSQL/Auth/Storage independientes de development/testing, sin copiar usuarios/datos privados a previews. Preview usa testing sintético con trabajo serializado; concurrencia requiere aislamiento adicional antes de habilitar escrituras.
- URL pública inicial/dominio y dominios de preview permitidos. DNS, compra de dominio o cambio de dominio requieren decisión expresa.
- Google OAuth propio para producción, redirect URI exacta de Neon Auth y trusted domains exactos de la aplicación. No usar credenciales Google compartidas de desarrollo en producción. Desactivar localhost en Auth de producción. Mantener Google como único flujo utilizado; no añadir un servicio de correo por este milestone.
- Responsable, ubicación cifrada y retención del backup real (SQL y objetos), ventana de recuperación y procedimiento de recuperación de Auth. No suponer que el historial gratuito de Neon sustituye una copia independiente.

**Atención al primer despliegue:** la documentación actual de Vercel indica que el primero de un proyecto nuevo es producción, incluso desde otra rama. No ejecutar `vercel`, conectar Git con auto-deploy ni crear el primer despliegue bajo la suposición de que será preview. Detenerse y acordar el arranque con el propietario. Un despliegue de producción sin dominio asignado sigue usando servicios productivos.

## 3. Matriz de entorno y preflight

Configurar secretos por ámbito en Vercel; no copiar `.env.local` ni descargar secretos productivos al equipo. Nunca registrar valores ni incluirlos en incidencias/commits. Variables comunes:

| Configuración | Preview | Production |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL testing sintético, pooled, `sslmode=verify-full` | PostgreSQL producción, pooled, `sslmode=verify-full` |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `ADMIN_USER_ID` | Auth y propietario de testing; secreto propio | Auth y propietario productivos; secreto propio |
| `STORAGE_ENVIRONMENT` | `testing` | `production` |
| Storage | `TEST_AWS_*`, `TEST_STORAGE_BUCKET`, `TEST_STORAGE_DATABASE_HOST` | `AWS_*`, `STORAGE_BUCKET`, `STORAGE_DATABASE_HOST` |
| `RELEASE_DATABASE_HOST` | Host PostgreSQL testing sin `-pooler` | Host PostgreSQL productivo sin `-pooler` |
| `RELEASE_AUTH_ORIGIN` | Origen HTTPS de Auth testing (sin path) | Origen HTTPS de Auth producción (sin path) |

Los bindings RELEASE_* son valores independientes que el propietario contrasta con las consolas, no valores calculados automáticamente a partir de una credencial. Un archivo coherente puede seguir apuntando al servicio equivocado: el preflight no demuestra pertenencia de una credencial ni aislamiento remoto. Comparar hosts, ramas, IDs de usuario, endpoints y alcance de credenciales entre los tres entornos; no reutilizar credenciales Storage de un ancestro productivo. Los secretos cookie deben ser distintos. Para obtener el ID productivo, usar `/auth/account`; hasta configurarlo exactamente, el admin deniega acceso.

`npm run release:check` valida **solo las variables del proceso**, sin cargar `.env.local`, conectarse ni escribir. Rechaza bindings ausentes/incoherentes, TLS distinto de verify-full, owner ausente fuera del modo de primer acceso, secret ausente, Storage incompatible, `ARCHIVE_TEST_SERVER` y variables `NEXT_PUBLIC_*` de aplicación. Se permite únicamente una lista explícita de metadatos públicos documentados que Vercel añade automáticamente a Next.js cuando `VERCEL=1`; no se permite cualquier nombre con prefijo `NEXT_PUBLIC_VERCEL_`. No requiere conexión directa de migración ni credenciales del proveedor de fútbol. No imprimir el entorno para diagnosticarlo.

### Primer acceso sin administrador configurado

Si aún no existe el ID productivo, el operador puede configurar temporalmente `RELEASE_BOOTSTRAP=1` **solo en Production** y dejar `ADMIN_USER_ID` sin definir. El preflight admite esta combinación explícita y conserva el resto de comprobaciones; rechaza bootstrap con cualquier ID no vacío, otros valores del flag o preview. El runtime sigue denegando todas las operaciones protegidas por ausencia de owner. No usar un ID provisional ni el de testing. Este modo permite obtener la identidad, no concede privilegios y no constituye aceptación final del release.

Antes del despliegue inicial autorizado, comprobar las migraciones y secretos del destino y que el commit con este soporte esté disponible para Vercel. Tras desplegar, confirmar la URL real, añadir su origen HTTPS exacto a los dominios de Neon Auth production y entrar con Google en `/auth/sign-in`. Abrir `/auth/account`, comprobar que es la cuenta del propietario y copiar su ID exacto; no inferirlo del email ni del primer usuario registrado. Después, en Vercel Production, eliminar `RELEASE_BOOTSTRAP`, añadir `ADMIN_USER_ID` con ese ID verificado y hacer un nuevo despliegue autorizado. Comprobar acceso del propietario y denegación a terceros. Un cambio de variables no modifica despliegues anteriores: no dar por habilitado el admin hasta verificar el nuevo despliegue. Los permisos sobre push, merge y despliegue se solicitan por separado cuando aún no están autorizados.

Tras autorización, configurar el Build Command del hosting como `npm run release:check && npm run build`. El build local/CI sigue independiente de secretos. `VERCEL_ENV` lo proporciona Vercel. No configurar `ARCHIVE_TEST_SERVER`. Las variables de mapa opcionales están en README; nunca contienen credenciales. No proporcionar `DATABASE_URL_UNPOOLED` ni acceso de migración al runtime si no se necesita. No ejecutar migraciones ni seed dentro del build.

## 4. Migración deliberada y recuperación

Este milestone no cambia el esquema. Revisar los SQL versionados 0000–0003 y su journal; la suite comprueba instalación limpia y actualización de escudos desde 0002. Antes del release, comprobar el estado real aplicado y acordar la ventana. Nunca ejecutar `db:seed`, schema push, reset ni SQL ad hoc contra producción.

Tras autorización explícita, el operador usa una conexión **directa** productiva en un proceso aislado para obtener copia consistente `pg_dump --format=custom --no-owner --no-acl --schema=public --schema=drizzle`, con credenciales suministradas de forma privada (p. ej. entorno PG*, nunca argumentos pegados en chat). Guardar checksum, fecha, commit y journal junto al backup cifrado. Exportar por separado todos los objetos referenciados y sus claves; conservarlos incluso tras limpieza de escudos. Pausar escrituras durante esa captura conjunta para evitar divergencia entre SQL y objetos. Auth requiere recuperación mediante el servicio gestionado; no adoptarlo/restaurarlo con Drizzle.

Aplicar únicamente las migraciones pendientes con el migrador Drizzle instalado, desde un proceso de release revisado y autorizado, sobre la conexión directa confirmada. Los scripts locales existentes rechazan producción y deben seguir haciéndolo; no falsificar development/testing para saltarse ese límite. Preparar el comando/proceso exacto y revisarlo con el propietario cuando existan los datos del entorno; este documento no lo ejecuta ni otorga permiso. Registrar migraciones/commit/resultado sin secretos.

Primera publicación: producción empieza vacía de fixtures sintéticos; las migraciones no hacen seed. El alta manual/importación/asistencias reales se acuerda con el propietario por separado; no copiar sus datos no productivos automáticamente.

Rollback: detener nuevas escrituras y revertir primero el código a una versión compatible conocida, conservando las migraciones aditivas y los objetos. Una reversión de Vercel no revierte SQL ni Storage. Si hace falta recuperar datos, restaurar el backup en un destino nuevo aislado autorizado, recuperar objetos bajo las mismas claves, comprobar filas, asistencias, slugs, import mappings/receipts y escudos, y verificar Auth/allowlist por separado antes de cambiar tráfico. Nunca restaurar encima del origen ni borrar tablas para revertir. Confirmar con el propietario la pérdida de cambios posteriores al backup antes de un cambio de destino.

## 5. Smoke de preview y producción

Realizar primero el flujo completo en preview sintético; registrar fecha, commit, URL, entorno, resultado y persona responsable. En producción solo lecturas hasta autorizar expresamente cualquier escritura real.

1. Sin sesión, abrir `/`, `/trips`, detalle conocido, `/stadiums`, detalle conocido y `/map` en escritorio/móvil; probar 404, archivo vacío inicial y navegación sin JavaScript. Desconocidos no se convierten en 0–0; fixtures sin asistencia no son públicos; visitas repetidas comparten estadio/marcador y conservan slugs.
2. Probar Google del propietario, recarga, cierre de sesión y usuario ajeno. `/auth/account` solo expone su propia identidad. Sin sesión/owner incorrecto, lecturas, acciones, import y subida/limpieza protegidos deben denegarse, también accediendo directamente. No cambiar el owner productivo para simular ataques; usar testing y la evidencia de la suite.
3. Solo en preview: crear/corregir fixture sintético, marcar/desmarcar asistencia, notas, repetición de estadio, coordenadas y escudo; recargar y comprobar persistencia. Repetir importación y comprobar idempotencia, locks y conservación de datos personales. Verificar que development y producción permanecen iguales; registrar comprobación de aislamiento sin volcar datos privados.
4. Bloquear acceso a OpenFootball/GitHub en el entorno de prueba: las lecturas públicas y el admin local siguen funcionando; falla únicamente la adquisición explícita. Un import fallido no muta el archivo. No se necesitan tokens/API keys de fútbol. Las pruebas del import cubren fallos sintéticos; no provocar caídas reales.
5. Bloquear tiles y `/media/crests/*` en el navegador: lista/historial y badge neutro conservan navegación. Probar móvil, teclado, selección pin/tarjeta y atribución visible. Sin precarga, proxy ni descargas masivas de OSM. No automatizar barridos contra tiles reales.
6. Revisar HTTPS, cookies Auth, ausencia de respuestas privadas cacheadas, secretos en HTML/bundles/logs y errores sin credenciales. Verificar que build no consulta PostgreSQL ni ejecuta migraciones. Revisar límites/consumo y errores del hosting sin publicar datos personales.
7. Tras autorización de publicación, repetir smoke público y Google/owner en la URL definitiva. No repetir escrituras reales como prueba sin autorización; registrar aceptación final y plan de rollback.

## 6. Evidencia y pendientes

La preparación local y los resultados se registran en README. Pendientes hasta intervención/autorización: inventario y coste de servicios, primer despliegue, configuración productiva/OAuth/dominio, backup real SQL+objetos y recuperación gestionada Auth, migración deliberada, smoke remoto y aceptación final. Milestone 6 permanece **en preparación** hasta resolverlos.

Fuentes oficiales revisadas el 2026-10-19: [entornos Vercel](https://vercel.com/docs/deployments/environments), [backup Neon](https://neon.com/docs/manage/backup-pg-dump), [checklist Auth](https://neon.com/docs/auth/production-checklist), [política OSM](https://operations.osmfoundation.org/policies/tiles/). Revalidar planes/límites/condiciones al autorizar provisioning; no hay garantía de coste por haber pasado las pruebas locales.

### Diagnóstico seguro del preflight en Vercel

El log identifica el bloque fallido con un código fijo (`DATABASE`, `AUTH`, `BOOTSTRAP`, `OWNER`, `COOKIE`, `TEST_SERVER`, `PUBLIC_VARIABLES`, `STORAGE` o `ENVIRONMENT`) y las variables que revisar, sin imprimir valores, nombres arbitrarios ni errores originales de parsers. Corregir ese bloque y crear un nuevo despliegue autorizado para aplicar las variables; no desactivar `release:check`. Un error genérico antiguo no permite determinar cuál de los bloques falló.

Los metadatos públicos permitidos corresponden a la [lista oficial de Vercel para Next.js](https://vercel.com/docs/environment-variables/framework-environment-variables), revisada el 2026-10-20. El preflight anterior rechazaba incluso esos metadatos legítimos; esta corrección conserva el rechazo de configuración pública no reconocida y todos los controles de aislamiento.
