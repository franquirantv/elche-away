# Implementation roadmap

Milestones 1 and 2 are complete. Milestone 3 is implemented pending real Google/owner acceptance; later milestones remain planned. Each milestone/sub-milestone is one focused Codex task; do not bundle adjacent work. Resolve decisions only before dependent tasks. No provider integration or provisioning during Foundation.

| Milestone | Testable result / acceptance |
| --- | --- |
| 0. Planning review | Record match/attendance separation, home/away fixtures, season tier vs competition, stable slugs, and Spanish Elche Away identity (“Donde tú vayas.”). No Foundation blocker. |
| 1. Foundation | Initialize approved stack, strict typing, responsive Spanish navigation/empty states and crest-independent styling. Define npm lint/typecheck/test/build scripts and lightweight CI. Mobile shell/checks work without production or football-provider credentials. No domain integration. |
| 2. Local data-backed archive (complete) | Reviewed initial migrations for clubs, stadiums, competitions, tiers, seasons, matches and attendance. Synthetic attended/unattended data renders public trips and visited stadiums correctly. Verify Elche participation, unknown fields, home/away scores/status, season-tier independence, stable slugs and exclusion of unattended fixtures. No source-mapping/photo tables or media integration yet. |
| 3. Owner access + reference editing (implemented; manual acceptance pending) | Approved Neon Auth + Google; explicit per-environment owner allowlist and reference forms including Elche tier by season. Unauthorized/wrong-owner requests fail at protected operations. Referenced data cannot be deleted. |
| 4a. Local fixture browser + attendance | Browse/filter PostgreSQL fixtures by season/competition, mark/unmark attendance, add public notes/special status. Manual fixture creation/correction works without any provider; local corrections lock facts. Test attendance isolation, stable slugs, repeat stadiums, deletion and authorization. |
| 4b. Provider research/selection | Focused official-source comparison of league/lower-tier/cup/playoff coverage, history from around 2018, dates/scores/teams/venues, quotas/rate limits and persistence/display rights. Deliver recommendation and coverage gaps for owner review, no integration/provisioning. If no provider fits, reassess import scope explicitly; core local flows remain usable. |
| 4c. Explicit fixture import + reconciliation | After provider approval, add match_sources migration and bounded admin preview/apply flow. Map references, reconcile new external IDs against local fixtures, confirm ambiguous candidates, and persist identity mappings. Verify repeat-import idempotence, retries/partial failure, changed provider IDs, local correction locks and preservation of attendance/slugs. Public reads remain provider-independent. No background jobs. |
| 4d. Attendance-based home summaries | Home totals derive from attendance joined to local matches. Verify finished-result rules, unknown-data coverage and unattended exclusion. Extra percentage/season statistics are optional later. |
| 5. Geographic exploration | Confirm current tile provider/policy; client-only visited-stadium markers, coordinate editing and list fallback. Repeated visits share a marker; missing coordinates keep list entries; unattended venues are absent. Check mobile interaction, attribution and tile failure. |
| 6. MVP release check | Isolated deployment environments, deliberate reviewed migrations, owner/public smoke checks and backup/restore rehearsal. Verify secrets, import credentials, preview isolation and provider-outage independence. Production data/actions require authorization. |

**MVP boundary: milestones 1–6, including 4a–4d.** Includes explicit historical import/attendance selection and marker map; excludes photos, province shading and expanded statistics. Provider feasibility gates 4c, never Foundation or manual local operation. Any manual-only release instead requires an explicit scope decision. Provisioning/release is not authorized by this plan.

## After MVP (separate tasks)

7. Photos: add Attendance (public Trip) 1 → N TripPhoto table; choose storage/privacy approach, then verified bounded upload/gallery/removal with retryable cleanup. Test unauthorized operations, invalid files and attendance removal with photos.
8. Statistics: add useful requested statistics from actual use. Attendance percentages/most-travelled season derive locally; distinguish incomplete provider coverage and qualifying finished/away fixtures from a complete season denominator. No stored counters or inferred complete coverage.
9. Province visualization: licensed simplified boundaries and derived visited geography, including islands/autonomous cities. Other polish follows concrete needs.

No multi-user roles, achievements, live football feeds, scheduled sync infrastructure or generic import/provenance framework without demonstrated need.
