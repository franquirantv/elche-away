---
name: database-change
description: Plan or implement a persisted schema/query migration for Elche Away; planning requests produce proposals only, never migrations or production writes.
---

# Database Change

1. Read root `AGENTS.md`, relevant DATABASE sections, and only the schema/queries/migrations affected by the request. Check consumers and existing migration naming/tooling before editing.
2. State the invariant, compatibility impact and deletion/backfill consequences. Avoid duplicate persisted facts. If the task is planning-only, stop at the reviewable proposal.
3. For authorized implementation, change the Drizzle schema and generate a versioned migration with established tooling. Inspect SQL for destructive operations, null handling, constraints and environment targeting. Never use schema push or silently reset data.
4. Apply on disposable nonproduction PostgreSQL and exercise the affected behavior with meaningful data: unknown values, repeated visits and reference deletion as relevant. Verify upgrades from the prior schema, not just creation from empty. Check transaction support of the chosen adapter when used.
5. Update affected typed queries and the canonical DATABASE doc. Run AGENTS checks and inspect schema/SQL diff together. Describe data preservation, rollout order, backfill and recovery when relevant.
6. Do not run against production merely because generation/testing passed. Production migration must be an explicitly authorized release action with verified target and appropriate backup. Stop on unexpected destructive SQL or uncertain data ownership; do not retry by deleting data.
