# Backlog de producto

Propuestas para la siguiente fase de Elche Away. Este documento organiza oportunidades; no autoriza implementación, no modifica el [ROADMAP](ROADMAP.md) ni asigna milestones, fechas o compromisos de entrega. Cada identificador permite extraer después una tarea independiente.

La experiencia pública ya se articula alrededor de un mapa a pantalla completa, con paneles y URLs compartibles; el admin conserva su estructura actual. Este backlog recoge solo trabajo pendiente. Revisión completa realizada el 2026-10-25 contra el código de `main` y la rama `feature/vis-01-vis-02`.

GEO-02 (sin kilómetros, dependientes de GEO-01) y COL-01/02 están implementados en `feature/geo-02-stadium-collection`, pendientes de revisión e integración. El propietario ha autorizado todos los estadios registrados como catálogo público dinámico y el criterio territorial de 50 provincias, 17 comunidades y ciudades autónomas aparte. Las descripciones originales siguientes se conservan como contexto; sus decisiones quedan resueltas en PRODUCT.

Trabajo implementado retirado de la lista de tareas:

- **UX-01/02/03:** navegación y paneles públicos sobre el mapa, integrados en `main` mediante la [PR #9](https://github.com/franquirantv/elche-away/pull/9). Contrato y comprobaciones en [MAP_EXPERIENCE](MAP_EXPERIENCE.md).
- **MAP-01:** comparación de estilos y elección e integración de OpenFreeMap Liberty, incluidas en `main` mediante la PR #9. Investigación en [MAP_STYLE_OPTIONS](MAP_STYLE_OPTIONS.md); dirección vigente en [DESIGN](DESIGN.md).
- **VIS-01/02:** dirección de diario personal, tarjetas, paneles, transiciones y feedback de carga implementados en `feature/vis-01-vis-02`. Comprobaciones locales y límites en [DESIGN](DESIGN.md#vis-0102--diario-de-exploración). El seguimiento de CI, Preview e integración en `release/20261025` está en la [PR #10](https://github.com/franquirantv/elche-away/pull/10).

La implementación no acredita por sí sola aceptación, integración o despliegue. La validación real de tres horas de sesión sigue abierta como ADM-01; no se repite el código de las correcciones ya integradas.

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

**Aclaración del caso reportado:** la captura muestra el login inmediatamente después de navegar por páginas públicas. El pie enlazaba siempre a `/auth/sign-in`, que mostraba login sin consultar la sesión. Se corrige el acceso del pie a `/admin` y la página de login redirige las sesiones ya verificadas; mostrar esa pantalla no demostraba una pérdida real de sesión. La corrección de renovación anterior cubre un defecto adicional reproducido, distinto de este recorrido.

- **Objetivo:** comprobar que la sesión permite al menos tres horas de navegación normal sin pedir otro login.
- **Valor:** confirmar que las correcciones resuelven las interrupciones del propietario en el entorno afectado.
- **Alcance aproximado:** aceptación manual de login → admin → páginas públicas → regreso al admin, con recargas, varias pestañas y duración real de al menos tres horas; verificar también logout y rechazo de accesos no autorizados. Registrar tiempos y evidencia sin secretos. La corrección ya está integrada en `main` mediante las PR #6 y #9; queda registrar la aceptación de duración real en el entorno afectado.
- **Dependencias / decisiones pendientes:** concretar si el objetivo incluye inactividad y contrastar el comportamiento de Neon Auth en el entorno afectado. Abrir una corrección adicional solo si la validación reproduce un fallo; mantener autorización exacta por `ADMIN_USER_ID` y no prolongar una sesión cerrada explícitamente.

### ADM-02 · Retirar la exposición continua del identificador del propietario

**P2 · Polish/idea futura.** Es una mejora pequeña e independiente una vez comprobada la identidad configurada.

- **Objetivo:** dejar de mostrar continuamente `ADMIN_USER_ID` en la interfaz tras la configuración inicial.
- **Valor:** reducir ruido técnico en el uso diario del panel.
- **Alcance aproximado:** localizar la presentación actual y sustituirla por una indicación de sesión comprensible, manteniendo salida y estados de error claros.
- **Dependencias / decisiones pendientes:** decidir si hace falta una ayuda puntual de configuración/diagnóstico. Ocultar el dato no elimina ni modifica la autorización del servidor; no rediseñar el admin.

## Cartografía y visualización geográfica

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
- **Dependencias / decisiones pendientes:** volumen/densidad observados y COL-01; partir de Liberty ya integrado (MAP-01). Diferenciar grupos de estadios de recuentos de visitas: las visitas repetidas siguen compartiendo un único estadio. Evitar añadir clustering sin necesidad comprobada.

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
- **Dependencias / decisiones pendientes:** COL-01; partir de Liberty (MAP-01) y de la dirección de diario implementada (VIS-01); revisar expresamente cualquier cambio de la regla actual de escudos (rival de las asistencias, nunca propietario del estadio). Para pendientes no inferir un escudo desde supuesta titularidad. No introducir cuentas públicas ni un sistema general de logros.

## Recuerdos

### MEM-01 · Fotos y recuerdos por viaje

**P3 · Nueva funcionalidad futura.** Enriquece el diario, pero no bloquea mapa, sesión ni estadísticas.

- **Objetivo:** acompañar las notas personales existentes con fotos, pies y una galería por viaje.
- **Valor:** aumentar el valor emocional del archivo y dar contexto a cada desplazamiento.
- **Alcance aproximado:** reutilizar la infraestructura de almacenamiento preparada, evaluando sus límites; definir relación de varias fotos por asistencia, subida protegida, orden, texto alternativo, visualización, sustitución y borrado con limpieza reintentable. Mantener una experiencia completa sin imágenes.
- **Dependencias / decisiones pendientes:** aún no existe la funcionalidad de fotos por disponer de almacenamiento de escudos. Requiere diseño y revisión del modelo/migración, cuotas/coste, formatos/tamaños, metadatos y privacidad, publicación y borrado al desmarcar asistencia; aislamiento por entorno y autorización en cada operación. No adjuntar recuerdos personales a partidos sin asistencia.

## Candidatos para la siguiente iteración

Completar la **validación pendiente de ADM-01**, especialmente las tres horas reales de sesión. **ADM-02** sigue siendo una mejora pequeña e independiente de la interfaz de sesión.

La navegación sobre el mapa, la cartografía Liberty y la dirección visual con microinteracciones ya están implementadas. No volver a planificar UX-01/02/03, MAP-01 ni VIS-01/02 como trabajo de desarrollo pendiente. La entrega de VIS-01/02 se sigue en la PR #10; no constituye una nueva tarea de desarrollo.

**GEO-01** es candidato a investigación separada si se quiere priorizar distancias. **STA-01** puede ampliar el resumen existente; **MAP-02**, **GEO-02** y **COL-01** necesitan resolver primero sus criterios de cálculo o catálogo. Fotos y clustering siguen pendientes y no bloquean estas decisiones. Cualquier ampliación de las microinteracciones ya disponibles debe tener un alcance nuevo y concreto.
