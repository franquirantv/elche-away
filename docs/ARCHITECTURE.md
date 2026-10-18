# Proposed architecture

Status: Foundation is implemented with Next.js, React, strict TypeScript and Tailwind; Milestone 2 adds PostgreSQL/Drizzle read-only trips and stadiums; auth, imports and deployment remain planned. Product scope lives in PRODUCT; relational rules live in DATABASE. The owner configured nonproduction Neon development/testing branches; no production or deployment has been provisioned.

## One application

Keep Next.js App Router, TypeScript, Tailwind, Neon PostgreSQL, Drizzle and Vercel. One deployment handles public rendering and private editing. A real relational database fits repeated visits and independent venues; SQLite would reduce services locally but complicate durable writes on the chosen serverless host. No separate backend, GraphQL, Redis, queue, search service or Docker requirement.

Use Node runtime. Server Components call narrow server-only query functions directly, without fetching the application's own HTTP endpoints. Client Components handle only interaction such as the map. Server Actions handle forms; Route Handlers exist only for required HTTP integrations such as OAuth callbacks. Validate input and authorize each protected server entry point. Public query functions return only display fields and require attendance when selecting trips, visited stadiums, markers or personal statistics. Unattended fixtures stay admin-only. Keep domain calculations outside React components.

Proposed structure (create only as features need it):

```text
src/app/(public)/           home, trips/[slug], stadiums/[slug], map
src/app/admin/              protected pages, colocated forms/actions
src/components/             genuinely shared UI
src/db/                     server-only client, schema, focused queries
src/server/                 auth, authorized operations, validation
src/lib/                    pure domain calculations and geography mapping
drizzle/                   reviewed SQL migrations (at repository root)
tests/                     meaningful cross-feature/integration checks
```

Initially use explicit request-time public reads and uncached admin reads. Avoid accidental database-dependent build prerendering. Successful writes must appear on subsequent reads; introduce caching/revalidation only when needed. No generic repository/service interfaces or global client state framework.

## Public URLs and identity

Use `/` for Home, `/trips` and `/trips/[slug]`, `/stadiums` and `/stadiums/[slug]`, and `/map`. Keep these simple English route segments despite Spanish public labels. UUIDs remain internal identity and foreign keys; detail pages resolve a unique slug and unknown slugs return 404. No public club detail route is required in MVP, though clubs have slugs for stable asset references/future use.

Generate slugs once, resolve collisions under a database unique constraint, and never regenerate them on edits. Date/opponent corrections and stadium renames preserve URLs. No slug editor/history/redirect infrastructure in MVP. DATABASE owns the exact slug policy. Admin mutations use UUIDs and still authorize and validate all input; readable URLs are not access control.

Optional club crest references initially point only to trusted repository-managed `/crests/` assets, with a text fallback. This does not choose a storage provider or introduce uploads. Core branding must not depend on the Elche crest or other copyrighted visuals. Matches hold fixture facts; attendance is an optional one-to-one personal record, exposed publicly as a trip. Attendance → TripPhoto is one-to-many; its table and media integration remain post-MVP.

## Fixture import boundary

PostgreSQL is the runtime source of truth. Neither public rendering nor normal admin browsing calls a football provider. Keep provider calls, credentials, response parsing and external-to-local mapping in a small server-only import module under src/server when that milestone begins. Convert responses into typed local fixture inputs and use the same domain validation as manual writes. Do not create a provider abstraction framework before comparing an actual provider; contain its client and mappings so replacement does not alter public components or domain identity.

Initial flow: authenticated owner requests a bounded season/competition batch, reviews mappings/candidates/changes, and explicitly applies it. Validate provider data as untrusted input, keep credentials out of the browser/logs, and return sanitized preview data. Reauthorize and validate the apply request server-side; a browser preview is not trusted write authority. Use provider-supported pagination and bounded chunks within deployment limits; partial failures report progress and retry safely through persistent identity mappings. No cron, webhook, queue, worker or live-result integration. Do not store raw payloads by default.

DATABASE owns deduplication and correction rules: source identity first, conservative candidate reconciliation for new IDs, transactional apply, and whole-fixture facts_locked protection after a manual correction. Sync cannot mutate attendance, personal notes, special status, slugs or photo records. A missing provider record is never a deletion instruction. External identifiers are opaque mappings, not local identity. Keep old mappings when providers/IDs change. Source errors leave the archive unchanged and usable.

Provider research is a separate milestone comparing Primera, Segunda, Primera Federación/historical lower tiers, Copa del Rey, playoff coverage, history from approximately 2018, dates/scores/teams/stadiums, rate/free-tier limits, and licensing for persistent local storage and public display (including after subscription/provider changes). No provider is selected now. If rights or coverage do not fit, retain manual fixtures and reassess provider scope; do not silently substitute a runtime API dependency or scrape restricted data.

Use a lightweight tiers table and nullable seasons.elche_tier_id. Competition is a fixture fact; Elche's division belongs to its season. No multi-club membership service/table, competition edition model or persisted statistics. Manual tier correction is owner-controlled, not inferred from a cup response.

## Authentication and authorization

Recommend one OAuth provider already used by the owner (GitHub or Google), with one immutable provider account ID allowed server-side. Deny other identities and recheck owner identity at each protected operation via `requireAdmin()`. Do not authorize solely by display name/email, navigation, middleware or an admin layout. Session handling should use a maintained library with secure HttpOnly cookies, expiry, OAuth state/PKCE and CSRF protections, never handwritten crypto/OAuth. Keep admin/session responses out of shared caches.

| Option | Assessment |
| --- | --- |
| OAuth plus maintained library | Recommended; no local passwords or email delivery. |
| Local password | Adds password storage, recovery and brute-force defenses. |
| Magic link | Adds email delivery and token lifecycle for one owner. |
| Managed identity service | Useful later, but extra account/service for little current benefit. |

Library remains unresolved: Auth.js can support adapter-free cookie/JWT sessions, but its current Next.js installation docs specify a beta and link a Better Auth migration guide. Better Auth is a candidate, not the unexplained fixed choice in the old agent notes; evaluate supported session mode and required tables before installing. Prefer few tables, but not at the cost of maintained security. The provider/library decision is required for the authentication milestone, not foundation work. If the chosen library requires auth tables, document its owned schema separately. No custom role model or public signup UI. Vercel deployment protection is supplementary, not application authorization.

## Images (post-MVP)

| Option | Assessment |
| --- | --- |
| Vercel Blob | First candidate: fits the chosen host and public image delivery. |
| Cloudflare R2 | Portable object storage; extra account and delivery configuration. |
| Cloudinary | Strong transformations; broader than current needs. |
| PostgreSQL, repository, function disk | Unsuitable for runtime image binaries/durable upload storage. |

Select at the photo milestone after checking current quotas and privacy requirements. Store only metadata/object identity in PostgreSQL. Public web-sized copies are intentional publications; public URLs are not access control. Authorize token issuance, completion and deletion server-side; restrict size/types, verify actual image content and strip EXIF/location metadata before public storage. Reject SVG/arbitrary uploads. Direct uploads can avoid function body limits, but unvalidated originals must stay private/quarantined until safe publication; if the selected provider cannot support this simply, use bounded server-validated uploads. Keep originals outside the public app. SQL/storage cleanup is retryable and explicit (DATABASE); no worker service initially.

## Map comparison and recommendation

| Approach | Tradeoff |
| --- | --- |
| Leaflet with raster tiles | Recommended after comparison: simple markers/popups/touch interaction fit this archive. |
| MapLibre GL JS with vector tiles | Rich styling and vector rendering; more style/source/WebGL setup than needed. |
| Custom SVG Spain map | No tile dependency and strong visual control; projection, insets, zoom and interaction become custom work. |
| Google Maps / Mapbox | Capable managed platforms; little benefit without routing/search requirements. |

Choose the tile provider separately at implementation. Standard OpenStreetMap raster tiles may fit very low traffic only under its attribution, caching, Referer and no-prefetch policy; they are best-effort, not guaranteed free hosting. Keep tile URL configurable and preserve a list fallback. Check current policy/limits before launch.

Load the interactive renderer only on the client, passing minimal visited-stadium data from the server. One marker per stadium with visit count and links; any special appearance derives from associated special trips. Coordinates are manually entered, no geocoding service. Unknown coordinates omit only the marker. Include islands/autonomous cities when visited. Province fills and licensed/simplified boundary datasets are deferred; no PostGIS.

## Environments and releases

One Vercel project; separate local, preview and production secrets/data. Local development uses a nonproduction Neon database/branch. Preview writes require isolated disposable data, otherwise disable them. Start with a shared synthetic nonproduction database only if work is serialized; add branch-per-preview when concurrent schema changes justify it. Branching production copies data too: do not propagate private/auth data to previews.

Use `pg` (node-postgres) with the Drizzle node-postgres adapter: current Neon guidance for Node/Vercel and full transaction/savepoint support fit this application. This replaces the provisional serverless-driver suggestion; no Edge/HTTP transport is required. Keep a small reused runtime pool; evaluate Vercel pool lifecycle integration at deployment, without installing hosting-specific runtime services now. Keep connection/auth/storage secrets server-only. Environment configuration should fail clearly when required secrets are missing; public assets need no database credentials. Keep selected function/database regions close. Verify current free-tier eligibility, quotas and limits before provisioning; no guaranteed zero-cost assumption.

Run reviewed migrations as an explicit release step after disposable-database validation, not inside requests or every Vercel build. Prefer compatible additive changes across rollout/rollback. Retain SQL exports and original photos separately and test a restore before relying on the archive; provider retention alone is not the backup plan. Preview photo storage must be separate from production. Database commands are explicit local scripts; no automatic deployment or new service provisioning occurs. See README for actual nonproduction connection keys and commands.

## Independent review synthesis

Keep the preferred stack; remove the premature Better Auth commitment. Match/attendance separation is now justified by the all-fixture import requirement; do not add another trip table. Avoid club-stadium tenancy tables, generic league membership, geographic tables, stored counters and generic data layers. Map remains MVP; photos, polygon shading and broad statistics wait. Recheck service choices at the milestone that actually needs them.

## Primary references

Checked during planning; versions, plans and policies must be rechecked at implementation.

- [Next.js server boundaries](https://nextjs.org/docs/app/guides/backend-for-frontend), [authorization in mutations](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Neon with Next.js](https://neon.com/docs/guides/nextjs), [serverless driver](https://neon.com/docs/serverless/serverless-driver), [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [Auth.js installation](https://authjs.dev/getting-started/installation), [access restriction](https://authjs.dev/guides/restricting-user-access), [Better Auth](https://better-auth.com/docs/introduction)
- [Vercel Blob](https://vercel.com/docs/vercel-blob), [client uploads](https://vercel.com/docs/vercel-blob/client-upload), [R2](https://developers.cloudflare.com/r2/), [Cloudinary uploads](https://cloudinary.com/documentation/image_upload_api_reference)
- [Leaflet](https://leafletjs.com/), [MapLibre](https://maplibre.org/maplibre-gl-js/docs/), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [Vercel environments](https://vercel.com/docs/deployments/environments), [Hobby plan](https://vercel.com/docs/plans/hobby)
