# Experiencia pública sobre el mapa

Alcance: UX-01, UX-02 y UX-03 del [BACKLOG](BACKLOG.md). Decisiones confirmadas por el propietario el 2026-10-24: mapa como portada, detalles compartibles en paneles conservando las páginas completas, y panel inferior ampliable en móvil. No incluye nuevas estadísticas, fotos, rutas/kilómetros, estadios pendientes, clustering, proveedor cartográfico ni la dirección visual lúdica.

## Navegación y enlaces

| URL | Contenido |
| --- | --- |
| `/` | Mapa sin panel, cobertura y acceso al archivo. |
| `/?view=trips` | Todos los viajes publicados, con fechas desconocidas al final. |
| `/?view=stadiums` | Estadios visitados, también sin coordenadas. |
| `/?view=summary` | Totales y balance existentes con cobertura explícita. |
| `/?stadium=<slug>` | Ubicación y visitas al estadio; cada visita abre su viaje. |
| `/?trip=<slug>` | Datos del partido, recuerdos y enlace al estadio si se conoce. |
| `/map` | Redirección compatible a `/`, manteniendo la query. |

Las rutas `/trips`, `/stadiums` y sus detalles conservan su contenido y slugs. Los paneles ofrecen «Ver página completa». Cada URL admite una sola selección: combinaciones, parámetros de selección repetidos, vistas no reconocidas y recursos inexistentes/no públicos devuelven 404. Se ignoran parámetros ajenos a la selección, por ejemplo de campañas. No se acepta una URL de destino externa como estado.

Seleccionar un marcador abre el estadio. Estadio → viaje y viaje → estadio mantienen el mapa montado y seleccionan el marcador si hay coordenadas. Cerrar añade una entrada de mapa sin panel, de modo que Atrás puede recuperar el detalle; Atrás/Adelante respetan el historial normal, incluso tras entrar por un enlace compartido. No se interpreta Cerrar como volver a un sitio externo. Pan, zoom y ampliación del panel son transitorios, sin cambios de URL; recargar centra el recurso compartido, no restaura un desplazamiento previo arbitrario.

## Móvil, accesibilidad y estados

En escritorio el panel se sitúa a la derecha. En móvil ocupa inicialmente una parte inferior del mapa; Ampliar/Reducir cambia el espacio de lectura sin requerir un gesto de arrastre. Es una sección no modal: el mapa y la navegación siguen disponibles, sin bloquear el foco. El contenido tiene scroll propio, sin propagar el gesto al mapa. Al cambiar el contenido se enfoca el título y se reinicia el scroll del panel; cerrar devuelve el foco a «Explorar estadios». Escape cierra el panel. El zoom y la atribución permanecen fuera del panel; se conserva la pausa de interacción y se respeta movimiento reducido.

- **Sin visitas:** mapa base, cobertura a cero y mensajes de archivo vacío, sin datos inventados.
- **Sin coordenadas:** no se dibuja marcador; el estadio/viaje permanece en su lista y detalle con una explicación.
- **Carga:** estado de carga del mapa; al seleccionar un marcador, aviso mientras llega su panel. Los enlaces de panel son navegación nativa de Next.js.
- **Fallo de teselas o JavaScript:** contenido y enlaces de panel renderizados por el servidor, enlaces a listas y páginas completas. El mapa informa del fallo de teselas; sin JavaScript el panel fluye como contenido normal.
- **Fallo de PostgreSQL:** límite de error existente con reintento; nunca presentar el fallo como un archivo vacío.
- **Recurso no público o selección inválida:** 404 con recuperación existente. Partidos sin asistencia no aparecen en paneles ni marcadores.

## Aceptación antes de integrar

1. En escritorio y móvil, abrir estadio desde marcador, viaje desde sus visitas y volver al estadio. Comprobar que el mapa no se reinicia al cambiar de panel.
2. Copiar cada URL de detalle, abrirla en otra pestaña y recargar. Usar Atrás/Adelante y Cerrar, incluyendo entrada directa sin historial interno previo.
3. En móvil, ampliar/reducir y leer contenido largo; probar orientación, scroll, gestos, zoom y atribución. Confirmar que no hay desbordamiento horizontal.
4. Recorrer controles con teclado: marcador, título tras navegación, enlaces y cierre con Escape. Verificar foco visible y movimiento reducido.
5. Abrir estadios sin coordenadas y viajes sin estadio; comprobar que conservan sus datos y no se sitúan en una ubicación supuesta.
6. Probar sin JavaScript, con teselas bloqueadas y con archivo vacío en datos desechables. Revisar mensajes y alternativas de navegación.
7. Confirmar que los enlaces completos siguen funcionando, que `/map` conserva la selección y que no se publica ningún partido sin asistencia.

La comprobación automatizada HTTP no sustituye la revisión visual y táctil del Preview por el propietario. La integración seguirá el flujo de PR; no se despliega ni cambia configuración externa como parte de esta implementación.

Verificación local (2026-10-24): suite completa 89/89, sin omisiones, con eliminación de su base temporal; lint y TypeScript correctos. Chrome headless con datos sintéticos, perfil temporal y viewports 1440×1000 y 390×844 comprueba marcador → estadio → viaje, mapa persistente, historial, Escape, foco, expansión móvil sin ocultar el zoom, teselas bloqueadas y contenido sin JavaScript. La prueba de navegador elimina su propia base temporal y perfil. Build Webpack verificado; Turbopack no completa por permisos de creación de procesos/puertos en este entorno. Quedan pendientes CI, revisión del Preview y comprobación táctil/lectores de pantalla por el propietario.
