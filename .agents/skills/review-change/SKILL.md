---
name: review-change
description: Review an Elche Away diff for concrete regressions, domain errors and security gaps; does not authorize implementation or unrelated cleanup.
---

# Review Change

1. Read root `AGENTS.md`, establish the requested comparison/base, and inspect status plus the diff, including relevant new files. Do not scan the entire repository.
2. Follow changed code to direct callers and relevant tests. Read only the domain, architecture, database or design sections needed to assess the change.
3. Check actual behavior against task scope: unknown historical data, repeated venues, derived results, server authorization, public data exposure and migration/deletion safety where affected. Look for duplicated state and unnecessary services.
4. Run targeted existing checks if useful and available. Avoid inventing dependencies or tests that merely reproduce implementation. For docs-only changes, check consistency and links; do not report absent application checks as passing.
5. Report actionable findings first, ordered by impact, with file/line references, a concrete failure scenario and suggested correction. Separate unverified concerns from demonstrated defects. If none are found, say so and state verification limits. Do not edit unrelated code during a review-only task.
