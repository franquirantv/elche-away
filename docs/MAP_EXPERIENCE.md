# Experiencia pública sobre el mapa

## GEO-02 / COL-01 / COL-02 · Criterio vigente

El propietario autorizó el 2026-10-25 publicar todos los estadios registrados como catálogo dinámico del reto, incluidos pendientes. Esta excepción sustituye las limitaciones anteriores de este documento sobre estadios y marcadores exclusivamente visitados; los partidos sin asistencia siguen privados. Las visitas, los escudos y las estadísticas personales continúan derivados de asistencias. Filtros de colección y criterio territorial (50 provincias, 17 comunidades, islas incluidas, Ceuta/Melilla aparte, sin kilómetros) se documentan en [PRODUCT](PRODUCT.md#geo-02--col-01--col-02--criterio-vigente). No requiere migración ni servicios nuevos.

Alcance: UX-01, UX-02 y UX-03 del [BACKLOG](BACKLOG.md). Dirección confirmada por el propietario el 2026-10-24: una aplicación de exploración con el mapa ocupando todo el viewport y toda la interacción pública superpuesta. No hay navbar, cabecera, footer, secciones debajo ni páginas públicas de detalle separadas. El admin y el login conservan el formato convencional. No incluye nuevas estadísticas, fotos, kilómetros, estadios pendientes, clustering ni cambio de proveedor cartográfico en el alcance original. En la release se combina con la elección posterior de Liberty (MAP-01), manteniendo los datos OSM.

## Navegación y enlaces

| URL | Contenido |
| --- | --- |
| `/` | Mapa a pantalla completa, identidad y controles flotantes. |
| `/?view=trips` | Panel con todos los viajes publicados, con fechas desconocidas al final. |
| `/?view=stadiums` | Panel de estadios visitados, también sin coordenadas. |
| `/?view=summary` | Panel con totales y balance existentes y cobertura explícita. |
| `/?stadium=<slug>` | Panel con ubicación y visitas al estadio; cada visita abre su viaje. |
| `/?trip=<slug>` | Panel con partido, recuerdos y enlace al estadio si se conoce. |
| `/map` | Redirección compatible a `/`, manteniendo la query. |
| `/trips`, `/stadiums` | Redirección al listado correspondiente dentro del mapa. |
| `/trips/<slug>`, `/stadiums/<slug>` | Redirección al panel correspondiente dentro del mapa. |
| `/admin`, `/auth/*` | Área de gestión/acceso con la estructura tradicional. |

Los slugs y los enlaces existentes siguen siendo válidos. Cada URL de mapa admite una sola selección: combinaciones, parámetros de selección repetidos, vistas no reconocidas y recursos inexistentes/no públicos devuelven 404. Se ignoran parámetros ajenos a la selección, por ejemplo de campañas. No se acepta una URL de destino externa como estado. La recuperación 404 también se presenta sobre el mapa.

Seleccionar un marcador abre el estadio. Estadio → viaje y viaje → estadio mantienen el mapa montado y seleccionan el marcador si hay coordenadas. Cerrar añade una entrada de mapa sin panel, de modo que Atrás puede recuperar el detalle; Atrás/Adelante respetan el historial normal, incluso tras entrar por un enlace compartido. Pan, zoom y ampliación del panel son transitorios, sin cambios de URL; recargar centra el recurso compartido.

## Controles y distribución

- Identidad pequeña flotante y botones de Viajes, Estadios y Resumen sobre el mapa.
- Zoom +/− y botón «Volver a la vista inicial de la península ibérica» con icono de diana. Restablecer detiene el movimiento actual, encuadra los límites iniciales y cierra el panel; no solicita geolocalización. El desplazamiento se realiza arrastrando el mapa o con las flechas del teclado al enfocarlo, sin botones direccionales sobrepuestos. Viajes usa un avión, Resumen una carpeta con documentos y Estadios un estadio. Los SVG comparten tamaño y alineación con sus etiquetas.
- «Archivo» despliega cobertura, identificación como archivo personal sin carácter oficial, ayuda y enlace protegido a administración. No se consulta Auth por visualizar el mapa ni se precarga el acceso privado.
- Atribución cartográfica siempre visible en una esquina, fuera de los paneles. No se añade información debajo del mapa.

En escritorio el panel está a la derecha, separado de los controles. En móvil aparece abajo, con Ampliar/Reducir para dar espacio de lectura sin requerir arrastre. El panel ampliado reserva espacio para los controles superiores y la atribución inferior. La página pública no tiene scroll; solo se desplaza el contenido de los paneles. Arrastrar, la rueda y el gesto táctil actúan sobre el mapa. Las áreas de scroll del panel no arrastran el mapa.

El panel es no modal: mapa y controles siguen disponibles sin bloqueo de foco. Al cambiar el contenido se enfoca su título y se reinicia su scroll; cerrar devuelve el foco al botón flotante de Estadios. Escape cierra el panel. Se respetan foco visible, controles con nombre accesible y movimiento reducido. El encuadre inicial continúa siendo la península; las ubicaciones de islas se alcanzan mediante el mapa o seleccionando su estadio.

## Estados y datos

- **Sin visitas:** mapa base, cobertura a cero y mensajes de archivo vacío, sin datos inventados.
- **Sin coordenadas:** no se dibuja marcador; estadio/viaje permanece en su lista y panel con una explicación.
- **Carga:** estado sobre el mapa; seleccionar un marcador informa mientras llega el panel. Los enlaces usan navegación de Next.js.
- **Fallo de teselas o JavaScript:** los enlaces flotantes y el contenido de los paneles siguen renderizados por el servidor. Sin JavaScript, la navegación recarga el panel; solo sus contenidos desplazan, sin páginas públicas alternativas.
- **Fallo de PostgreSQL:** recuperación con reintento existente; nunca presentar el fallo como archivo vacío.
- **Recurso no público o selección inválida:** 404 con recuperación sobre el mapa. Partidos sin asistencia no aparecen en paneles ni marcadores.

## Aceptación antes de integrar

1. En escritorio y móvil, confirmar que el mapa llena el viewport sin cabecera, navbar, footer ni scroll de documento. El admin y el login deben conservarlos.
2. Abrir estadio desde marcador, viaje desde sus visitas y volver. El mapa no debe reiniciarse entre paneles.
3. Copiar cada URL de detalle, abrirla en otra pestaña y recargar. Usar Atrás/Adelante, Cerrar y Escape, incluyendo entrada directa sin historial previo.
4. Usar zoom y desplazamiento con arrastre/teclado; restablecer y comprobar la vista completa de la península, sin selección abierta. Probar rueda y gestos.
5. En móvil, ampliar/reducir y leer contenido largo; probar orientación, scroll propio y que zoom, desplazamiento, restablecer y atribución sigan visibles.
6. Recorrer con teclado: marcadores, controles, título tras navegación y enlaces. Verificar foco visible y movimiento reducido. Completar revisión táctil y de lectores de pantalla en Preview.
7. Abrir estadios sin coordenadas y viajes sin estadio. Probar sin JavaScript, con teselas bloqueadas y con archivo vacío en datos desechables.
8. Confirmar que las rutas antiguas abren los mismos recursos dentro del mapa y que no se publica ningún partido sin asistencia.

La comprobación HTTP no sustituye la revisión visual/táctil del Preview. La integración seguirá el flujo de PR; no se cambia configuración externa ni se despliega como parte de esta implementación.

Verificación local (2026-10-24): 89/89 pruebas sobre una base temporal eliminada al terminar; lint, TypeScript y build Webpack correctos. Chrome headless con perfil y datos sintéticos temporales comprueba viewport completo y ausencia de scroll/chrome público en escritorio 1440×1000 y móvil 390×844/320×568; paneles, foco, historial, mapa persistente, zoom, desplazamiento, vuelta a la península y conservación del formato del login. También se comprueban contenido sin JavaScript y teselas bloqueadas. Se eliminaron el perfil y la base de esta revisión. El smoke de CD consulta las vistas canónicas del mapa sin seguir redirecciones. Pendientes CI, revisión del Preview y comprobación táctil/lectores de pantalla.
