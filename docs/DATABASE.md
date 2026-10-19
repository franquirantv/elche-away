# Database

Milestone 2 implements the seven core tables in `src/db/schema.ts` with a reviewed initial migration under `drizzle/`. Milestone 4c adds import mappings; Milestone 5 adds club crest object keys and recoverable Storage cleanup; photos remain planned. PostgreSQL with Drizzle. Domain tables use UUID primary keys and created/updated timestamps (`timestamptz`); application writes maintain updated time. Avoid database extensions unless required.

## Entities and domain decision

| Table | Important fields | Rules |
| --- | --- | --- |
| clubs | id, name, slug (required), crest_object_key?, legacy crest_path? | Stable organization identity, no stadium FK. Names need not be unique. |
| stadiums | id, slug, name (required), city?, province_code?, latitude?, longitude? | Physical venue, no owning-club FK. |
| competitions | id, name (required) | Tournament, not Elche's tier. No edition/membership tables. |
| tiers | id, name (required), level (required positive integer) | Historical division label and pyramid level; level is not unique across historical names. |
| seasons | id, label (required unique), start_year (required), elche_tier_id? | Direct FK to tiers, Elche only; no generic club membership table. |
| matches | id, home_club_id?, away_club_id?, home_score?, away_score?, played_on?, season_id?, competition_id?, stadium_id?, phase?, status, factual_notes?, facts_locked | Fixture facts for attended and unattended fixtures. |
| attendance | match_id (PK/FK), slug (required unique), notes?, is_special (default false), created_at, updated_at | Zero or one personal record per match; no user_id, id surrogate or attended boolean. |

`?` means nullable; required unless marked otherwise. Empty optional text becomes null. Domain tables have UUID IDs and timestamps except attendance, whose UUID primary key is match_id. One stable configured club ID identifies Elche, independent of name/slug; prevent its deletion.

**A: one matches table with attended boolean and personal fields** saves one join/table, but requires conditional checks clearing notes/special status on unmarking, later photo guards, and stronger coupling between imports and personal writes. **B: matches plus attendance** adds one small join but guarantees one personal record per match, keeps imports away from personal fields, and gives photos a proper attendance parent. Choose B for these concrete integrity benefits; public “trip” is the joined attended view, not another table. No multi-user model.

## Fixtures and season tier

Use conventional home/away clubs and scores. Derive opponent, Elche designation, goals for/against and outcome; do not persist duplicates. Neutral venues do not change fixture designation.

- Known designation: exactly one populated side is Elche; opponent may be null. Both populated club IDs must differ (null-safe SQL CHECK).
- Unknown designation: both club fields and scores null. Preserve known partial fixture facts in factual_notes, never guess or put personal memories on matches.
- Enforce Elche participation at the centralized server write boundary, including imports/manual corrections. A normal SQL CHECK cannot consult configured Elche identity. Validate every write path.
- season_id and competition_id remain nullable for incomplete history. Elche's tier is always joined through season.elche_tier_id, including cup fixtures. Never persist tier on each match or infer it from competition.
- tiers.level is the pyramid level, not a stable tournament identifier. Different historical tier names can share a level; no automatic era inference. Unknown season tier stays null.
- phase is optional factual text such as promotion playoff, semi-final or second leg. A playoff phase stays in its governing competition unless it genuinely is a separate tournament; no rounds/legs taxonomy yet.
- status is constrained to unknown (default), scheduled, postponed, finished, cancelled, abandoned. Only finished fixtures with known paired scores contribute to result statistics; importers map cautiously. Attendance at an abandoned match still counts as attendance, not a completed result.

## Slugs and crest reference

Clubs, stadiums and attendance records have required, unique, lowercase ASCII slugs (letters/digits separated by hyphens), unique within their own table. UUIDs remain primary/foreign keys. Slugs have a bounded length (maximum 160 characters), are validated server-side and constrained in SQL; a unique constraint resolves concurrent collisions.

Generate once on creation: club/stadium name; attendance slug from match date plus fixture names when known, otherwise a useful partial label or `viaje`. Transliterate accents and append `-2`, `-3`, etc. on collision, truncating the base to keep the limit. Never depend on names or dates being unique. Freeze the slug after creation in MVP, including when a name, date or opponent is corrected. Names remain editable. There is no slug-history table or redirect service. An exceptional later slug change must be deliberate and accepts old links returning 404 unless a concrete need justifies a one-off redirect.

`clubs.crest_object_key` is nullable and unique, constrained to `crests/<this-club-uuid>/<random-uuid>.webp`. Store only object identity; derive the public media path at read time. Only the separately authorized crest upload/removal flow writes it. Ordinary reference/import edits preserve it and cannot submit an arbitrary URL or key. Legacy `crest_path` remains unchanged for additive upgrade/rollback, but is no longer editable or used by the map. No club–stadium association is introduced; only unanimous known attended opponents select the crest.

Milestone 5 migration `0003_yielding_exodus.sql` adds that column/constraints and `storage_cleanup(object_key PK, not_before timestamptz)` with a due index. The ledger holds reserved uploads and cleanup intentions, never image bytes. No existing rows, slugs, attendance or auth tables change; no automatic backfill or deletion. An interrupted PUT is recoverable after one hour; retired keys are eligible immediately. Explicit cleanup locks each due intent, checks that no club references its key, deletes the object then its ledger row. Active-key intents are removed without deleting the image. Storage errors roll back the intent deletion for retry. See ARCHITECTURE for serialization and failure outcomes.

Apply the reviewed migration explicitly before starting this application version. Tests cover both empty installation and upgrade from migration 0002 with an existing legacy club. A rollback to older code can leave the additive column/table in place; it does not render new Storage crests. Do not drop the ledger to roll back: it carries recovery work.

## Nulls and constraints

- `played_on`: nullable PostgreSQL `date`; no timezone or fabricated day. Season is explicit, not date-derived.
- `home_score` and `away_score`: nullable integers; CHECK requires both null or both non-null and >= 0. Partial scores are not accepted in MVP. Both must be null when both club fields are null, because the score cannot be oriented. With Elche assigned and opponent unknown, an oriented score is allowed. Semantics follow PRODUCT.
- attendance.is_special: non-null boolean default false. No special category table.
- facts_locked: non-null boolean, explicitly true for manual fixtures and false for newly imported fixtures. Any local fixture correction locks the entire fixture against automatic overwrites; see sync rules below.
- Latitude/longitude: both null or both present; latitude -90..90, longitude -180..180. No PostGIS needed.
- `province_code`: nullable canonical Spanish province/territory code. Validate against a small maintained code mapping that includes Ceuta/Melilla; autonomous community is derived from it. No geographic tables yet.
- City is optional normalized display text; future unique-city counts use province + normalized city, excluding missing province/city rather than conflating names.
- Nonblank required names/labels enforced by validation and database checks. No uniqueness on club/stadium names or trip dates.

No club-stadium join table: clubs associated with a venue in this archive are derived through recorded trips, not asserted as current tenants. Venue fields describe a stable physical location; relocation creates a new row, correcting a mistaken location updates the existing row.

## Relationships and deletion

Nullable match foreign keys use ON DELETE RESTRICT; unknown never means silently deleted. Referenced clubs, stadiums, competitions and seasons require correction/reassignment before deletion; tier deletion is restricted by seasons. attendance.match_id is a required FK to matches with ON DELETE RESTRICT. Unmarking deletes attendance after confirmation (and future photo cleanup), retaining fixture facts and import identities. Its public trip link then returns 404; re-attendance is a new personal record with a newly generated slug. No slug-history system.

Do not delete a match with attendance or external identity mappings. Routine removal is unmarking attendance, not deleting fixture history. An imported fixture is protected from deletion both by the admin write helper and the source FK. 4c does not expose unlink/delete of provenance; any future removal flow must separately review the risk of recreation on reimport. No automatic source-driven deletions, merge framework or soft-delete system.

## External identities and synchronization (import milestone)

Milestone 4c adds `match_sources`: id, match_id (required FK, RESTRICT), provider (`openfootball`), external_fixture_id (computed source-version key, not a provider match ID), repository, path, fingerprint, revisions (nonempty array of accepted Git revisions), imported_at and last_synced_at. Unique (provider, external_fixture_id); index match_id. `fingerprint` hashes a normalized record in a fixed field order; external_fixture_id hashes repository, path and that normalized record. Revision is excluded from identity so an identical record in a later revision resolves the existing mapping; every accepted revision is retained. The same record in another path/repository is unseen and requires confirmation. A changed normalized record creates a new version mapping only after owner confirmation; older mappings remain linked to the same local UUID.

No raw file or personal metadata is stored in the provenance table. Hashes identify source record versions only, never permanent football identity. The admin supplies repository/path/revision for the uploaded local file; the application validates syntax but does not fetch GitHub to certify the claimed revision.

Deduplication order:

1. Existing source identity resolves the local match. Repeat imports update that match only when facts are unlocked; never create another attendance or overwrite personal fields.
2. An unseen identity (including changed IDs/new provider) is reconciled using mapped local teams, season, competition, exact date and phase where available. These are candidate hints, never a unique natural key: postponements, double fixtures and incomplete dates make them unsafe.
3. Present likely matches and unresolved entities for owner confirmation before linking, creating or skipping. Unknown/ambiguous identity is not permission to auto-create duplicates or fuzzy-match names. Confirm new records in the import review; retain old mappings when an ID changes.
4. Persist the selected mapping and fixture change transactionally. Unique-identity conflicts from retries/concurrent actions trigger re-read, not duplicate creation. Revalidate candidates when applying the reviewed batch.

Map external clubs, venues, competitions and seasons to local IDs at the import boundary. Existing local reference names, crest paths, venue geography and season tiers are not automatically overwritten by sync; proposed reference corrections require owner review. Start with explicit per-import mappings and owner confirmation; do not add a generic external-entity identity framework unless repeated reconciliation proves it useful. Unknown stadium remains null; never create a venue from club identity. Mapping rounds/tier labels must not turn a cup into a league or overwrite season tier without review.

Local corrections are deliberately simple: editing fixture facts sets facts_locked=true, preserving all fixture facts on later syncs. Attendance edits do not lock fixture facts. The 4c importer never replaces or unlocks a locked fixture: linking records provenance only, or the owner skips the record. Further corrections use 4a. No per-field provenance, raw payload archive or override tables initially. Import actions never change attendance, notes, special status, slugs or photos; omission from a provider response never deletes local records. Provider failure leaves existing records usable.

## Indexes and derived data

PKs, unique slugs/season labels and source identity constraints supply indexes. Add matches indexes on stadium_id, home_club_id, away_club_id and (played_on DESC NULLS LAST, id). Admin fixture filtering justifies (season_id, competition_id). Attendance PK serves the join; add no duplicate index. No geospatial/search indexes or stored counters.

All public trip, venue, map and personal-stat queries require attendance joined to matches. Referenced-but-unattended venues do not become visited venues. Result statistics require finished status, known scores and Elche designation. Compute attendance totals, unique venues, W/D/L, goals and frequent opponents locally. Future percentages compare attended qualifying fixtures with known qualifying fixtures and disclose incomplete coverage; do not claim full season totals from a partial import.

## Photos later

**Attendance (public Trip) 1 → N TripPhoto**, zero or more per attendance. Add trip_photos only post-MVP: id, attendance_match_id (required FK to attendance.match_id), storage object key, caption?, alt_text, sort_order, created_at. Index the FK and use RESTRICT while objects exist. No table or storage integration in the initial migration, and no photos attached to unattended fixtures. Delete remote objects before metadata/attendance removal so failures remain retryable; reconcile abandoned uploads manually. SQL and object storage cannot share one transaction.

## Migration discipline

Generate versioned Drizzle SQL and inspect it. Test constraints and upgrades on disposable PostgreSQL with synthetic records covering unknown values, repeat stadiums and both fixture designations, attendance isolation and season-tier/competition independence. Import milestone tests cover repeat syncs, remapped IDs, ambiguous candidates, local locks and provider failure. Use transactions for related writes where appropriate; verify selected Neon adapter supports the intended transaction API. Prefer additive compatible changes, backfill deliberately, then tighten constraints. Run production migrations as a deliberate release step, never in requests or every preview build. Back up before destructive operations and document recovery. Use the explicit scripts documented in README for generation, development/test migration and synthetic seeding. No request/build applies migrations. Drizzle metadata JSON stores schema snapshots only, never archive data.

## Implemented boundaries (Milestone 2)

- Node-postgres (`pg`) with Drizzle provides real transactions/savepoints. Application reads use the pooled connection; migrations/seed/tests use direct connections. TLS certificate/hostname verification is explicit for Neon SSL connections.
- Local commands validate that development pooled/direct URLs match and testing targets another database. They refuse production/Vercel execution; credential ownership still requires correct nonproduction configuration by the owner.
- `src/lib/identity.ts` defines the stable Elche UUID used by synthetic fixtures and future write validation. No football results or historical tier membership are claimed by the seed.
- Synthetic seed inputs live in TypeScript solely for database insertion. Seed operations are transactional, additive and repeatable, preserving existing IDs/slugs/corrections. No reset or alternative persistence exists.
- Elche-participation validation is shared by synthetic seeding and Milestone 4a manual fixture writes. Administrative writes require the existing owner authorization; no public mutation endpoints exist. Referenced Elche deletion is additionally prevented by FK constraints; future reference management must reject deletion of the configured Elche even without matches.
- Read modules join attendance before exposing trips/visited venues. Build requires no database access; missing/broken runtime configuration fails explicitly rather than returning synthetic or empty fallback data.
- Initial SQL permits only trusted, flat `/crests/` file references with supported image extensions. No assets/uploads are introduced.

## Milestone 3 reference editing and managed Auth

No public-domain schema change is required. Reference mutations use existing tables/constraints, explicit owner authorization, nullable normalization and immutable existing slugs. Elche deletion is refused in the write helper even if no fixtures reference it. Competition/season/tier edits remain independent of fixture attendance.

Neon Auth owns users, accounts and sessions under its managed `neon_auth` schema; our Drizzle migrations/seed do not manage those tables or create a second local auth schema. No user_id or role table is added to the single-owner domain. Application admin authorization is an environment-configured Neon user ID for each branch, not a database role flag.

## Milestone 4a local management

No schema migration is needed. Manual creates/corrections set `facts_locked=true`. Attendance writes never update fixture facts; fixture writes never change personal notes, special status or existing slugs. Writes lock the parent match within a transaction, serializing attendance creation/removal and match deletion. Unmarking removes attendance only; match deletion refuses attended fixtures. Plausible duplicates (equal date, sides, season and competition, including nulls) require explicit confirmation rather than a uniqueness constraint. Attendance slug collisions use the existing unique constraint and bounded retries.


## Milestone 4c import acceptance and concurrency

The bounded preview covers up to 40 Elche records from a file of at most 350000 UTF-8 bytes / 2000 records. References are mapped explicitly for each batch. Absent incoming fields preserve known local facts; unknown incoming status preserves a known status. Imported fixtures have `facts_locked=false`; later 4a edits set it true. Final-result interpretation requires the owner to confirm played scores including extra time and excluding shootouts; otherwise status stays unknown. Nothing infers attendance or stadium from a fixture/team.

Every unseen record version needs an explicit target: existing candidate, new fixture or skip. Candidates include the selected season and incomplete fixtures without a season; previous source mappings resolve even across a locally corrected season. Date, teams and round only suggest conflicts, never establish a unique match. The preview distinguishes new, unchanged, update, protected and conflict. If teams change while incoming goals are absent and local goals are known, block apply as a manual conflict rather than reorienting the old result. Two rows cannot target the same existing local match in one batch; duplicate normalized source rows are rejected.

Apply verifies a server-signed preview with a 30-minute expiry, repeats domain/reference validation and compares a fresh snapshot of candidates, references and source links. It locks `matches` and `match_sources` in SHARE ROW EXCLUSIVE mode inside the transaction, serializing applies with manual writes. A stale preview cannot apply. The short bounded batch is all-or-nothing: failures roll back fixtures and links together; generate a fresh preview to retry or continue from the displayed next offset. Omitted rows and records absent from a newer source never delete local data. History and attendance stay independent.

Migration `0001_hesitant_longshot.sql` is additive, needs no backfill and leaves the seven existing domain tables untouched. Apply it explicitly before running this code; rolling the application back can leave the unused table in place. Do not drop mappings or reset data to roll back an import: use reviewed local corrections. Auth schema is unchanged.


## Global import receipts and proposed references (4c revision)

Migration `0002_panoramic_darkhawk.sql` adds `import_batches` only: UUID id, plan_id, batch_index, plan_hash, after_snapshot, JSON result (operational batch outcome) and applied_at. Unique (plan_id, batch_index) makes a committed batch retry return the same outcome without repeating reference, match or source writes. These are execution receipts, not stored domain statistics or an unattended job queue. The hash binds the complete frozen global decisions; a different plan cannot claim an old receipt.

The global preview has no database writes. Virtual reference IDs become real only in confirmed batch transactions, with explicit club/season/competition creation; season tiers and venue references remain untouched/null. IDs are frozen in the signed plan, reused across batches and recovery. Rechecks use existing exact references; ambiguous names require manual selection. Multiple source spellings may be explicitly assigned to one proposed new reference before any write; the shared frozen UUID is created once. No reference name, slug, crest, geography or tier is overwritten by the importer. Historical exact fixture links also help preserve club mappings after local reference renames.

A global apply locks reference tables, matches, match_sources and import_batches in SHARE ROW EXCLUSIVE mode, checks the approved checkpoint, creates that batch's references, then invokes the existing reconciliation engine. The transaction commits its receipt with the resulting checkpoint. A failed batch rolls back all its writes; earlier receipts and mutations remain. A lost response can safely replay the original signed request: it reads the receipt without writing again, and the next batch still validates its checkpoint. Progress recovery requires an authorized explicit action and never applies anything by itself. No batches can be skipped/reordered, and unresolved later decisions prevent initial global approval.

Snapshots cover fixture/reference/source state (not attendance notes); legitimate local edits during a stopped execution require a new global review. Resume uses the last committed checkpoint, not an unconditional fresh baseline. Receipt schema is additive, needs no backfill, and can remain in place when rolling application code back. Do not delete receipts or source links to retry an import. No production migration is authorized by this feature.
