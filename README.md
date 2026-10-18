# Elche Away

**Donde tú vayas.** Archivo personal de viajes y estadios siguiendo al Elche CF. No es un producto oficial del club.

## Stack instalado

Next.js 16 (App Router), React 19, TypeScript 5 estricto, Tailwind CSS 4, PostgreSQL en Neon, Neon Auth con Google, Drizzle ORM y el driver `pg` (node-postgres). npm gestiona dependencias; ESLint comprueba código, `tsx` ejecuta scripts TypeScript y el runner de Node ejecuta pruebas. `package-lock.json` fija las versiones resueltas.

PostgreSQL es la única fuente persistente. Hay acceso con Google, edición privada de referencias y gestión local de partidos/asistencias e importación explícita desde OpenFootball con preview global y alternativa de archivo local; hay un mapa interactivo de estadios visitados; todavía no hay fotos. Los ejemplos son sintéticos: no representan resultados ni viajes reales. No hay datos JSON alternativos ni un fallback de demostración si falla PostgreSQL.

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
4. Reinicia el servidor y visita `/admin`. Solo la identidad configurada puede leer datos administrativos y ejecutar cambios.
5. Para comprobar el otro entorno, ejecuta `npm run dev:testing` y usa http://localhost:3001/auth/sign-in. El script fuerza la base, Auth URL, secreto e identidad de testing; no reutiliza valores de development. Copia el ID de `/auth/account` de ese entorno en `TEST_ADMIN_USER_ID` y reinicia ese servidor. Usa los hosts `localhost` indicados para las comprobaciones de cookies/OAuth. Abre testing en otro perfil de navegador o en una ventana de incógnito: las cookies se comparten entre puertos del mismo host y usar 3001 no las aísla por sí solo.

`npm run dev:testing` usa `.next-testing/`; puede convivir con development y con la suite automática. Se niega a arrancar si falta configuración aislada. No crees una contraseña local ni actives permisos de administrador en Neon para conceder acceso al archivo: los roles del servicio no sustituyen nuestra allowlist.

El proxy de sesión cubre `/admin` y `/auth/account`, donde completa el intercambio nativo del verificador de OAuth; cada lectura/acción vuelve a verificar la sesión con Neon (sin confiar en el snapshot de cookie cacheado) y compara el ID. Falta de configuración, sesión caducada/revocada, otra cuenta o error de Auth impiden operar. La aplicación no ofrece una pantalla de registro público ni concede acceso al primer usuario; las cuentas de Auth se gestionan en Neon. La pantalla de cuenta muestra únicamente el ID de su propia sesión, no datos de administración.

En las pestañas de referencias de `/admin` puedes crear, editar y eliminar clubes, estadios, competiciones, divisiones y temporadas. Despliega una referencia para editarla. Los slugs existentes se conservan al cambiar nombres. Eliminar requiere confirmación y falla si existen referencias dependientes; Elche CF nunca se puede eliminar. La importación explícita de archivos se abre en `/admin/import`; no hay fotos.

**Comprobación manual antes de integrar Milestone 3:** verifica en ambos entornos login real con Google, conservación de sesión tras recargar, acceso solo con el ID configurado y cierre de sesión. Si dispones de otra cuenta, confirma que puede autenticarse pero no administrar. Las pruebas automáticas cubren esos límites con sesiones sintéticas y el SDK real, pero no prueban el consentimiento real de Google.

Aceptación manual del Milestone 3 completada por el propietario el 2026-10-18 en development y testing: login con Google, acceso al admin, persistencia tras recargar y logout.

Neon gestiona sus tablas de Auth; no las migres con Drizzle ni las cargues con el seed. Para producción habrá que configurar OAuth/dominio propios posteriormente; no está configurada por este milestone.

## Partidos y asistencia (Milestone 4a)

`/admin` abre los partidos persistidos en PostgreSQL. Filtra por temporada/competición o pulsa **Añadir partido** para crear historia manualmente. Puedes dejar datos desconocidos; con designación conocida, asigna Elche exactamente a un lado. Sin designación, deja ambos clubes y goles vacíos y conserva el conocimiento parcial en anotaciones factuales. La división se consulta desde la temporada, separada de la competición. Los posibles duplicados requieren revisión y confirmación; no hay unicidad por fecha/rival.

**Corregir o eliminar partido** edita hechos y activa el bloqueo completo `facts_locked`, sin cambiar asistencia ni enlaces. **Marcar asistencia** permite añadir notas públicas y distinguir un partido especial. Guardarla publica inmediatamente el viaje; editarla conserva el slug. Desmarcar exige confirmación y elimina el registro personal, incluidas notas y enlace público, conservando el partido. Marcar de nuevo crea un registro personal nuevo con un slug generado con la información actual. Un partido con asistencia no puede eliminarse: desmarca primero y confirma después su eliminación.

Para probar manualmente en testing (`npm run dev:testing`), usa únicamente ejemplos sintéticos:

1. Comprueba filtros y añade un partido incompleto, sin inventar hechos históricos.
2. Marca asistencia con notas y distinción; abre el enlace público y comprueba viajes y visitas al estadio, incluidas visitas repetidas.
3. Corrige fecha/resultado/estadio y verifica que se conserva el enlace y los recuerdos. Un estado no finalizado muestra resultado desconocido.
4. Desmarca tras confirmar: el enlace devuelve 404 y el partido sigue en administración. Comprueba que el borrado de un partido asistido se rechaza y que un partido sin asistencia puede eliminarse tras confirmar.
5. Revisa formularios, foco y mensajes en móvil y escritorio. Una sesión ajena no debe poder leer ni modificar partidos.

Aceptación manual del submilestone 4a completada y confirmada por el propietario el 2026-10-18.

## Importación directa del histórico y actualizaciones (Milestone 4c)

El flujo principal está en **`/admin/import`**. Selecciona un rango de temporadas; el predeterminado empieza en **2017/18** y termina en la temporada actual (año de inicio calculado en Europe/Madrid, con cambio en julio). Tanto la carga inicial como las futuras actualizaciones comienzan con **Comprobar datos disponibles**, siempre por iniciativa del propietario. No necesitas buscar archivos, descargarlos ni introducir repositorio, ruta o revisión.

La comprobación accede sin cuenta ni token exclusivamente a `openfootball/football.json` y `openfootball/espana`. Resuelve `master` a un commit fijo por repositorio al inicio y consulta sus catálogos en esas revisiones. Para Primera/Segunda/Copa prioriza el JSON compatible y usa Football.TXT si no hay JSON catalogado. Solo conserva los registros cuyo equipo sea exactamente `Elche CF`. Las peticiones tienen límites de tamaño/tiempo y no siguen redirecciones. No se aceptan URLs o repositorios suministrados por el navegador.

Los errores de red, HTTP, límites de acceso, catálogos truncados o formatos no compatibles se muestran como errores, separados de la ausencia comprobada de un archivo. Un archivo sin Elche no prueba que no hubiera partidos. Segunda B/Primera Federación y playoffs permanecen expresamente sin cobertura acreditada; revisa esas lagunas, en especial 2017/18 y el ascenso de 2020, y complétalas con 4a. Si alguna obtención falla puedes revisar e importar el subconjunto disponible o volver a comprobar después; el error no se convierte en un resultado vacío.

### Revisar antes de escribir

La obtención y el **preview global** no escriben nada en PostgreSQL. Revisa:

- La cobertura de cada temporada/competición y los commits de ambos repositorios.
- Las referencias propuestas: se indica **SE CREARÁ** para cada club, temporada o competición nueva. Una coincidencia exacta única puede proponerse como existente; las ambiguas requieren elección. Los vínculos históricos exactos permiten conservar la identidad de clubes renombrados localmente. Si varias grafías del mismo club o competición apuntan a una referencia nueva propuesta, puedes asignarlas a esa misma referencia en el selector para crearla una sola vez. No se infieren divisiones ni estadios.
- Los partidos de todas las temporadas, agrupados en lotes. Se mantienen las cinco categorías: nuevo, sin cambios, actualización propuesta, corrección protegida y conflicto manual. Los nuevos sin candidatos se proponen como altas y requieren la confirmación global; los conflictos no se resuelven automáticamente por fecha/rival.
- Los conflictos: vincula al partido correcto, confirma que es otro partido u omítelo. **Marcar pendientes como nuevos** es una decisión explícita de altas, no un algoritmo de deduplicación; no la uses para ocultar dudas sobre candidatos reales. También puedes omitir los pendientes.

Después de cambiar referencias o destinos pulsa **Actualizar preview global**. Antes de aplicar deben quedar resueltas todas las referencias y decisiones de todos los lotes. La aplicación compara el estado local revisado: si cambió, detiene el lote y pide una comprobación nueva. Los campos ausentes conservan valores locales; las correcciones bloqueadas, asistencias, notas y slugs prevalecen.

### Confirmar, detener y reanudar

**Aplicar importación revisada** exige confirmar el preview global. La página inicia solicitudes sucesivas para lotes de hasta 40 partidos mientras permanece abierta. Cada lote incluye sus referencias necesarias, partidos, procedencia y recibo en una única transacción: todo o nada dentro de ese lote. La garantía no es una transacción global: un fallo detiene la continuación y conserva los lotes anteriores. Se muestra el resultado de cada uno.

Puedes pulsar **Detener después del lote en curso** y luego **Continuar lotes pendientes**. La revisión firmada se guarda en `sessionStorage` de esta pestaña/origen; tras recargar, **Recuperar revisión y progreso** consulta recibos sin aplicar datos ni consultar GitHub. Si se perdió la respuesta de un lote, su recibo impide repetir escrituras. La recuperación no continúa por sí sola: debes confirmarlo. Los recibos se guardan en `import_batches` solo al aplicar, nunca durante el preview.

La revisión caduca a los 30 minutos desde su última respuesta válida. Si caduca, se pierde el estado del navegador o cambian hechos/referencias locales, genera una comprobación nueva: los registros ya aceptados se reconocen por procedencia, y los nuevos/cambiados vuelven a revisión. No cambies manualmente las decisiones de una ejecución ya iniciada; solicita otra comprobación. Los recibos son progreso operativo, no estadísticas del archivo.

No hay cron, jobs ni consultas a OpenFootball al renderizar páginas. Al cerrar la página no se lanzan más lotes; un request ya iniciado puede completar su transacción. El presupuesto de datos es 0 € y no se añaden credenciales. Máximo 20 temporadas por comprobación, archivos de 350000 bytes/2000 registros y revisión firmada de tamaño acotado; si se supera, divide el rango. El catálogo compatible reconoce `es.1.json`, `es.2.json`, `es.cup.json`, `1-liga.txt`, `2-liga2.txt` y `cup.txt`; no atribuye cobertura a otros nombres sin adaptador.

### Probar la importación histórica completa en testing

1. Confirma en Neon que `TEST_DATABASE_URL` es la base **testing desechable** y distinta de development. No uses una copia con datos de producción. Conserva las variables existentes; no hace falta ningún token de GitHub.
2. Ejecuta con Node 22:

   ```sh
   nvm use
   npm run db:migrate:test
   npm run db:seed:test
   npm run dev:testing
   ```

3. En otro perfil/incógnito abre **http://localhost:3001/admin/import** y entra con el propietario de testing. Selecciona **2017/18 → temporada actual** y pulsa **Comprobar datos disponibles**. Marca la interpretación final de marcadores solo tras revisar los resultados del preview. Comprueba que se obtienen varias temporadas sin pedir archivos ni metadatos. No debe aparecer aún ningún partido nuevo en otra pestaña de `/admin`.
4. Revisa el informe de cobertura, especialmente Segunda B 2017/18, Copas ausentes y playoffs. Despliega lotes de distintas temporadas. Comprueba la lista completa de nuevas referencias y que no se asignan divisiones ni estadios.
5. Resuelve los candidatos. Las semillas de testing incluyen partidos inventados e incompletos: no los vincules a partidos históricos reales. Si has comprobado que solo existen esas semillas, puedes proponer los pendientes como nuevos para esta prueba. En datos personales reales revisa cada conflicto. Actualiza el preview global y confirma.
6. Comprueba progreso, recuentos y resultado de cada lote. Detén entre lotes; recarga, recupera el progreso y continúa explícitamente. No deben repetirse partidos ni referencias. Los partidos importados sin asistencia deben seguir fuera de viajes/estadios públicos.
7. Repite la comprobación del mismo rango: versiones iguales deben reconocerse sin altas duplicadas. Para probar futuras actualizaciones usa el mismo panel con otro rango, sin configurar nada más. Usa el ejemplo del modo avanzado para simular un cambio de resultado si OpenFootball no ha cambiado todavía.
8. Para comprobar una interrupción, corta la conexión del navegador después de confirmar un lote, recupera el estado y reanuda. Si un request alcanzó el servidor y se confirmó aunque no recibieras respuesta, debe reutilizar su recibo. Si estuvo completamente desconectado, vuelve a conectar antes de recuperar. Si GitHub limita o falla durante una comprobación, deben aparecer errores de obtención, nunca «sin cobertura» por ese fallo.
9. Marca asistencia de un partido de prueba, conserva su slug y notas, corrige sus hechos con 4a y comprueba otra vez: debe quedar protegido. Cambiar hechos locales mientras una importación está detenida debe impedir aplicar el siguiente lote con la revisión anterior, sin revertir los ya confirmados.

No ejecutes dos suites contra testing a la vez. Para volver a una base exclusivamente sintética tras esta QA utiliza otro entorno desechable y revisado; no hay reset ni borrado automático. La migración `0002_panoramic_darkhawk.sql` añade recibos sin modificar datos existentes. No se han migrado development ni producción.

## Modo avanzado: importar o reimportar un archivo local (4c)

No requiere cuenta, credenciales ni suscripción de fútbol. Obtén manualmente un JSON o Football.TXT del repositorio OpenFootball y conserva su ruta y revisión Git completa. Este modo no acepta URLs ni verifica que el archivo local corresponda a la revisión declarada; la obtención directa anterior sí fija y descarga la revisión automáticamente. No uses datos de fuentes con permisos sin acreditar. El archivo se procesa como entrada, nunca como persistencia alternativa.

En `/admin/import` selecciona archivo, formato, procedencia, nombre exacto del Elche, temporada y competición locales. Confirma la interpretación de resultados únicamente si has comprobado que los marcadores representan goles finales jugados con prórroga y sin tanda; en caso contrario el estado será desconocido. Los datos ausentes nunca borran valores conocidos.

1. **Leer archivo sin guardar**: muestra los nombres a asignar a clubes locales. No crea referencias automáticamente; crea previamente las que falten desde `/admin`. Máximo 350000 bytes y 2000 registros por archivo.
2. **Generar preview**: procesa hasta 40 partidos del Elche a partir del desplazamiento elegido. Distingue nuevos, coincidencias sin cambios, actualizaciones propuestas, correcciones protegidas y conflictos manuales. Revisa origen, destino y diferencias. La lista de candidatos incluye partidos de la temporada y aquellos sin temporada conocida.
3. Para cada versión sin vínculo reconocido elige **vincular**, **confirmar nuevo** u **omitir**, y pulsa **Actualizar preview**. Las coincidencias por fecha/rival son sugerencias, nunca identidad permanente. Revisa también candidatos incompletos para evitar duplicados.
4. Confirma y pulsa **Aplicar lote revisado**. Solo aplica el último preview generado; cambiar decisiones exige regenerarlo. Caduca a los 30 minutos y cualquier cambio relevante en PostgreSQL obliga a revisarlo de nuevo. El lote se aplica íntegramente o se revierte: no queda una mitad escrita si falla.
5. Para continuar, vuelve a cargar el archivo con desplazamiento 40, 80… según el intervalo mostrado. Para actualizar una temporada o añadir otra futura usa exactamente el mismo flujo. Las versiones reconocidas conservan su vínculo; una versión modificada requiere confirmar el destino. Si falla o pierdes la respuesta, vuelve a generar el preview: los vínculos persistidos evitan repetir altas ya aceptadas.

La huella representa una versión normalizada del registro, no la identidad del partido. Repositorio, ruta, revisiones aceptadas y huella quedan en `match_sources`; se conserva la historia de vínculos. Las asistencias, notas, distinción y slugs no se alteran. Un partido bloqueado conserva todos sus hechos aunque lo vincules: solo se añade procedencia. Corrígelo con 4a si procede. Los partidos con procedencia importada no se pueden eliminar desde 4a; no hay borrado de vínculos en esta entrega.

Formatos no reconocidos fallan con un mensaje; no se garantiza interpretar cualquier variante de OpenFootball. Para esos casos usa una variante compatible revisada o completa la laguna manualmente. Las sedes, campos desconocidos, partidos omitidos y huecos históricos se completan con 4a; un archivo incompleto no borra partidos existentes.

### Prueba manual sin afectar a producción

Usa exclusivamente las conexiones de development/testing ya configuradas. Comprueba en tu consola Neon que `TEST_DATABASE_URL` pertenece a **testing desechable** y que es distinta de development; no pegues ni imprimas las credenciales. Los comandos siguientes migran/siembran únicamente testing:

```sh
nvm use
npm run db:migrate:test
npm run db:seed:test
npm run dev:testing
```

Abre **http://localhost:3001/admin/import** en otro perfil/incógnito, inicia sesión con el propietario de testing y usa [el archivo sintético de QA](docs/examples/openfootball-synthetic.json). No contiene partidos reales. Para esta prueba, declara repositorio `openfootball/football.json`, ruta `2030-31/synthetic.json` y revisión sintética `0000000000000000000000000000000000000000`; son metadatos de prueba, no una revisión real de OpenFootball. Selecciona temporada **2030/31 (ejemplo)** y **Liga de ejemplo**, desplazamiento 0 y confirma los marcadores sintéticos.

- Asigna los tres nombres a los clubes sintéticos existentes. Genera el preview: revisa los candidatos. Vincula el Norte–Elche al partido sintético del 01/02/2030 y confirma el Elche–Sur del 10/10/2030 como nuevo. Actualiza el preview: el primero debe quedar protegido y el segundo nuevo. Comprueba que aún no se han guardado cambios; confirma y aplica.
- Repite el archivo: ambos vínculos se reconocen, el nuevo aparece sin cambios y el antiguo sigue protegido. No aparece ninguna asistencia nueva ni viaje público para el partido importado.
- En una copia local del JSON cambia la fecha y el resultado del segundo registro, y usa otra revisión sintética de 40 caracteres hexadecimales. Genera el preview, confirma su vínculo al mismo partido del 10/10/2030 y actualízalo: debe mostrar una actualización propuesta. Aplica y comprueba que conserva su UUID. No confirmes crear otro partido.
- Para ese partido, marca asistencia en `/admin`, añade notas y distinción y guarda su enlace. Reimporta una versión con datos cambiados: sin editar hechos locales todavía, debe proponer actualizarlos conservando el enlace y recuerdos. Después corrige sus hechos con 4a y repite: debe quedar protegido y conservar todos esos hechos.
- En otra copia elimina `date` y `score` del segundo registro. Vincúlalo al mismo partido; no debe proponer borrar fecha/marcador conocidos. Un campo desconocido no debe convertirse en 0–0.
- Genera un preview, edita un partido candidato en otra pestaña y trata de aplicar el preview anterior: debe rechazarlo sin guardar el lote. Revisa también que una cuenta ajena no pueda abrir la importación ni operar.
- Revisa en móvil/escritorio los cinco estados, foco, nombres de candidatos, diferencias y mensajes. Para temporadas futuras crea referencias sintéticas distintas y repite el flujo. Conserva testing como entorno de QA; no uses este ejemplo en datos reales.

La migración nueva es aditiva; se probó sobre testing existente. No hay migraciones automáticas en requests/build ni cambios en `neon_auth`. No se ha migrado development o producción. Para preparar development posteriormente, verifica su destino no productivo antes de ejecutar `npm run db:migrate`.

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
| `/` | Resumen de viajes, estadios conocidos y victorias/empates/derrotas, derivado de asistencias en PostgreSQL en cada petición, con cobertura de resultados y estadios. |
| `/trips` | Cronología de asistencias, con fechas desconocidas al final. |
| `/trips/[slug]` | Partido, temporada/división, competición, estadio y recuerdos del viaje. |
| `/stadiums` | Solo estadios con visitas registradas, con número de visitas. |
| `/stadiums/[slug]` | Información y viajes asociados al estadio visitado. |
| `/map` | Mapa Leaflet de estadios visitados, cobertura de coordenadas y lista alternativa. |
| `/auth/sign-in` | Acceso con Google. |
| `/auth/account` | Sesión propia, identificador para configurar la allowlist y cierre de sesión. |
| `/admin` | Partidos locales, filtros por temporada/competición, asistencia y referencias; requiere identidad configurada. |
| `/admin/import` | Obtención directa por rango, preview global, referencias propuestas y lotes reanudables; archivo local avanzado. Solo propietario. |

Abre los detalles desde los enlaces de las listas: `[slug]` es un parámetro, no una URL literal. El seed ofrece `/stadiums/estadio-del-corcho-ejemplo` y un viaje de información incompleta en `/trips/viaje`. Los nombres/fechas corregidos no regeneran slugs. Un estadio no visitado o un viaje inexistente no es público; muestra 404.

Si la base está vacía, las listas muestran estados vacíos. Si falta configuración, la base no está migrada o PostgreSQL falla, se muestra un error genérico con opción de reintentar: no se inventan datos ni se presentan fallos como un archivo vacío.

## Scripts y pruebas

| Comando | Función |
| --- | --- |
| `npm run dev` | Desarrollo con recarga automática en development. |
| `npm run dev:testing` | QA manual con la base/Auth/identidad de testing en localhost:3001. |
| `npm run lint` | ESLint, incluidas advertencias como errores. |
| `npm run typecheck` | Tipos de rutas Next.js y TypeScript sin emitir código. |
| `npm test` | Crea una base temporal en el servidor de testing, migra/siembra y ejecuta integración PostgreSQL y HTTP; elimina solo esa base al finalizar. |
| `npm run build` | Compilación de producción; no ejecuta migraciones ni consulta la base. |
| `npm start` | Sirve el build local; necesita configuración de base para consultar el archivo. |
| `npm run db:generate` | Genera migración SQL/snapshot Drizzle sin conectarse a una base. |
| `npm run db:migrate` / `npm run db:seed` | Migra / carga ejemplos en development. |
| `npm run db:migrate:test` / `npm run db:seed:test` | Migra / carga ejemplos en testing. |

`npm test` valida que development y testing sean distintos y crea una base nueva con nombre aleatorio `elche_away_test_<uuid>` en el servidor de `TEST_DATABASE_URL`. Requiere permiso PostgreSQL `CREATEDB` en ese servidor (también en CI). Aplica las migraciones reales sin transformarlas, carga el seed y pasa la conexión temporal a toda la suite, incluido el servidor HTTP. No migra, siembra, vacía ni borra la base configurada en `TEST_DATABASE_URL`; sus datos previos no intervienen. Los tests SQL conservan sus transacciones/savepoints con rollback. Al terminar, incluso con pruebas fallidas o SIGINT/SIGTERM, el runner cierra conexiones y elimina exclusivamente la base cuya creación ha confirmado en esa ejecución. No reutiliza ni elimina bases preexistentes. Ante un cierre forzado del proceso (SIGKILL), fallo de red o falta de permisos de limpieza, puede quedar una base temporal: el runner imprime su nombre al crearla; elimina manualmente solo ese nombre en el servidor de testing, nunca las bases configuradas. Si no puede crear la base, falla sin ejecutar las pruebas contra los datos del propietario.

El servidor HTTP de pruebas usa un puerto libre y su propia salida `.next-test/`, sin reutilizar el servidor ni las credenciales de desarrollo. Para Auth levanta un upstream de loopback con sesiones sintéticas; ejercita el SDK, middleware y Server Actions reales sin tocar usuarios de Google/Neon Auth. Ningún bypass de login está disponible en la aplicación. Ejecuta una sola suite a la vez para no compartir la salida `.next-test/`. La variable interna `ARCHIVE_TEST_SERVER` se configura automáticamente en las pruebas y en `dev:testing`; no la añadas a `.env.local`.

En este entorno, Turbopack falló al compilar `src/app/globals.css` al crear un proceso que necesitaba abrir un puerto (`Operation not permitted`, error 1). Si aparece esa restricción, verifica el build con `npm run build -- --webpack`: es el bundler alternativo oficial incluido en Next.js. Mantiene el build de producción, comprobación de tipos y generación de rutas; no cambia la arquitectura ni el comando predeterminado. Usa la versión de Node indicada por `.nvmrc` (`nvm use`); Node 20 no satisface los requisitos del proyecto.

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

Milestones 1–4d completados y aceptados por el propietario. **4c aceptado el 2026-10-18 e integrado en main con el tag `milestone-4c`.** OpenFootball es la fuente principal aprobada, con presupuesto de datos de 0 €, cobertura parcial y complemento manual mediante 4a. PostgreSQL sigue siendo la única fuente de verdad después de importar; no hay consultas runtime al proveedor ni sincronización continua. **4d completado: aceptación manual y verificaciones confirmadas por el propietario el 2026-10-18, integrado en main con el tag `milestone-4d`.** El Milestone 5 está implementado en su rama; sigue pendiente de aceptación manual.

Este README se actualiza cuando cambia la forma de instalar, configurar, ejecutar o desarrollar el proyecto.

## Aceptación manual de 4d

En desarrollo o testing (nunca producción), abre `/` en móvil y escritorio y contrasta el resumen con `/trips` y `/stadiums`. Con el seed sintético sin modificaciones, deben aparecer 5 viajes, 2 estadios, 1 victoria, 1 empate y 0 derrotas; cobertura de resultados 2/5 y de estadios 4/5.

Desde `/admin`, marca y desmarca una asistencia y recarga el inicio: los totales deben reflejarla sin borrar el partido. Dos visitas al mismo estadio cuentan como dos viajes y un estadio. Un viaje sin estadio cuenta solo en viajes. Comprueba un resultado finalizado como local y como visitante; un 0–0 finalizado es empate. Cambia el estado a programado, aplazado, cancelado, abandonado o desconocido: el marcador deja de contribuir. Un finalizado sin marcador tampoco aporta resultado. Las tandas no cambian el empate de los goles jugados. Sin asistencias deben mostrarse ceros y el mensaje de archivo vacío. Restaura los datos de prueba al terminar.

Verificación de la rama 4d (2026-10-18): Node 22.23.3; lint y typecheck correctos; dos ejecuciones consecutivas de `npm test` con 53/53 pruebas, sin omisiones y con limpieza de sus bases temporales; build de producción correcto mediante `npm run build -- --webpack`. Las huellas de las nueve tablas existentes de testing permanecieron idénticas. El comportamiento funcional aceptado no se modificó.

## Mapa (Milestone 5)

Leaflet con tiles estándar de OpenStreetMap aprobado por el propietario el 2026-10-18, coste 0 €, sin SLA. Consulta la decisión y [política de tiles](https://operations.osmfoundation.org/policies/tiles/) en [ARCHITECTURE](docs/ARCHITECTURE.md#map-comparison-and-recommendation). Atribución siempre visible; caché y Referer del navegador; sin precarga, descargas masivas ni modo offline. El mapa se carga directamente al entrar, con un encuadre fijo de la España peninsular independiente de los estadios. Un carrusel superpuesto conecta tarjetas y pines.

Configuración opcional del servidor (pública, sin secretos), leída en cada petición:

| Variable | Valor predeterminado |
| --- | --- |
| `MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `MAP_TILE_ATTRIBUTION_TEXT` | `OpenStreetMap contributors` |
| `MAP_TILE_ATTRIBUTION_URL` | `https://www.openstreetmap.org/copyright` |
| `MAP_TILE_MAX_ZOOM` | `19` (entero entre 1 y 19) |

La URL de tiles debe usar HTTPS y contener `{z}`, `{x}`, `{y}`. La atribución debe enlazar a HTTPS. Configuración inválida desactiva el mapa y conserva la lista. Para cambiar proveedor, revisar condiciones/coste y configurar URL, atribución y zoom sin cambiar el componente. Reiniciar el servidor local tras editar `.env.local`.

### Aceptación manual en escritorio y móvil

1. Ejecutar `npm run dev` con las conexiones de desarrollo no productivas habituales; abrir `/map` en escritorio y móvil (o viewport de 390 px).
2. En `/admin`, editar estadios: indicar ambas coordenadas reales conocidas, guardar y recargar `/map`. No inventar coordenadas históricas; se pueden usar referencias sintéticas en un entorno aislado. Dejar otro estadio visitado sin coordenadas. Comprobar cobertura y su entrada «Sin coordenadas».
3. Al entrar debe verse el mapa grande encuadrando toda la península, incluso con un solo estadio o ninguno con coordenadas. Un marcador por estadio aunque tenga varias asistencias; no aparecen estadios sin asistencias. Las islas se exploran desplazando el mapa o eligiendo su tarjeta.
4. En escritorio, pulsar una tarjeta: debe acercarse suavemente a su estadio, abrir información y marcar su tarjeta. Pulsar otro pin: debe seleccionar y llevar su tarjeta a la vista sin desplazar la página. Comprobar nombre, localidad, visitas y enlace «Ver historial del estadio». Probar Tab, Enter, zoom y foco visible. En móvil (390 px y dispositivo real), recorrer horizontalmente las tarjetas sin arrastrar el mapa, pulsar tarjeta y pin, ampliar con dos dedos, girar orientación y usar «Pausar interacción» para desplazar la página. La rueda de escritorio desplaza la página. No debe haber desbordamiento horizontal de la página; la atribución no queda cubierta. Con movimiento reducido, los cambios de selección no deben animarse.
5. Bloquear `*tile.openstreetmap.org*` en las herramientas de red y recargar `/map`: debe aparecer el aviso de fallo y los enlaces de tarjetas y lista deben seguir funcionando. Quitar el bloqueo y recargar para reintentar. No ejecutar barridos automatizados de tiles reales.
6. Desactivar JavaScript y recargar: lista, cobertura y enlaces siguen disponibles. En red, comprobar HTTPS y Referer en los tiles; sin JavaScript no se solicitan tiles. La atribución permanece visible en la esquina superior derecha del mapa a cualquier zoom, fuera del carrusel.
7. Borrar ambas coordenadas y guardar; recargar y comprobar que desaparece solo el marcador. Probar coordenada incompleta o fuera de rango: rechazo del servidor. Con usuario ajeno o sin sesión no se puede editar. Si no hay estadios visitados se muestra el estado vacío.

La aceptación visual/táctil y el fallo real de tiles requieren estas comprobaciones del propietario; las pruebas HTTP no descargan tiles. No hay cambios de esquema ni migraciones en este milestone.

Verificación de la rama 5 (2026-10-18): Node 22.23.3 / npm 10.9.9; `npm run lint`, `npm run typecheck` y `npm test` correctos (55/55, sin omisiones; base temporal eliminada). `npm run build` con Turbopack falló por permisos al abrir un puerto local durante el procesamiento CSS; `npm run build -- --webpack` pasó. Aceptación manual pendiente.

Refinamiento de experiencia de la rama 5: encuadre fijo peninsular, mapa inmediato y carrusel sincronizado. Suite ampliada a 56/56 pruebas; comprobación adicional con Chrome headless en escritorio y a 390/320 px, bloqueando tiles de OSM, sin errores JavaScript ni desbordamiento horizontal. La selección tarjeta → pin y pin → tarjeta funciona sin desplazar la página. La aceptación táctil en un dispositivo real y la cartografía visible siguen pendientes del propietario.
