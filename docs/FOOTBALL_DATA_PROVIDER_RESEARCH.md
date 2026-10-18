# 4b — Fuentes de fixtures con presupuesto de 0 €

Revisión: **18 de octubre de 2026**. Investigación reabierta por requisito del propietario: **0 € para obtener/importar fixtures**, también en actualizaciones ocasionales. **4b completado: recomendación aprobada por el propietario el 2026-10-18.** Sustituye la propuesta anterior de Sportmonks, conservada en el historial Git. No se han creado cuentas, contratado servicios, añadido credenciales ni importado datos. 4c sigue pendiente.

## Decisión aprobada

**Usar OpenFootball como fuente principal de archivos estáticos CC0 y completar las lagunas mediante 4a.** Preferir JSON cuando exista y esté comprobado; recurrir a sus archivos Football.TXT para ediciones no disponibles en JSON. CSV es una alternativa de formato, no un requisito ni una nueva fuente de derechos.

La combinación propuesta cuesta **0 € en adquisición de datos**, no necesita cuenta ni token y permite conservar los datos localmente. No promete el histórico completo desde 2017/18: esa campaña de Segunda B, playoffs y varios partidos de Copa requieren trabajo manual. El propietario ha admitido expresamente esta combinación de importación parcial y edición manual. El propietario aprueba esta fuente y acepta explícitamente sus lagunas, que se completarán mediante 4a. Esta decisión no autoriza comenzar 4c.

PostgreSQL permanece como única fuente de verdad para lecturas públicas y navegación administrativa. Las actualizaciones serían descargas puntuales revisadas por el propietario, nunca consultas externas en runtime, sincronización continua o un servicio necesario para publicar el archivo. La recomendación no depende de conseguir después una API de pago, una prueba temporal o una autorización comercial.

## Alcance y método

Necesidades de [PRODUCT](PRODUCT.md), [ARCHITECTURE](ARCHITECTURE.md) y [ROADMAP](ROADMAP.md): fechas, equipos y localía, competición/temporada, estado, resultados y estadio real del partido; liga, categorías inferiores históricas, Copa y ascensos desde **2017/18**, con actualizaciones ocasionales. La fecha, marcador o sede desconocidos permanecen nulos.

Se han consultado páginas oficiales de proveedores y repositorios de sus propios publicadores. «Oficial» para un dataset significa su repositorio de origen, no que esté respaldado por LaLiga o RFEF. También se leyeron archivos públicos en memoria para contar registros del Elche y revisar su estructura: **no se guardaron datasets en el proyecto ni se ejecutó un importador**. Los recuentos prueban presencia en esos archivos, no exactitud ni completitud frente a todos los partidos disputados.

## Comparación de alternativas gratuitas

| Fuente | Acceso, formato y límites | Cobertura y derechos relevantes | Decisión |
| --- | --- | --- | --- |
| **OpenFootball** [O1–O4] | Archivos JSON y Football.TXT descargables sin clave. Sin cuota comercial de llamadas; la descarga está sujeta a la disponibilidad y límites del alojamiento. | Datos publicados bajo CC0. Primera/Segunda y algunas Copas; historia y carencias comprobadas abajo. Las muestras no aportan sede ni un estado de partido explícito. | **Principal**, con cobertura parcial y corrección manual. |
| **footballcsv/espana** [C1] | CSV gratuito sin cuenta. Es una exportación de OpenFootball, no una fuente independiente. El árbol visible llega a 2020/21. | Declara CC0; columnas de jornada, fecha, equipos y resultado. No acredita actualización al día ni mejora las lagunas de origen. | Alternativa de formato; no basar las actualizaciones en este espejo. |
| **Football-Data.co.uk** [D1, D2] | Descargas CSV/Excel gratuitas; Primera y Segunda con amplio histórico, incluyendo 2017/18 en el índice español. | Su página limita el uso a particulares y señala fines de predicción de liga; no acredita permiso abierto para republicar un archivo público. No aporta Segunda B/Copa ni sedes en el esquema documentado. | No seleccionar sin permiso específico gratuito para este uso; no confundir descarga gratis con licencia abierta. |
| **API-Football Free** [A1–A3] | 100 solicitudes/día y 10/minuto; requiere cuenta y clave. Todas las competiciones/endpoints, con temporadas gratuitas limitadas. | No se acredita acceso gratuito a todo 2017/18–actualidad. Sus términos no conceden licencia de publicación y remiten las autorizaciones a titulares. | Descartada como base: poco volumen no elimina límites históricos ni de derechos. |
| **football-data.org Free** [F1–F3] | 0 €, diez llamadas/minuto, doce competiciones, requiere cuenta/clave. | Primera entre las gratuitas; no prueba el histórico completo requerido ni Segunda/Copa gratis. Atribución obligatoria; cláusula 9.1 impide seguir mostrando los datos tras cancelar la suscripción. | No recomendar para archivo permanente independiente del proveedor. |
| **Sportmonks Free** [S1] | Gratuito permanente para Superliga danesa y Premiership escocesa. | No cubre Elche en ese plan. Una prueba de un plan de pago no es una solución gratuita permanente para actualizarlo. | **Retirada la recomendación anterior** por presupuesto. |
| **RFEF, publicaciones oficiales** [R1–R4] | Noticias, tablas y PDF de horarios consultables gratis. | Hay evidencia histórica de Segunda B y ascensos de 2018. No se ha identificado una licencia abierta ni un paquete de fixtures reutilizable que cubra el alcance completo. Su aviso protege contenido audiovisual; eso no demuestra una licencia de datos. | Referencia para contrastar hechos al completar 4a; no aprobar extracción masiva/importación de sus tablas. |

No se propone scraping, eludir cuotas, cuentas múltiples ni convertir una prueba con tarjeta en fuente habitual. No se contactó con proveedores. Un CSV/JSON preparado por el propietario puede servir de entrada futura, pero el formato no cambia los permisos de los datos que contenga.

## Cobertura comprobada del candidato principal

Se contó la aparición del Elche en `matches`, o en líneas de partido para Football.TXT. En JSON se observó que tanto la raíz como `score` pueden cambiar de estructura entre ediciones; no debe asumirse un esquema uniforme. La tabla describe archivos concretos, **no valida un importador**.

| Temporada / fase | Archivo inspeccionado | Presencia y lagunas |
| --- | --- | --- |
| 2017/18 — Segunda B | `football.json/2017-18/es.2.json` | Cero registros del Elche: este archivo es de Segunda, no Segunda B. No sirve para la campaña del Elche. Liga y ascenso de esa temporada quedan manuales. |
| 2018/19 — Segunda | `football.json/2018-19/es.2.json` | 42 partidos del Elche con marcador final. |
| 2019/20 — Segunda | `football.json/2019-20/es.2.json`; contraste con `espana/2019-20/2-liga2.txt` | 42 partidos; el archivo de liga regular no cubre el playoff del Elche. Completar esa fase por separado mediante 4a. |
| 2020/21, 2021/22, 2022/23 — Primera | `football.json/<temporada>/es.1.json` | 38 partidos del Elche con resultado en cada edición. |
| 2023/24 — Segunda | `espana/2023-24/2-liga2.txt` | 42 líneas de partido del Elche. La ruta `football.json/2023-24/es.2.json` devuelve 404; no equivale a ausencia en el dataset fuente. |
| 2024/25 — Segunda | `football.json/2024-25/es.2.json` | 42 partidos, 41 con marcador final; Deportivo–Elche del 01/06/2025 tiene `score` vacío. Debe completarse manualmente, sin interpretar 0–0. |
| 2025/26 — Primera | `football.json/2025-26/es.1.json` | 38 registros del Elche; variaciones de estructura en `score`. No se certificó en esta investigación la completitud de sus resultados. |
| 2026/27 — Primera | `football.json/2026-27/es.1.json` | 38 fixtures del Elche; siete con resultado en la muestra consultada. Los demás no se deben tratar como partidos terminados. Actualización parcial. |
| Copa 2020/21–2024/25 | `espana/<temporada>/cup.txt` | Respectivamente 3, 4, 3, 3 y 4 líneas del Elche. Presencia comprobada, sin certificación exhaustiva de fechas/resultados ni de todas las rondas. |
| Copa 2017/18–2019/20 y desde 2025/26 | Sin muestra suficiente | Cobertura no acreditada; completar manualmente salvo futura evidencia de un archivo abierto concreto. |
| Primera Federación / otras categorías y Supercopa | Sin muestra suficiente | No inferir cobertura desde Primera/Segunda; revisar solo si son relevantes para el archivo. |

Para reproducir la consulta: repositorio JSON en revisión `e6744429ee395bc86f247348c6184bb08d4eb361`; Football.TXT en `80035a93dd4920985af52aa097a54a6fb888563b`. Rutas completas en [O3, O4]. Los enlaces a `master` cambian: una futura importación debe identificar la revisión/archivo utilizado. No se deducen estadios históricos de equipos ni se suman estos recuentos para declarar cobertura total.

## Derechos, calidad y complemento manual

La licencia CC0 publicada en ambos repositorios permite reutilizar, modificar, conservar y mostrar los datos sin depender de una suscripción. No exige atribución; conviene conservar autoría, URL, revisión y licencia como procedencia. CC0 no concede derechos sobre marcas, fotografías ni derechos ajenos, y el publicador excluye garantías [O2]. Se recomienda importar solo hechos de fixtures, sin escudos, texto editorial ni fotografías.

Las muestras de liga contienen fecha, nombres de equipos, jornada y resultados, con hora en algunos registros; no incluyen ID externo estable de partido, sede o estado explícito. El orden de equipos, las horas y las reglas de prórroga/tanda deben validarse por formato. El resultado local debe incluir prórroga y excluir tanda; la fecha pasada o un marcador presente no bastan por sí solos para asignar estado final sin comprobar la semántica del archivo. La falta de identificador estable será una condición importante para la reconciliación de 4c; no se debe fabricar una identidad permanente a partir de fecha y rival y asumir que nunca cambian.

Las publicaciones oficiales sirven para contrastes puntuales: RFEF documenta horarios y sede del Villarreal B–Elche de junio de 2018 [R2], su resultado en la crónica [R3] y horarios de liga de 2017/18 [R4]. Un horario publicado no demuestra que se disputara en esa fecha. Para completar 4a, registrar hechos comprobados y notas propias, sin copiar crónicas, fotografías o compilar sistemáticamente una base ajena. No se ha establecido que RFEF ofrezca una fuente abierta importable; cualquier reutilización masiva requeriría aclaración previa.

La carga manual prioritaria sería 2017/18, ascenso de 2020, Copas no acreditadas y sedes desconocidas de los viajes. Si un hecho no puede verificarse, permanece nulo. Que la edición manual sea posible no implica que todas las lagunas ya estén reconstruidas.

## Actualizaciones ocasionales y límite con 4c

Propuesta para una futura tarea autorizada: obtener un archivo abierto concreto al final de una temporada o cuando interese, revisar únicamente los fixtures del Elche y sus lagunas y aplicar cambios expresamente. Un archivo propio CSV/JSON con hechos introducidos por el propietario puede complementar las fuentes abiertas; se documentaría su procedencia. No se necesitan herramientas de pago ni disponibilidad continua de GitHub después de importar.

El propietario ha aprobado **OpenFootball + complemento manual, presupuesto 0 € y cobertura parcial explícita**, con PostgreSQL como única fuente de verdad tras importar, sin dependencia runtime de OpenFootball ni sincronización continua. **4c no se ha iniciado y requiere un encargo separado** para concretar: entradas estáticas admitidas, normalización, identidad/procedencia sin ID de proveedor y reconciliación con preview/apply. Aquí no se define un formato nuevo, no se escribe código y no se crea una migración. Attendance, notas personales, slugs y correcciones locales deben conservarse en cualquier futura importación.

Si una descarga desaparece o una licencia cambia para nuevos archivos, mantener lo ya obtenido bajo sus condiciones documentadas y completar manualmente. No sustituir automáticamente la fuente por una API comercial. No se exige resolver un permiso comercial pendiente para el camino recomendado CC0; las opciones con permisos sin acreditar quedan fuera.

## Fuentes primarias consultadas el 2026-10-18

- **O1:** [OpenFootball España — repositorio y alcance](https://github.com/openfootball/espana).
- **O2:** [Licencia CC0 de España](https://github.com/openfootball/espana/blob/master/LICENSE.md) y [licencia de football.json](https://github.com/openfootball/football.json/blob/master/LICENSE.md).
- **O3:** [Archivos JSON en la revisión consultada](https://github.com/openfootball/football.json/tree/e6744429ee395bc86f247348c6184bb08d4eb361). Rutas de ejemplo: [2019/20 Segunda](https://raw.githubusercontent.com/openfootball/football.json/e6744429ee395bc86f247348c6184bb08d4eb361/2019-20/es.2.json), [2024/25 Segunda](https://raw.githubusercontent.com/openfootball/football.json/e6744429ee395bc86f247348c6184bb08d4eb361/2024-25/es.2.json).
- **O4:** [Football.TXT en la revisión consultada](https://github.com/openfootball/espana/tree/80035a93dd4920985af52aa097a54a6fb888563b), [Segunda 2023/24](https://raw.githubusercontent.com/openfootball/espana/80035a93dd4920985af52aa097a54a6fb888563b/2023-24/2-liga2.txt) y [Copa 2024/25](https://raw.githubusercontent.com/openfootball/espana/80035a93dd4920985af52aa097a54a6fb888563b/2024-25/cup.txt).
- **C1:** [footballcsv/espana — formato, procedencia y licencia](https://github.com/footballcsv/espana).
- **D1:** [Football-Data.co.uk — descargas y restricciones de uso](https://football-data.co.uk/data.php).
- **D2:** [Índice español de CSV](https://football-data.co.uk/spainm.php) y [descripción de columnas](https://football-data.co.uk/notes.txt). El navegador no pudo abrir directamente el índice en esta revisión; su listado español aparece en el resultado oficial indexado. No se han certificado recuentos de sus archivos.
- **A1:** [API-Football — plan gratuito y temporadas limitadas](https://www.api-football.com/pricing).
- **A2:** [API-Football — frecuencia de solicitudes](https://www.api-football.com/news/post/how-ratelimit-works).
- **A3:** [API-Football — condiciones, Service & data](https://www.api-football.com/terms).
- **F1:** [football-data.org — plan gratuito](https://www.football-data.org/pricing).
- **F2:** [football-data.org — cobertura gratuita y de pago](https://www.football-data.org/coverage).
- **F3:** [football-data.org — atribución y cláusula 9.1](https://www.football-data.org/about).
- **S1:** [Sportmonks — alcance del plan gratuito permanente](https://www.sportmonks.com/football-api/how-football-api-works/).
- **R1:** [RFEF — aviso legal](https://rfef.es/es/aviso-legal).
- **R2:** [RFEF — horarios y sedes del ascenso de junio de 2018](https://rfef.es/es/noticias/horarios-fase-de-ascenso-primera-y-segunda-division).
- **R3:** [RFEF — crónica del ascenso del Elche, 23/06/2018](https://rfef.es/es/noticias/el-elche-cf-regresa-segunda-division-un-ano-despues).
- **R4:** [RFEF — PDF de horarios, Segunda B grupo III, jornada 32 de 2017/18](https://rfef.es/sites/default/files/images18/segunda_division_b_-_grupo_iii_-_jornada_32.pdf).
