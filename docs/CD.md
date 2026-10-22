# CD automático de producción

Estado: implementación versionada; pendiente de configuración y aceptación externa. No ejecutar el script en local ni copiar credenciales productivas a `.env.local`. `PRODUCTION_CD_ENABLED` debe permanecer ausente/false hasta completar el inventario inicial. La habilitación autoriza los releases normales sin aprobaciones individuales.

## Flujo y límites

`CI` correcta en push a `main` → `Production` → validación de SHA/destinos/Free → limpieza elegible → recovery Neon → ensayo de recuperación/migración en hija desechable → migración productiva → deployment Vercel → smoke → registro de éxito.

- `workflow_run` solo admite CI correcta de push a main en este repositorio. El script comprueba además el run mediante API y que el checkout coincide con `head_sha`. Un SHA obsoleto al empezar o ya publicado correctamente no se vuelve a publicar.
- Un solo workflow productivo concurrente, sin cancelar el activo; GitHub puede sustituir ejecuciones pendientes. No cancelar manualmente un release en curso. El migrador mantiene también un advisory lock PostgreSQL hasta terminar el release. La CI conserva su cancelación independiente.
- Los planes deben ser Neon Free (`free_v2`/`free_v3`) y Vercel Hobby; cualquier otro valor o dato desconocido bloquea. No se cambia de plan, cuotas ni facturación mediante código.
- Antes de crear recuperación y ensayo se reservan lógicamente dos plazas dentro de 10 ramas y se exige margen: consumo observado <90 CU-h y <4 GB de transferencia, y suma conservadora de tamaños lógicos más dos copias del origen <800 MB. La suma cuenta bytes compartidos varias veces y puede bloquear antes de agotar Free.
- Las métricas del proyecto tienen retraso y no son un contador de facturación. La API detallada de consumo no está disponible en Free. Estos checks no reservan capacidad; los límites duros del proveedor pueden rechazar una operación posterior. Ese rechazo detiene el flujo, nunca habilita pago. No se promete disponibilidad ilimitada a 0 €.
- GitHub Actions debe usar runners estándar y presupuesto que bloquee gasto adicional si el repositorio es privado. No se suben dumps, filas ni secretos como artifacts.

## Recuperación y retención

Se crea `recovery/<run-id>-<sha>` desde el ID productivo explícito, sin compute ni expiración automática. Se comprueba padre, estado ready y LSN. Una hija `rehearsal/...`, con compute de 0.25 CU y suspensión de 5 minutos, verifica el journal y ensaya las migraciones reales; consulta la tabla de asistencias sin mostrar filas y se elimina antes de migrar producción. Nunca se migra la recuperación original. No se conectan estas ramas a Preview, Auth UI ni aplicación pública.

El registro durable está en GitHub Deployments, entorno `production-cd`: payload con propietario de automatización, proyecto, padre, ID/nombre de recuperación y run; statuses in_progress/success/failure con auto_inactive desactivado. No borrar ese registro. El environment de secretos del job es `production`, distinto del nombre del registro.

Antes del siguiente release se eliminan únicamente ramas con ID registrado, padre/nombre coincidentes, sin hijos, de releases correctos y con al menos 24 horas. Se conservan siempre los dos puntos registrados más recientes. Fallidos, desconocidos y huérfanos se preservan; si agotan capacidad, se bloquean nuevos releases. Una interrupción puede dejar un ensayo o una recuperación sin registrar: requiere reconciliación de incidencia, nunca limpieza indiscriminada por prefijo. Si falla el ensayo se conserva también su rama para diagnóstico; su compute escala a cero.

Este es un punto de recuperación dentro del mismo proyecto, no un backup independiente frente a pérdida de cuenta/proyecto. No contiene un procedimiento automático de recuperación integral de OAuth, Auth y objetos. Restaurar datos o cambiar tráfico tras una incidencia requiere evaluar escrituras posteriores al punto y comprobar esos servicios separadamente.

## Migraciones y expand/contract

El runner no importa fixtures ni los scripts locales. Usa conexión directa verificada y Drizzle en una sesión dedicada: advisory lock, lock_timeout 5 s y statement_timeout 120 s. Compara todos los hashes y timestamps aplicados con el prefijo del journal versionado antes de DDL; rechaza historial modificado o adelantado. Drizzle aplica pendientes en transacción y verifica el journal al finalizar. Las sentencias que no admitan ese modo transaccional requieren rediseño; no desactivar las garantías automáticamente.

Cada nueva migración necesita entrada en `drizzle/release-policy.json`:

- `phase: expand`, con `compatibility` explicando por qué el código aún publicado sigue funcionando. Un detector conservador bloquea DROP/RENAME/DELETE FROM/ALTER COLUMN en esta fase.
- `phase: contract`, con `compatibility`, `compatibleDeploymentSha` de un release previo correcto y `backfillVerification` explicando evidencia y comprobaciones. El código que deja de usar la estructura antigua debe estar publicado antes del contrato. El backfill ha de completarse y verificarse antes de imponer restricciones o borrar columnas. Las comprobaciones semánticas siguen siendo parte de la revisión de SQL en PR; el detector no demuestra compatibilidad ni sustituye pruebas de actualización.

Nunca seed/reset/schema push, TRUNCATE, DROP DATABASE/SCHEMA ni migraciones del esquema gestionado neon_auth. Los cambios destructivos se separan entre releases mediante expand/contract. Los scripts locales siguen rechazando producción.

## Deploy, smoke e incidencias

`vercel.json` desactiva únicamente auto-deploy Git de `main`; Preview permanece en la integración Git. Actions es el único responsable de Production: usa la API REST versionada de Vercel con gitSource del SHA verificado. Es una petición explícita de deployment, independiente del disparador Git desactivado. El build remoto usa exclusivamente variables Production y `npm run release:check && npm run build`. No se reutiliza el build sintético de CI ni se ejecuta la migración en el build.

Se espera READY y se comprueba el SHA devuelto. El smoke comprueba HTTP/contenido español y rechaza la página de error, en `/`, `/trips`, `/stadiums`, `/map` y una ruta 404. Prueba la URL de deployment y la pública, cuyo alias debe resolver al mismo SHA; no sigue redirects ni envía credenciales a otros orígenes. El bypass opcional solo se envía al deployment Vercel, no al dominio público. Solo hay lecturas; no login, imports, escrituras ni descargas de tiles.

| Fallo | Comportamiento |
| --- | --- |
| Configuración, presupuesto o backup/ensayo | No migrar producción ni desplegar. |
| Migración productiva | No desplegar; conservar recuperación. La transacción fallida se aborta; no hay migración inversa. |
| Deploy/build o smoke | Marcar release fallido; conservar esquema y recuperación. Código anterior debe seguir siendo compatible. Smoke fallido puede ocurrir con código nuevo ya público. |
| API sin respuesta o timeout/cancelación | No reintentar mutaciones automáticamente; reconciliar el recurso remoto y el registro antes de volver a publicar. |
| Limpieza | Bloquear antes de nueva recuperación si no puede garantizarse limpieza/capacidad. |

Reejecutar el mismo SHA con registro fallido/incierto se bloquea. No marcarlo success para saltarse el control. Investigar API/DB/Vercel, corregir mediante un PR y nuevo SHA, o diseñar una recuperación específica de la incidencia. Una corrección normal compatible se publica automáticamente. No hay rollback SQL ni restauración automática; revertir código tampoco restaura SQL/Storage. Las incidencias pueden necesitar intervención, aunque el camino normal no tiene autorizaciones por release.

Un registro previo sin estado terminal bloquea también otros SHA: puede haber una operación remota todavía activa tras terminar el runner. El preflight comprueba además que no haya deployments productivos Vercel en curso. Tras reconciliar una incidencia, registrar failure/error real en el deployment de GitHub (nunca éxito ficticio); un nuevo SHA puede seguir el camino normal. No borrar las recuperaciones fallidas para desbloquear cuotas sin evaluar primero su utilidad.

## Configuración externa inicial (sin pegar secretos en chat)

1. **Neon:** confirmar proyecto productivo dedicado, rama productiva y base; plan Free, espacio para dos ramas adicionales, conexión directa y rol migrador propietario de tablas de aplicación/journal (sin gestionar neon_auth). El mismo usuario/contraseña heredado debe poder abrir la rama de ensayo. Crear una API key limitada al proyecto si la organización permite ese alcance; necesita leer proyecto/endpoints/branches y crear/eliminar ramas. No usar una clave de toda la cuenta si existe la alternativa. Mantener dev/test/preview en otros destinos.
2. **GitHub → Settings → Environments → New environment → `production`:** permitir únicamente `main` para deployment branches, sin required reviewers ni wait timer. Los registros `production-cd` los crea el script automáticamente; no poner allí secretos. Si las restricciones de environments no están disponibles en el plan, mantener la validación de procedencia del workflow y usar repository secrets exclusivos de este workflow; revisar visibilidad/protecciones antes de habilitar.
3. En los **secrets del environment `production`** guardar `NEON_API_KEY`, `PRODUCTION_DATABASE_URL_UNPOOLED` (URL completa directa con `sslmode=verify-full`) y `VERCEL_TOKEN`. Si Vercel protege URLs de deployment, añadir `VERCEL_AUTOMATION_BYPASS_SECRET`, generado desde Protection Bypass for Automation; no desactivar la protección para arreglar el smoke. Nunca añadir estos secretos a CI, .env.local o NEXT_PUBLIC_*.
4. En **variables del environment `production`** guardar `NEON_PROJECT_ID`, `NEON_PRODUCTION_BRANCH_ID`, `PRODUCTION_DATABASE_HOST` (hostname directo, sin protocolo/puerto/-pooler), `PRODUCTION_DATABASE_NAME`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`, `PRODUCTION_URL` (origen HTTPS canónico, sin barra final/path). Los IDs se copian desde las consolas, nunca se infieren por nombre. `GITHUB_TOKEN`, run IDs y SHA los suministra Actions.
5. **Vercel:** mantener Hobby; token con acceso de lectura de equipo/proyecto/deployments/aliases y creación de deployments en el equipo elegido, con menor alcance disponible. Confirmar integración GitHub con este repositorio, productionBranch main, Production Build Command exactamente `npm run release:check && npm run build`, Node 22 y variables Production verificadas según RELEASE.md. El dominio público debe ser un alias del mismo proyecto. Confirmar que el token puede leer `billing.plan` del equipo, sin ampliar a un plan de pago.
6. Retirar Deploy Hooks y otros workflows productivos. Integrar primero este PR con el CD aún deshabilitado: su `vercel.json` impide el deploy Git de main, pero conserva Preview. Comprobar ese bloqueo antes de activar Actions; no crear una publicación manual paralela.
7. Proteger main con PR/CI/Preview. Comprobar permisos Actions para `contents: read`, `actions: read`, `deployments: write`; no requiere PAT GitHub ni permisos contents:write. Asegurar presupuesto que bloquee gasto adicional de Actions y no utilizar runners grandes/de pago.
8. Solo tras completar lo anterior, crear **repository variable** `PRODUCTION_CD_ENABLED=true` en Settings → Secrets and variables → Actions → Variables. Debe ser de repositorio, porque la condición del job se evalúa antes de entrar al environment. Hasta entonces el job se omite sin acceder a producción. Para activar sobre un SHA ya comprobado, volver a ejecutar CI de main desde Actions; su conclusión correcta dispara Production. Una ejecución Production omitida no se habilita retroactivamente.
9. Verificar la primera ejecución: una sola publicación, recovery preservada, ensayo eliminado, hashes Drizzle correctos, deployment/public alias del SHA y smoke correcto. No considerar validada la integración externa hasta observar esta evidencia. El bootstrap del propietario, si todavía existe, debe completarse con el procedimiento de RELEASE antes de la aceptación final.

Fuentes: [Neon API](https://neon.com/docs/guides/branching-neon-api), [planes](https://neon.com/docs/introduction/plans), [métricas Free y limitaciones](https://api-docs.neon.tech/reference/getproject), [consumo detallado solo de pago](https://api-docs.neon.tech/reference/getconsumptionhistoryperprojectv2), [Git deployments Vercel](https://vercel.com/docs/project-configuration/git-configuration), [deployments REST](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).
