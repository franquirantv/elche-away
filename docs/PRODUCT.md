# Product

## GEO-02 / COL-01 / COL-02 · Criterio vigente

Decisión del propietario (2026-10-25): el catálogo público del reto incluye **todos los estadios registrados**, también sin partidos ni asistencias. Su denominador es dinámico: los estadios presentes en PostgreSQL en la consulta, sin afirmar exhaustividad mundial ni una temporada de referencia. El propietario lo mantiene con el editor de estadios existente; crear/editar un estadio publica su nombre, ubicación y coordenadas. No hace falta migración. Esta es una excepción explícita a las reglas anteriores que limitaban todos los estadios públicos a los visitados: los partidos sin asistencia siguen siendo privados.

El estado visitado y el número de visitas se derivan únicamente de asistencias; visitas repetidas no duplican estadios. El mapa muestra únicamente estadios con asistencia; los pendientes permanecen en la colección y sus paneles, sin marcador. Los estados se distinguen mediante símbolos y texto, además del color. El panel Estadios permite filtrar con `/?view=stadiums&state=all|visited|pending`; la paginación conserva el filtro y el mapa mantiene todos los estadios visitados. Los detalles pendientes tienen URL estable y no muestran partidos sin asistencia. Los estadios sin coordenadas siguen en la lista.

Resumen muestra provincias visitadas sobre 50 y comunidades autónomas sobre 17, incluyendo Baleares y Canarias; Ceuta y Melilla se muestran aparte. Se cuenta un territorio por al menos un estadio con asistencia y código provincial conocido, nunca por club, coordenadas inferidas o superficie. Se muestran cobertura por estadios visitados y territorios pendientes. No hay kilómetros (GEO-01 pendiente) ni polígonos.

## Purpose and terminology

Elche Away is the detailed personal archive behind a physical cork map of Spain. Visitors explore the owner's football history; only the owner edits it. A future QR code can point to the stable home URL. The product name is **Elche Away**, the primary public tagline is **“Donde tú vayas.”**, and public copy and date formatting are Spanish. This is a personal fan archive, not an official Elche CF product.

- **Club:** football organization, independent of its venues.
- **Stadium:** physical venue. Multiple clubs can use it. Renaming preserves identity; relocation to a different physical venue creates another stadium.
- **Match:** an Elche fixture, whether attended or not, imported or entered manually.
- **Attendance / trip:** the owner's personal record of attending one match. A match has at most one attendance record; travel logistics are outside scope.
- **Competition:** the tournament a fixture belongs to: Primera División, Segunda División, Copa del Rey, Supercopa or another relevant competition. Promotion playoffs can be a phase of the relevant competition; do not force every fixture into a league.
- **Tier:** Elche's league division in a season, independent of the match competition. A Copa del Rey match can belong to a season in which Elche played in Segunda. Preserve historical division names where known.
- **Season:** edition period such as 2025/26, not inferred from calendar year.
- **Fixture designation:** the designated home and away clubs, independent of the venue. This does not imply stadium ownership; neutral-site fixtures are permitted.

## Core journeys and MVP

Visitors see a summary, browse trips, open trip details, explore a map, and open stadium visit histories. The owner signs in, browses locally stored Elche fixtures by season/competition, marks “Asistí a este partido”, and adds personal metadata. Manual fixture creation remains available for missing history. Imported fixtures alone never appear as trips.

- Home: a full-viewport map application with floating controls and panels for trips, stadiums and the existing summary (total trips, unique known stadiums, W/D/L from known results and coverage). All public interaction takes place over the map, with no page header, navbar, footer or content below. Panels have shareable URLs; legacy archive URLs open the corresponding map content. Admin and sign-in retain the conventional document layout. See [MAP_EXPERIENCE](MAP_EXPERIENCE.md) for the owner-approved UX-01/02/03 direction.
- Trips: chronology and details with known season, date, competition, opponent, home/away teams, score, venue/location, public notes and a subtle special-match distinction.
- Stadiums: all registered venues, with visited/pending filters, location and attended visits. Historical participants do not imply current tenancy.
- Map: markers for attended venues with coordinates, opening venue/visit information. Equivalent list navigation remains available.
- Admin: single-owner access; browse/filter fixture history, mark/unmark attendance, edit personal notes/special status, create/correct missing fixtures, and manage clubs/stadiums plus season/competition/tier references. Explicit import and repeat-sync actions follow provider selection. Confirm destructive actions and warn about plausible duplicates.
- Special match: one boolean, default false; notes explain significance.

Saving attendance publishes that trip immediately; unmarking removes it from the public archive without deleting the fixture. Personal notes/special status exist only on attendance. Imported and manual fixtures without attendance remain admin-only. There is no draft workflow; notes must be suitable for public display. The MVP is useful without photos, province shading, dedicated statistics pages or every suggested counter.

## Rules and incomplete history

- Every trip concerns Elche and an opponent, but unknown opponent identity is allowed. Repeat opponents and stadiums are expected. Never rewrite historical venues when a club moves.
- Missing date, season, competition, opponent, fixture designation, score, venue, geography, notes and photos are allowed. Show unknown values honestly. When home/away designation is unknown, leave both teams and the oriented score unassigned and preserve partial fixture knowledge in factual annotations (separate from personal attendance notes); never guess the side. Such notes do not contribute to structured opponent/result statistics.
- Record exact dates only when known. Describe month/year-only knowledge in notes until partial-date support is justified. Put undated trips in an explicit group after dated trips, with stable ordering; never invent January 1 dates.
- Unknown venues/locations are excluded from relevant unique counts, not trip totals. Missing coordinates omit a marker, not a trip; show map coverage.
- Unknown results are excluded from W/D/L and goal totals. Show coverage, e.g. results known for 8 of 10 trips.
- Score means final played goals, including extra time and excluding shootout kicks. MVP W/D/L follows that score: a shootout-decided drawn match remains a draw in these totals. Explain progression in factual fixture annotations if needed. Scheduled, postponed, cancelled and abandoned fixtures must not contribute to completed-result totals; a scheduled 0–0 is never a result.
- Geography describes the stadium, not the club headquarters. Include islands and autonomous cities when relevant.
- Do not reject duplicates solely on date/opponent; incomplete history and genuine repeat fixtures need human judgment.

## Explicitly deferred

Photo uploads/galleries; province/community shading and geographic statistics; dedicated statistics page and advanced public filters; partial dates; structured shootouts; travel costs/routes; stadium tenancy/name histories; achievements; multiple users; public accounts/comments; live scores and runtime external football API calls; offline support.

## Public links and club identity

Trips and stadiums use readable, stable links established at creation. Correcting dates or renaming a club/stadium does not change existing links. Club crests are optional decoration with a readable fallback; no crest is required for the application identity. Each trip may eventually have multiple photos, each belonging to that trip; photo functionality remains post-MVP.

## Historical fixture import

Target history is approximately 2018 onward, across all relevant competitions. Obtain fixtures from a provider, persist them locally, browse them, select attendance, then add personal memories. Public pages must work during provider failure, pricing changes or replacement. Provider coverage is not presumed complete; manual fixtures and corrections remain essential.

Provider selection is a separate focused task comparing Primera, Segunda, Primera Federación/historical lower tiers, Copa del Rey, playoffs, historical depth, dates, scores, teams, venues, rate/free-tier limits, and licensing/permitted long-term persistence and public display. Do not select or integrate a provider during planning or Foundation. Missing coverage must be visible rather than silently treated as no fixtures.

Attendance percentages and most-travelled seasons are optional later statistics, never stored counters. Imported coverage may be partial: label denominators as known fixtures until season/competition coverage and fixture status have been verified. Define away as Elche's fixture designation, not stadium ownership; do not count unknown designations as away.

## Remaining review points

All attendance notes are public. Unknown opponent/designation is permitted with the limitations above; neutral-site attendance belongs in the archive. No external provider decision blocks Foundation. Provider coverage, persistence rights and mapping must be resolved before import implementation.
