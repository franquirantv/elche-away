# Backlog de producto

Propuestas para la siguiente fase de Elche Away. Este documento organiza oportunidades; no autoriza implementación, no modifica el [ROADMAP](ROADMAP.md) ni asigna milestones, fechas o compromisos de entrega. Cada identificador permite extraer después una tarea independiente.

La experiencia pública ya se articula alrededor de un mapa a pantalla completa, con paneles y URLs compartibles; el admin conserva su estructura actual. Este backlog recoge solo trabajo pendiente. La implementación de UX-01, UX-02 y UX-03 se describe en [MAP_EXPERIENCE](MAP_EXPERIENCE.md) y su integración se sigue en la [PR #7](https://github.com/franquirantv/elche-away/pull/7), con CI y revisión de Preview pendientes. Retirar un item implementado de este documento no implica que esté integrado o desplegado.

[PRODUCT](PRODUCT.md) y [DESIGN](DESIGN.md) recogen la dirección vigente; [ARCHITECTURE](ARCHITECTURE.md) y [DATABASE](DATABASE.md), los límites técnicos y de datos. La preparación de lanzamiento mantiene su seguimiento en [RELEASE](RELEASE.md).

## Prioridades y criterios

- **P0 — Corrección prioritaria:** investigar un fallo que dificulta el uso habitual antes de ampliar la experiencia.
- **P1 — Próximo foco de producto:** definir o construir las bases de la experiencia pública propuesta. No implica abordar todos estos items a la vez.
- **P2 — Ampliación posterior:** aporta valor, pero necesita las bases, decisiones o datos anteriores.
- **P3 — Futuro / polish opcional:** enriquecimiento sin bloquear el archivo ni la exploración principal.

Las prioridades son iniciales y revisables. Cada item indica su tipo: **bug/fix**, **cambio estructural de UX**, **nueva funcionalidad** o **polish/idea futura**. Las investigaciones deben producir una decisión verificable antes de abrir tareas de implementación dependientes.

## Administración y sesión

### ADM-01 · Validar la persistencia de sesión durante al menos tres horas

**P0 · Bug/fix (validación pendiente).** El diagnóstico y las correcciones del acceso tras navegar por la web y de la renovación de cookies ya están implementados en la [PR #6](https://github.com/franquirantv/elche-away/pull/6); no queda repetir esa implementación ni cambiar duraciones por intuición.

- **Objetivo:** comprobar que la sesión permite al menos tres horas de navegación normal sin pedir otro login.
- **Valor:** confirmar que las correcciones resuelven las interrupciones del propietario en el entorno afectado.
- **Alcance aproximado:** aceptación manual de login → admin → páginas públicas → regreso al admin, con recargas, varias pestañas y duración real de al menos tres horas; verificar también logout y rechazo de accesos no autorizados. Registrar tiempos y evidencia sin secretos. Revisar CI y Preview de la corrección antes de integrar.
- **Dependencias / decisiones pendientes:** concretar si el objetivo incluye inactividad y contrastar el comportamiento de Neon Auth en el entorno afectado. Abrir una corrección adicional solo si la validación reproduce un fallo; mantener autorización exacta por `ADMIN_USER_ID` y no prolongar una sesión cerrada explícitamente.

### ADM-02 · Retirar la exposición continua del identificador del propietario

**P2 · Polish/idea futura.** Es una mejora pequeña e independiente una vez comprobada la identidad configurada.

- **Objetivo:** dejar de mostrar continuamente `ADMIN_USER_ID` en la interfaz tras la configuración inicial.
- **Valor:** reducir ruido técnico en el uso diario del panel.
- **Alcance aproximado:** localizar la presentación actual y sustituirla por una indicación de sesión comprensible, manteniendo salida y estados de error claros.
- **Dependencias / decisiones pendientes:** decidir si hace falta una ayuda puntual de configuración/diagnóstico. Ocultar el dato no elimina ni modifica la autorización del servidor; no rediseñar el admin.

## Cartografía y visualización geográfica

### MAP-01 · Investigar una cartografía más simple y visual

**P1 · Cambio estructural de UX (investigación).** Elegir la base gráfica pronto evita diseñar paneles y marcadores sobre una estética que después se descarte.

- **Objetivo:** comparar opciones de mapa menos cargadas y más afines al diario de exploración.
- **Valor:** dar protagonismo a estadios y viajes y mejorar la legibilidad.
- **Alcance aproximado:** comparar la base actual con estilos simplificados compatibles y, si aporta valor, alternativas vectoriales o ilustradas. Preparar muestras comparables de península, islas y ciudades autónomas, con marcadores y paneles; evaluar detalle, zoom, móvil, rendimiento, accesibilidad, atribución, licencias y disponibilidad.
- **Dependencias / decisiones pendientes:** coordinar VIS-01 y la experiencia implementada en [MAP_EXPERIENCE](MAP_EXPERIENCE.md). La base aprobada es Leaflet + teselas estándar OSM con presupuesto de 0 €; no seleccionar proveedor, migrar motor ni contratar servicios en este item sin revisar condiciones y decisión del propietario. Distinguir un cambio de estilo de un cambio de tecnología.

### MAP-02 · Mostrar conexión punteada y distancia al estadio

**P2 · Nueva funcionalidad.** Enriquece la exploración cuando selección y criterio de distancia estén definidos.

- **Objetivo:** al pasar el cursor o seleccionar un estadio, mostrar una conexión de puntos desde Elche/origen y su distancia aproximada en kilómetros.
- **Valor:** hacer visible la dimensión del desplazamiento y reforzar el vínculo entre lugares.
- **Alcance aproximado:** definir aparición, retirada y lectura de la línea y etiqueta, con selección táctil/teclado equivalente al hover; contemplar coordenadas ausentes, islas y movimiento reducido. Aclarar si la línea es solo una conexión gráfica o representa una ruta calculada.
- **Dependencias / decisiones pendientes:** selección y paneles del mapa ya disponibles; GEO-01 pendiente. Resolver origen fijo o por viaje, línea recta frente a recorrido real/estimado y solo ida frente a ida y vuelta. No asumir fórmula, servicio de rutas ni desplazamiento real; etiquetar la aproximación elegida.

### MAP-03 · Resolver marcadores solapados y evaluar clustering

**P2 · Cambio estructural de UX.** Priorizar cuando la densidad real dificulte seleccionar estadios.

- **Objetivo:** mantener accesibles todos los estadios al crecer la colección o aparecer sedes próximas.
- **Valor:** evitar puntos ocultos y selecciones ambiguas.
- **Alcance aproximado:** evaluar solapamientos en varios zooms y proponer agrupación, separación o selección mediante lista; definir apertura del grupo y conservación del estadio seleccionado y del enlace directo.
- **Dependencias / decisiones pendientes:** volumen/densidad observados, MAP-01 y COL-01. Diferenciar grupos de estadios de recuentos de visitas: las visitas repetidas siguen compartiendo un único estadio. Evitar añadir clustering sin necesidad comprobada.

## Estadísticas personales y calidad de datos

### STA-01 · Ampliar el resumen estadístico del archivo

**P2 · Nueva funcionalidad.** Aporta relato personal sin depender de completar toda la geografía.

- **Objetivo:** consultar estadio más visitado, rival más visto, distribución por temporadas, ampliando los totales y el balance de resultados ya disponibles.
- **Valor:** descubrir patrones y recuerdos del archivo, más allá de recorrer tarjetas individuales.
- **Alcance aproximado:** definir métricas, empates en rankings, denominadores, cobertura y enlace al conjunto de viajes que explica cada cifra; integrar las métricas en el panel de resumen existente. Presentar temporadas conocidas sin inferirlas de las fechas y separar competición de categoría del Elche.
- **Dependencias / decisiones pendientes:** paneles del mapa ya disponibles; auditar disponibilidad de datos antes de prometer métricas. Derivar todo de asistencias en PostgreSQL, sin contadores persistidos; excluir desconocidos solo del cálculo correspondiente e indicar cobertura. El balance requiere partidos finalizados con resultado conocido; no contar penaltis de tanda ni resultados desconocidos como 0–0.

### GEO-01 · Definir el significado y cálculo de kilómetros

**P1 · Nueva funcionalidad (investigación).** Es una decisión compartida por la distancia del mapa y las estadísticas acumuladas.

- **Objetivo:** establecer qué distancia puede mostrarse con rigor a partir de los datos disponibles.
- **Valor:** evitar cifras atractivas pero engañosas o inconsistentes entre secciones.
- **Alcance aproximado:** auditar coordenadas y origen disponible; comparar distancia geográfica, estimación por carretera y recorridos registrados según precisión, cobertura, coste y mantenimiento. Documentar unidad, redondeo, trayectos incluidos y tratamiento de visitas repetidas y datos ausentes, con ejemplos de cálculo esperados.
- **Dependencias / decisiones pendientes:** origen Elche o variable, ida/ida y vuelta, viajes enlazados y transporte/islas. No elegir aún método ni proveedor. Una estimación desde Elche no acredita kilómetros realmente recorridos; definir su etiqueta antes de implementar MAP-02 o acumulados.

### GEO-02 · Mostrar estadísticas y progreso territorial

**P2 · Nueva funcionalidad.** Depende de datos geográficos suficientes y denominadores explícitos.

- **Objetivo:** conocer provincias/comunidades visitadas, progreso territorial y kilómetros acumulados cuando puedan calcularse correctamente.
- **Valor:** visualizar cuánto del territorio representa el archivo y orientar próximas visitas.
- **Alcance aproximado:** auditar códigos territoriales y coordenadas de estadios con asistencia; derivar territorios únicos y, tras GEO-01, acumulados por visita. Mostrar cobertura, territorios pendientes y criterio de inclusión de islas, Ceuta y Melilla. Separar el resumen numérico de una posible representación con polígonos.
- **Dependencias / decisiones pendientes:** GEO-01 para kilómetros; definir qué significa «porcentaje de España recorrida»: territorios visitados sobre un conjunto explícito, superficie u otra métrica. Visitar un estadio no equivale a recorrer toda una provincia ni su superficie. No inferir geografía desde el club ni rellenar datos desconocidos; omitir o limitar métricas que los datos no sostengan.

## Colección y reto personal

### COL-01 · Definir el catálogo de estadios por visitar

**P2 · Nueva funcionalidad.** El reto necesita un universo acordado antes de poder afirmar que está completo.

- **Objetivo:** mostrar estadios relevantes aún no visitados como objetivos personales por desbloquear.
- **Valor:** dar continuidad a la exploración y una motivación para ampliar el archivo.
- **Alcance aproximado:** definir qué estadios componen la colección, cómo se incorporan/mantienen y cómo se filtran frente a los visitados. El estado visitado se deriva de asistencias, contemplando visitas repetidas y sedes históricas distintas.
- **Dependencias / decisiones pendientes:** elegir catálogo curado, competiciones/temporada de referencia u otro criterio; acordar procedencia, derechos de datos y mantenimiento. Diseñar una fuente pública explícita para objetivos: no exponer todos los estadios o partidos sin asistencia del admin. Un objetivo no crea una asistencia ni altera las estadísticas personales; los denominadores deben indicar catálogo y versión/criterio.

### COL-02 · Mejorar marcadores y estados de colección

**P2 · Polish/idea futura.** Refuerza la lectura del reto cuando estén definidos su catálogo y lenguaje visual.

- **Objetivo:** distinguir visitado, pendiente y seleccionado y transmitir progreso sin saturar el mapa.
- **Valor:** facilitar la lectura y dar una sensación de colección personal.
- **Alcance aproximado:** proponer iconos, etiquetas y estados accesibles, con recuentos de visitas donde ayuden; sincronizar marcador, card y panel. Mantener fallback cuando falten imágenes y no depender solo del color.
- **Dependencias / decisiones pendientes:** COL-01, MAP-01 y VIS-01; revisar expresamente cualquier cambio de la regla actual de escudos (rival de las asistencias, nunca propietario del estadio). Para pendientes no inferir un escudo desde supuesta titularidad. No introducir cuentas públicas ni un sistema general de logros.

## Dirección visual y recuerdos

### VIS-01 · Definir una dirección de diario de exploración futbolística

**P1 · Cambio estructural de UX (diseño).** Orienta el rediseño antes de extender estilos a toda la web.

- **Objetivo:** evolucionar del aspecto corporativo hacia una experiencia más lúdica, visual y personal.
- **Valor:** expresar la historia del propietario y conectar el archivo digital con el mapa físico.
- **Alcance aproximado:** preparar una propuesta visual acotada para mapa, card de viaje y panel de estadio: jerarquía, tipografía, color, texturas sutiles, lenguaje de colección y principios de animación. Mantener Elche Away, «Donde tú vayas.», textos en español e identidad de archivo personal.
- **Dependencias / decisiones pendientes:** partir de la navegación y los paneles ya implementados y coordinar MAP-01; revisar la contención visual vigente en DESIGN antes de implementar. Acordar intensidad lúdica sin convertirla automáticamente en logros o gamificación compleja; asegurar legibilidad, rendimiento y movimiento reducido. No aplicar esta reestructuración al admin.

### VIS-02 · Añadir animaciones y microinteracciones de exploración

**P3 · Polish/idea futura.** Mejora la sensación de respuesta después de estabilizar la navegación.

- **Objetivo:** acompañar selección, apertura de paneles y descubrimiento de lugares con movimiento útil.
- **Valor:** hacer más agradable y comprensible la transición entre contexto y detalle.
- **Alcance aproximado:** transiciones breves y consistentes, feedback de selección y progreso; comprobar interrupción de animaciones, interacción rápida, móviles modestos y alternativa con movimiento reducido.
- **Dependencias / decisiones pendientes:** VIS-01 y evaluación de la navegación/paneles ya implementados. Acordar presupuesto de rendimiento; ninguna animación debe bloquear lectura o navegación ni ser la única portadora de información.

### MEM-01 · Fotos y recuerdos por viaje

**P3 · Nueva funcionalidad futura.** Enriquece el diario, pero no bloquea mapa, sesión ni estadísticas.

- **Objetivo:** acompañar las notas personales existentes con fotos, pies y una galería por viaje.
- **Valor:** aumentar el valor emocional del archivo y dar contexto a cada desplazamiento.
- **Alcance aproximado:** reutilizar la infraestructura de almacenamiento preparada, evaluando sus límites; definir relación de varias fotos por asistencia, subida protegida, orden, texto alternativo, visualización, sustitución y borrado con limpieza reintentable. Mantener una experiencia completa sin imágenes.
- **Dependencias / decisiones pendientes:** aún no existe la funcionalidad de fotos por disponer de almacenamiento de escudos. Requiere diseño y revisión del modelo/migración, cuotas/coste, formatos/tamaños, metadatos y privacidad, publicación y borrado al desmarcar asistencia; aislamiento por entorno y autorización en cada operación. No adjuntar recuerdos personales a partidos sin asistencia.

## Candidatos para la siguiente iteración

Completar la **validación pendiente de ADM-01**, especialmente las tres horas reales de sesión. **ADM-02** sigue siendo una mejora pequeña e independiente de la interfaz de sesión.

Con la base de navegación sobre el mapa implementada, el siguiente foco de producto es **MAP-01 + VIS-01**: comparar cartografías y acordar la dirección visual antes de extender estilos. La revisión de CI y Preview de UX-01/02/03 forma parte de la integración de la PR #7, no de una nueva tarea de implementación.

**GEO-01** es candidato a investigación separada si se quiere priorizar distancias. **STA-01** puede ampliar el resumen existente; **MAP-02**, **GEO-02** y **COL-01** necesitan resolver primero sus criterios de cálculo o catálogo. Fotos, animaciones y clustering no bloquean estas decisiones.
