# MAP-01 · Alternativas de estilo sobre OSM

Consulta y previews del 2026-10-24. El propietario ha aparcado la cartografía local y el piloto de relieve: quiere conservar el detalle urbano y cambiar el diseño de la base OSM. Los experimentos descartados se conservan aparte del cambio que se integra. El propietario eligió **Liberty** y autorizó aplicarlo al mapa: la integración local mantiene Leaflet y utiliza el adaptador oficial de MapLibre. Todavía no se ha publicado ni integrado en main.

## Resultado

Comparador independiente: `/map-style-previews/index.html`. Incluye siete alternativas y OSM estándar como referencia. Cada una tiene capturas reales de España y Mestalla, con el mismo encuadre; también permite pan/zoom, vista de Valencia y Canarias y cambio de estilo sin mover la cámara. Los puntos geográficos son referencias de comparación; no se consulta PostgreSQL ni se representan asistencias.

| Estilo | Proveedor | Valoración visual de la muestra | Coste aplicable |
| --- | --- | --- | --- |
| Liberty | OpenFreeMap | Color y detalle; representa el estadio, servicios y edificios con volumen aparente. | 0 €, sin cuenta/clave. |
| Bright | OpenFreeMap | Paleta cálida, calles distinguibles y edificios más suaves. | 0 €, sin cuenta/clave. |
| Positron | OpenFreeMap | Claro y muy discreto; conserva calles y huellas de edificios, con menor contraste del estadio. | 0 €, sin cuenta/clave. |
| Fiord | OpenFreeMap | Azul oscuro; contraste de edificios y calles menor que en los estilos claros. | 0 €, sin cuenta/clave. |
| Dark | OpenFreeMap | Negro/gris; dirección nocturna, menos adecuada si se prioriza leer el estadio. | 0 €, sin cuenta/clave. |
| Alidade Smooth | Stadia Maps | Claro y sobrio, buena distinción de la huella del estadio. | Plan Free no comercial, sujeto a cuota y configuración para publicar. |
| Outdoors | Stadia Maps | Más naturaleza/detalle y bastantes POI a escala urbana. | Plan Free no comercial, sujeto a cuota y configuración para publicar. |
| OSM estándar | OSM Foundation | Referencia inicial, mayor variedad de símbolos y colores. | Sin tarifa; política del servidor comunitario. |

Juicio de diseño, no garantía del proveedor: probar primero **Bright y Liberty** para conservar carácter y detalle; Positron si se busca máxima discreción. El volumen de Liberty es parte de su estilo, no una fotografía ni una reconstrucción precisa del estadio. En las capturas no se añaden marcadores ni paneles, para poder valorar la cartografía; la integración posterior requerirá comprobarlos y ajustar el idioma de etiquetas. Los estilos se prueban tal como los publica cada proveedor, por lo que algunas etiquetas generales están en inglés y las locales pueden usar lenguas cooficiales.

## Condiciones verificadas

### OpenFreeMap

[Web y FAQ oficiales](https://openfreemap.org/): instancia pública completamente gratuita, sin registro, tarjeta ni API key; sin límites publicados de vistas o solicitudes; admite uso comercial. Requiere atribución a OpenMapTiles y OpenStreetMap. No ofrece SLA; la [disponibilidad puede cambiar](https://openfreemap.org/tos/). No equivale a garantía de servicio perpetuo ni incluye alojamiento de nuestra aplicación.

[Guía oficial](https://openfreemap.org/quick_start/): estilos Liberty, Bright, Positron, Dark y Fiord, personalizables mediante JSON/Maputnik; MapLibre puede integrarse directamente o mediante el puente oficial para Leaflet. No es obligatorio desechar la navegación ni los marcadores actuales para usar esta fuente, aunque habrá que evaluar coste y compatibilidad de ambas rutas.

### Stadia Maps

[Precio oficial](https://stadiamaps.com/pricing/): Free de 0 $/mes, 200.000 créditos/mes, sin uso adicional, no comercial. Créditos no equivalen necesariamente a vistas del mapa. [Límites](https://docs.stadiamaps.com/limits/) y [definición de uso comercial](https://stadiamaps.com/faqs/): un archivo personal sin monetización encaja en principio, sujeto a mantener ese uso; publicidad/ingresos cambian las condiciones.

[Autenticación](https://docs.stadiamaps.com/authentication/): localhost/127.0.0.1 admite pruebas sin clave, con limitación específica. Publicar exige crear cuenta y autorizar el dominio o usar una clave; no se ha realizado ese alta. El comparador bloquea estas dos opciones fuera de localhost y remite a sus capturas, para no simular que están listas para producción. [Atribución requerida](https://docs.stadiamaps.com/attribution/), visible en mapa y capturas.

Estilos: [Alidade Smooth](https://docs.stadiamaps.com/map-styles/alidade-smooth/) y [Outdoors](https://docs.stadiamaps.com/map-styles/outdoors/).

### CARTO · candidato condicionado, sin conexión

Las [condiciones actuales](https://carto.com/legal/basemap-terms/index.html), actualizadas el 2026-09-29, exigen una clave emitida por CARTO para Free Basemap Services. Publican 5 millones de solicitudes de tesela/mes para uso no comercial y 1 millón para comercial, atribución y acceso revocable. Su FAQ anterior habla de concesiones/grants; se prioriza la condición vigente más reciente y se debe confirmar al solicitar clave.

Positron, Dark Matter y Voyager pueden entrar en una comparación posterior si el propietario obtiene la clave. No se usan URLs antiguas anónimas, no se crea cuenta, no se inventa una preview equivalente ni se presenta el Positron de OpenFreeMap como el mismo servicio de CARTO. [Voyager oficial](https://carto.com/blog/new-voyager-basemap/index.html).

### OSM estándar

[Política oficial](https://operations.osmfoundation.org/policies/tiles/): atribución visible, Referer válido, caché normal, sin descargas masivas/prefetch, servicio sin SLA. En esta comparación se representa una fuente raster en el visor común, sin descargar colecciones de teselas para almacenar. La aplicación pública sigue con Leaflet y su configuración actual.

## Implementación y previews

Página HTML/CSS/JS aislada bajo `public/map-style-previews/`. Usa MapLibre GL JS **5.24.0** desde jsDelivr con URL versionada e integridad SHA-384. La página de comparación no cambia dependencias ni rutas Next; la integración posterior añade MapLibre y su adaptador mediante npm; el visor de comparación sigue separado de la integración de Liberty en el mapa público. Fuentes/teselas/glifos/sprites se obtienen en el navegador desde cada proveedor; es una investigación visual, no una arquitectura de producción. Si no carga el CDN, quedan disponibles las capturas y condiciones.

Capturas WebP reales en `public/map-style-previews/previews/`, no imágenes generadas: ocho estilos × dos encuadres, 1000 × 650 píxeles, créditos incluidos. Cámara superior: centro −3,2 / 39,8, zoom 5; estadio: −0,3583 / 39,4747, zoom 16,5; orientación y pitch 0. Los estilos conservan su diseño original. Capturadas tras terminar la carga de fuentes/teselas con Chrome; comprimidas a WebP calidad 85. Las imágenes no actualizan automáticamente al cambiar los datos del proveedor.

Para revisar: ejecutar `npm run dev` y abrir `http://localhost:3000/map-style-previews/index.html`. Ejemplo compartible local: `?style=bright&scene=stadium`. No requiere claves ni credenciales para las previews locales verificadas.

## Verificación y límites de aceptación

Las 16 escenas cargaron completamente sin excepciones JavaScript durante la captura. Revisadas las representaciones de calles y del estadio. Comprobados enlaces directos, las 16 imágenes disponibles, conservación de cámara, vista de Canarias, móvil sin desbordamiento horizontal y renderizado móvil de edificios/calles. Simulado un fallo de estilo: se oculta la base anterior para no etiquetarla como la nueva y se recupera al seleccionar un estilo disponible. Sin recursos HTTP fallidos tras generar las capturas. ESLint focalizado y `git diff --check` correctos. Quedan por decidir estilo, idioma, intensidad de POI y encaje con marcadores/paneles reales; Liberty es la opción elegida; no se ha desplegado a producción. El comparador es una herramienta de revisión, no una integración terminada. CI y Vercel Preview de una futura integración siguen pendientes.


## Integración autorizada de Liberty

El mapa de inicio (`/`, con redirección desde `/map`) usa ahora Liberty por defecto mediante Leaflet + MapLibre y `@maplibre/maplibre-gl-leaflet`. La integración con el PR de pantalla completa mantiene pines, selección, paneles con URL, navegación e historiales y consulta únicamente el archivo PostgreSQL existente. Sin coordenadas se conserva la tarjeta/lista sin pin. Configuración opcional `MAP_STYLE_URL` y `MAP_MAX_ZOOM`, documentada en README y `.env.example`; se retiran los overrides raster antiguos. No requiere cambios de entorno para activar el valor por defecto.

Verificación local: tres pruebas de configuración (incluido rechazo de credenciales y valores inválidos), ESLint y tipos focalizados; navegador real con Liberty, ausencia de solicitudes al raster OSM antiguo, créditos visibles, selección de tarjeta/pin, popup, zoom, pausa y reanudación, móvil sin desbordamiento, caída del estilo y falta de WebGL con lista conservada. Los errores durante una inicialización WebGL parcial se limpian sin rechazos no controlados. La suite completa, build y Vercel Preview siguen como comprobaciones de CI/aceptación previas a integrar.


Integración con la experiencia a pantalla completa: se resolvieron los conflictos conservando Liberty, los paneles y enlaces compartidos y las correcciones de renovación de sesión de la release. Las comprobaciones que esperaban controles de dirección se ajustaron a su retirada ya aprobada; siguen disponibles arrastre y flechas del teclado. La capa vectorial conserva el mapa entre navegaciones de panel.
