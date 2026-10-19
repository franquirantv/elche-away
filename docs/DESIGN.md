# Visual and UX direction

## Hierarchy

Lead with **Elche Away** and the primary tagline **“Donde tú vayas.”** in Spanish, a small selection of totals, then recent trips and a geographic invitation. Navigation: Home, Trips, Stadiums, Map. A dedicated statistics destination comes later.

Trip cards prioritize opponent, score or “Result unknown,” date/season, then venue. Details show fixture designation, competition, geography, notes and a linked stadium. Stadium cards emphasize place and visit count; details list every visit. Special matches get a quiet accent and text label; avoid badges/achievement systems. Photos are a later enhancement, never required for a balanced layout.

## Relationship to the physical map

Use Elche-inspired green and white, charcoal text and restrained warm cork-toned accents. Travel references, stadium pins and a subtle paper/cork texture can connect the archive with the physical object. Avoid literal cork decoration behind dense content, excessive animation and reliance on a club crest or photography that has not been supplied/cleared. Clearly identify it as a personal fan archive, not an official Elche CF product. Core branding and layout must work without the Elche CF crest or any other copyrighted asset. Optional club crests can support fixture/stadium content when supplied; missing crests use accessible text/initials, and decorative images do not repeat adjacent club-name announcements.

Use a readable system font initially, simple spacing, and a small set of reusable cards/forms/buttons. No oversized component library or design-token program. Keep the home URL stable for a future printed QR code.

## Mobile and accessibility

Design single-column trips first, generous touch targets, visible focus and sufficient contrast. Never communicate result or special status through color alone. Map is the main surface on `/map`, displayed immediately with fixed peninsular Spain bounds. Overlay horizontal stadium cards at the bottom, synchronize pin/card selection, and keep attribution outside the overlay. Cards include a separate history link; unlocated stadiums remain readable and linked. Preserve a server-rendered list fallback. Allow pausing map gestures for page scrolling; horizontal card gestures must not drag the map. Respect reduced motion and keyboard navigation. Show missing-coordinate coverage. Include islands/autonomous cities when data warrants; avoid forcing all points into an unreadable mainland view.

Unknown dates/results are explicit labels, not blank broken cards. Keep chronology semantics consistent with PRODUCT. Loading, empty, failed-query and unavailable-map states explain what happened without exposing internals.

## Admin

Start admin with locally stored Elche fixtures, season/competition filters and a clear “Asistí a este partido” action. Unattended rows show fixture facts only; marking attendance enables personal notes and special status, with photos later. Unmarking confirms removal of the personal record while keeping the fixture. Provide “Añadir partido” for missing history and a separate explicit import/review flow once supported. Show source conflicts, unknown mappings and locked local corrections for review rather than quietly replacing data.

Use functional mobile-friendly forms, searchable/selectable existing references when needed, clear required/optional fields and a public-visibility reminder for attendance notes. Keep factual annotations distinct from personal memories. Season details show Elche's division separately from the fixture competition: a cup match must not look like a league match. Present conventional home/away team selectors and aligned scores; derive the opponent rather than asking for it again. A convenience default can place Elche away, but the owner must be able to swap sides or mark designation unknown (clearing both teams/scores with a warning if entered). Never infer designation from the stadium. Let the owner leave historical fields unknown. Slugs are generated once and are not editable in MVP; club names and optional trusted crest references remain editable. Show server validation next to fields, retain entered values after failure, and make save/delete outcomes clear. Require deliberate confirmation for deletion; show referenced-trip conflicts rather than removing history automatically. The public archive remains attendance-only and does not become a full results portal. Public pages have no editing controls except a discreet admin link if useful.

## Review before coding

Name, tagline and Spanish public language are decided. Supplied visual assets and featuring a personally significant match on Home are optional refinements, not implementation blockers. No logo, mockup, image generation or application components are part of this planning phase.
