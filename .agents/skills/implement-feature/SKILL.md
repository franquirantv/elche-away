---
name: implement-feature
description: Implement one scoped Elche Away feature after implementation is authorized; use for application changes, not planning-only requests.
---

# Implement Feature

1. Read root `AGENTS.md`. Identify the requested observable outcome and the matching ROADMAP milestone; do not absorb adjacent milestones.
2. Read only relevant docs: PRODUCT for behavior, DESIGN for UI, ARCHITECTURE for boundaries/services, DATABASE for persisted data. Locate existing implementation, direct callers and relevant tests with targeted searches; skip generated files and lockfile contents.
3. Reuse existing patterns. For a nontrivial task, state a short plan and the acceptance check. Delegate only genuinely independent analysis when worthwhile and authorized. Resolve only blocking ambiguity before dependent work.
4. Make the smallest coherent vertical change. Keep server validation and authorization at protected entry points. If schema changes are needed, follow the database-change workflow rather than inventing a migration process.
5. During implementation, run only tests or focused manual/browser checks for the changed behavior, including affected uncertainty/security boundaries, following AGENTS. Do not automatically run the full suite, build, repository-wide lint or typecheck per iteration. Reserve those gates for the latest PR head before merge; use passing CI instead of duplicating it locally. Resolve failures before integration. Do not repeat passing checks without a concrete reason.
6. Review the whole diff, including untracked files, for scope and regressions. Update canonical docs only for enduring decisions. Report behavior changed, evidence, and unavailable checks. Do not provision/publish external services merely because a feature is complete.
