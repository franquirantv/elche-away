# Elche Away

Personal public archive of attended Elche CF away matches, with one owner's protected admin area. Milestones 1–3 are complete; keep changes scoped to the authorized milestone.

## Comunicación

- Responde al propietario del proyecto en español por defecto.
- Los resúmenes, planes, explicaciones, preguntas, decisiones arquitectónicas y resultados finales deben estar en español.
- El código, nombres de variables, funciones, tipos, tablas, commits y otros identificadores técnicos deben permanecer en inglés.
- Los textos visibles para los usuarios de Elche Away deben estar en español, salvo que se indique expresamente lo contrario.
- La documentación técnica existente puede mantenerse en inglés; no la traduzcas únicamente por esta norma.

## Frequent rules

- Proposed stack: Next.js App Router, strict TypeScript, Tailwind, PostgreSQL on Neon, Drizzle, Vercel. Service recommendations remain proposals pending review.
- Club != stadium != match != attendance. Matches hold fixture facts; one optional single-owner attendance record makes a public trip. Public archive queries require attendance. Repeat visits are valid; never infer venue from a club's current ground.
- Competition != Elche's season tier. Providers are import sources only: public reads use PostgreSQL. Imports must preserve attendance, personal metadata, stable local IDs/slugs and locally corrected facts.
- Unknown historical facts stay null. Never invent dates/scores or treat missing results as 0–0. Derive statistics.
- Default to Server Components; database access belongs in `src/db`, protected operations in `src/server`. Keep browser interactivity small. No separate backend or generic repository framework.
- Neon Auth verifies sessions; application admin access additionally requires exact configured `ADMIN_USER_ID`. Missing configuration denies access. Never grant admin to the first login, by email, or by client-supplied identity. Do not manage Neon's auth schema with Drizzle/seed.
- Validate input server-side. Authorize every protected read, mutation and upload operation. Layout/navigation checks alone are insufficient.
- Keep secrets out of client code, `NEXT_PUBLIC_*`, logs, fixtures and commits. Local/preview environments must never write to production services.
- Prefer strict types and existing patterns; avoid `any` and speculative abstractions. Keep diffs focused. Test behavior, domain rules and authorization boundaries.
- Commit reviewed Drizzle migrations for schema changes. No schema push or ad hoc production SQL. Test on disposable data; never silently reset data.

## Git workflow

- `main` always represents the latest stable, integrated state. Never implement a feature or milestone directly on `main`.
- Before new work, inspect Git status and branch. Create a dedicated branch from up-to-date `main`; confirm the correct branch before modifying code. Never switch branches if local changes could be lost; resolve that situation with the owner first.
- Use descriptive names such as `feature/milestone-3-auth`, `feature/milestone-4-trip-management`, `feature/milestone-5-map`, or `fix/...` for independent fixes. Do not mix unrelated features in one branch.
- Keep commits small and coherent, with descriptive English Conventional Commits-style messages. Update required README/documentation in the same branch.
- Before declaring a branch finished, run the applicable checks below and review the complete diff, including new files. Report the branch, commits created, verification results, and readiness for integration into `main`.
- Without the owner's explicit authorization, never merge into `main`, push, perform destructive rebases, force-push, or delete branches.

## Efficient workflow and checks

Read this file first, then only the relevant document and skill. Locate targeted files before reading them; inspect direct callers/tests. Skip generated output, lockfiles, dependencies and unrelated code. Use `rg`, falling back to `find` if unavailable. Delegate only meaningful independent reasoning, keep plans proportional, and repeat passing checks only when changes justify it.

For docs run `git diff --check`, inspect `git status --short`, and check links/consistency, including new untracked files. Update README.md in the same change when installation, commands, environment variables, main routes, requirements, external services or run instructions change; do not update it for internal-only changes.

Required commands are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. `npm test` creates a uniquely named temporary database on the TEST_DATABASE_URL server (requires CREATEDB), migrates/seeds only that database and runs PostgreSQL integration plus HTTP checks in an isolated test server (`.next-test`). It drops only its own temporary database, never resets or seeds the configured testing database. It requires distinct nonproduction development/testing connections; never substitute production or silently skip database checks. Code changes require applicable tests plus lint/typecheck; framework, routing, environment or dependency changes also require a build. Report unavailable checks honestly; do not install tools outside the authorized task.

## Read on demand

- Scope/domain: [PRODUCT](docs/PRODUCT.md)
- Boundaries/services/environments: [ARCHITECTURE](docs/ARCHITECTURE.md)
- Tables/constraints/migrations: [DATABASE](docs/DATABASE.md)
- Visual/UX work: [DESIGN](docs/DESIGN.md)
- Focused tasks/MVP boundary: [ROADMAP](docs/ROADMAP.md)
- Workflows: `.agents/skills/{implement-feature,review-change,database-change}/SKILL.md`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
