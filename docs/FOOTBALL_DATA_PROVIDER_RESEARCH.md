# 4b — Investigación y recomendación de proveedor de fútbol

Fecha de consulta: **18 de octubre de 2026**. Estado: investigación terminada; **proveedor pendiente de aprobación del propietario**. No hay contratación, cuenta, credenciales, llamadas autenticadas, integración ni cambios de esquema. 4c no está autorizado por este documento.

## Decisión propuesta

**Recomendar Sportmonks como candidato preferente, con condiciones previas a 4c.** Su permiso explícito de almacenamiento y uso de los datos en un producto encaja mejor con un archivo público persistido en PostgreSQL que las otras opciones estudiadas. Su mayor coste frente a API-Football se justifica por ese encaje documental, no por necesitar estadísticas o datos en directo.

**No hay todavía un proveedor acreditado para todos los requisitos.** Antes de aprobar la importación deben quedar resueltas por escrito la conservación/publicación tras cancelar o cambiar de proveedor y la cobertura por temporada, especialmente Segunda B y ascensos de 2018. Aprobar este candidato de forma condicionada no equivale a aprobar 4c, una suscripción o una reducción de alcance.

Alternativas: API-Football es el segundo candidato técnico y más barato, pero no resuelve los derechos de publicación; football-data.org no encaja con la independencia permanente del archivo tras una baja. Si Sportmonks no satisface las condiciones, corresponde volver al propietario con las carencias y decidir explícitamente otro proveedor o un alcance de importación reducido. Los flujos manuales de 4a siguen utilizables; no se declara por ello una versión final exclusivamente manual.

## Necesidades y método

Alcance tomado de [PRODUCT](PRODUCT.md), [ARCHITECTURE](ARCHITECTURE.md) y [ROADMAP](ROADMAP.md): partidos del Elche desde aproximadamente 2018, de local y visitante; Primera, Segunda, Primera Federación y categorías históricas equivalentes, Copa del Rey y playoffs. Incluir **2017/18** permite evaluar los partidos de la primera mitad de 2018; una búsqueda que empiece en la temporada 2018/19 puede perderlos.

Se comparan tres APIs con documentación pública oficial, planes accesibles y capacidad de consulta histórica. La evaluación distingue catálogo anunciado, estructura técnica y cobertura histórica realmente demostrada. No se han probado respuestas con credenciales ni se ha contactado con empresas. Las páginas comerciales no prueban que todos los partidos/campos de todas las temporadas estén disponibles. Precios publicados orientativos, sin conversión de moneda ni compromiso de compra; deben revalidarse antes de contratar.

## Cobertura e historia

| Necesidad | Sportmonks | API-Football / API-Sports | football-data.org |
| --- | --- | --- | --- |
| Primera y Segunda | Anunciadas en páginas específicas [S1, S2]. | Ambas en catálogo [A1]. | Ambas en catálogo; Primera figura en gratuito [F1]. |
| Copa del Rey y Supercopa | Anunciadas [S1]. | Ambas en catálogo [A1]. | Ambas en catálogo [F1]. |
| Primera Federación | Anunciada [S1]; faltan grupos/ediciones exactos. | Catálogo con grupos RFEF y playoffs [A1]. | No aparece en el catálogo consultado [F1]. |
| Antigua Segunda B, 2017/18 y 2018 | Sin demostración pública suficiente para esa edición concreta. | Los nombres actuales RFEF del catálogo no demuestran cobertura de Segunda B de 2017/18. | No aparece Segunda B en el catálogo consultado. |
| Playoffs de ascenso | El modelo tiene fases/eliminatorias [S5]; falta verificar las ediciones españolas requeridas y si consumen otra competición contratada. | Hay playoffs RFEF anunciados; falta comprobar ascenso de Segunda y Segunda B por edición. | Lista «La Liga Play-Offs»; no demuestra ascenso desde Segunda B [F1]. |
| Historia desde 2018 | Anuncio general desde 2005/06 [S6], sin garantía uniforme por liga/campo; archivo antiguo requiere complemento [S3]. | Temporadas disponibles se descubren por competición [A3]; no se acredita aquí cada edición desde 2017/18. | ML Pack Light anuncia diez temporadas, sin demostrar todas las competiciones necesarias [F2]. |

**Conclusión de cobertura:** ninguno puede marcarse como completo con la evidencia obtenida. Primera Federación actual no prueba la antigua Segunda B. Copa y playoffs deben comprobarse además de la liga regular. Un catálogo no permite asignar a Elche una categoría en una temporada ni inferir que una lista vacía significa que no jugó.

## Datos del partido y adecuación al dominio

- **Sportmonks:** el esquema de partido contiene identificador, temporada, competición, fase, fecha y estado; admite fecha y recinto nulos y relaciones de participantes, resultados y recinto [S4]. La localía procede de los metadatos del participante [S7]. Permite representar lo necesario, aunque no certifica la exactitud histórica del estadio.
- **API-Football:** documenta fechas, estado, equipos local/visitante, recinto y desglose de resultados, incluida prórroga y penaltis; permite consultar una temporada/competición [A3]. La presencia de estos campos no acredita su completitud histórica.
- **football-data.org:** anuncia fixtures y resultados [F2]; al quedar descartado por condiciones de baja, no se profundiza en su correspondencia de recintos históricos.

En una futura evaluación de muestras deben comprobarse el recinto real del partido (incluidas sedes neutrales y cambios de campo), fecha/zona horaria, ambos equipos y resultado tras prórroga sin sumar tanda. Nunca sustituir un estadio desconocido por el campo actual del local ni un resultado nulo por 0–0. Importar un partido no crea asistencia. Identificadores y slugs locales, correcciones bloqueadas y metadatos personales permanecen independientes del proveedor. Son criterios para la selección; aquí no se diseña ni implementa el importador.

## Coste y límites

| Proveedor | Plan de referencia publicado | Límites y efecto para este archivo |
| --- | --- | --- |
| Sportmonks [S3] | Starter: 29 €/mes, cinco competiciones elegibles; archivo de más de tres temporadas desde 29 € de pago único. | 2.000 solicitudes por entidad y hora. Presupuesto inicial mínimo orientativo: 58 € antes de IVA, condicionado a qué archivo/competiciones cubra el complemento. No es un presupuesto cerrado. Grupos o playoffs separados pueden superar cinco competiciones. |
| API-Football [A2, A4] | Free: 0 USD; Pro: 19 USD/mes. | Free: 100/día y 10/minuto; Pro: 7.500/día y 300/minuto (5/segundo). Gratis limita temporadas; no sirve como promesa de historia desde 2018. |
| football-data.org [F2] | Free: 0 €; Standard: 49 €/mes; ML Pack Light: 29 €/mes. | Respectivamente 10, 60 y 20 solicitudes/minuto. ML anuncia diez temporadas, pero sus doce competiciones no equivalen a todo el alcance español. IVA puede aplicar. |

Las cuotas publicadas parecen suficientes para importaciones ocasionales de un club: es una estimación de uso, no un benchmark. El consumo dependerá de páginas, intervalos, referencias y reintentos; no debe presupuestarse una llamada por partido ni prometer una carga completa en un día. No se necesitan livescores, estadísticas avanzadas ni planes superiores por volumen. Para Sportmonks se toma el límite del plan comercial actual, sin generalizar ejemplos de documentación con otros límites. Su prueba de pago exige tarjeta y puede convertirse en cobro [S8]; no se ha activado.

## Persistencia, publicación y salida

| Proveedor | Evidencia oficial | Consecuencia |
| --- | --- | --- |
| Sportmonks [S8, S9] | Permite guardar, transferir y distribuir datos dentro del producto y mostrarlos a usuarios; revender el feed requiere aprobación. Precios por dominio. | Mejor encaje inicial. No queda expresamente resuelta la supervivencia indefinida de esos permisos tras baja/cambio de proveedor. Confirmar también dominio público y entornos de desarrollo/prueba. |
| API-Football [A5] | Permite construir webs y prohíbe reventa directa; declara que no concede licencia de uso/publicación y remite las autorizaciones a los titulares correspondientes. | La suscripción técnica no basta para aprobar el archivo público. No se ha acreditado permiso expreso de conservación y publicación tras baja. |
| football-data.org [F3] | Exige atribución visible y su cláusula 9.1 impide mostrar en el sitio los datos obtenidos al cancelar. | Descartado para un archivo que debe continuar público al abandonar el proveedor, salvo acuerdo distinto expreso. |

Esta es una lectura de las condiciones publicadas para seleccionar proveedor, no una afirmación de que todos los hechos futbolísticos requieran licencia. No se presume que el carácter personal o gratuito del proyecto resuelva las restricciones. Ninguna recomendación incluye licencias de escudos/fotos; esos activos quedan fuera del alcance de importación.

## Condiciones pendientes para la decisión del propietario

Propuesta de decisión: **aprobar o rechazar Sportmonks como candidato condicionado**, manteniendo 4c pendiente. Para una aprobación definitiva se necesita:

1. Confirmación escrita aplicable al plan de que se pueden conservar hechos importados en PostgreSQL, copias de seguridad y datos corregidos, y seguir mostrándolos públicamente de forma indefinida tras cancelar, bajar de plan o cambiar de proveedor; aclarar atribución y cualquier obligación de borrado.
2. Matriz de ediciones/identificadores disponibles desde 2017/18: Primera, Segunda, Segunda B histórica, Primera Federación, Copa y playoffs, distinguiendo grupos y fases. Verificar específicamente ascensos de 2018 y 2020, incluyendo todas las eliminatorias del Elche; son objetivos de comprobación, no cobertura confirmada.
3. Evidencia de muestras históricas con fechas, equipos, estado, resultado y recinto del encuentro; indicar campos ausentes y lagunas por edición. Pedir ejemplos al proveedor o autorizar una evaluación técnica separada; no crear cuentas implícitamente.
4. Precio total del archivo requerido, selección exacta de las cinco competiciones o suplementos, IVA y condiciones para un dominio público y entornos aislados. El precio «desde» del histórico no garantiza incluir todo 2017/18–actualidad.

Estas preguntas quedan preparadas, **no enviadas**. Una aprobación condicionada no elimina los puntos pendientes. Si no se resuelven, documentar qué temporadas/competiciones quedarían manuales y obtener una decisión explícita sobre ese alcance antes de 4c. No completar huecos silenciosamente con scraping u otra API.

## Fuentes oficiales consultadas

Todos los enlaces siguientes se consultaron el 2026-10-18. Las condiciones y precios pueden cambiar. El catálogo completo de Sportmonks superó el límite de lectura del navegador; se usa su resultado indexado solo para la afirmación general de historia, y páginas específicas para cobertura. No se interpreta esa limitación como ausencia de competiciones.

- **S1:** [Sportmonks — La Liga y competiciones españolas, FAQ](https://www.sportmonks.com/football-api/la-liga-api/).
- **S2:** [Sportmonks — Segunda División](https://www.sportmonks.com/football-api/la-liga-2-api/).
- **S3:** [Sportmonks — planes e histórico](https://www.sportmonks.com/football-api/plans-pricing/).
- **S4:** [Sportmonks — entidad Fixture](https://docs.sportmonks.com/v3/endpoints-and-entities/entities/fixture).
- **S5:** [Sportmonks — eliminatorias por temporada](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/seasons/get-brackets-by-season-id).
- **S6:** [Sportmonks — catálogo e historia general](https://www.sportmonks.com/football-api/coverage/).
- **S7:** [Sportmonks — participantes y localía](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/includes/participants).
- **S8:** [Sportmonks — términos, apartados Copyright, Terms of use y cancelación](https://www.sportmonks.com/terms-of-service/).
- **S9:** [Sportmonks — almacenamiento y uso dentro del producto](https://www.sportmonks.com/integrity-support/).
- **A1:** [API-Football — cobertura, Spain](https://www.api-football.com/coverage).
- **A2:** [API-Football — precios directos](https://www.api-football.com/pricing).
- **A3:** [API-Football — guía oficial, temporadas y fixtures](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide).
- **A4:** [API-Football — límites de frecuencia](https://www.api-football.com/news/post/how-ratelimit-works).
- **A5:** [API-Football — términos, Service & data](https://www.api-football.com/terms).
- **F1:** [football-data.org — cobertura](https://www.football-data.org/coverage).
- **F2:** [football-data.org — precios](https://www.football-data.org/pricing).
- **F3:** [football-data.org — términos, apartados 7 y 9](https://www.football-data.org/about).
