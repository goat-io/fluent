---
name: promote-candidate
description: "Move an LLM-proposed wiki draft from narratives/candidates/ into the live wiki. Strips candidate frontmatter fields, sets ownership: shared, runs migration if applicable, appends promote event to log + telemetry."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /promote-candidate

Phase 4 + Phase 6. Closes the loop: candidate → live wiki.

## Invocation

```
/promote-candidate <candidate-path>
```

## Workflow

1. Read the candidate file. Extract:
   - `target-path:` (where it lands in the live wiki)
   - `source:` (provenance — keep)
   - `proposed-by:`, `review-notes:`, `target-path:` (drop after move)
2. Verify the candidate's `ownership` is `llm` and `status` is `candidate`
3. Move the file to `target-path`:
   - Strip `status: candidate` → `status: active` (or whichever was intended)
   - Strip `ownership: llm` → `ownership: shared`
   - Strip `proposed-by`, `review-notes`, `target-path`
   - Update `last-updated` to today
4. If the candidate is a schema change (under `narratives/candidates/brain/schema/`):
   - Move schema file to `brain/schema/`
   - Move migration files to `brain/schema/migrations/`
   - Run migration with `--dry-run`, surface output
   - Run migration for real (only after user OK)
   - Append entry to `brain/schema/CHANGELOG.md`
   - Run `make build` to regenerate `kinds-registry.json`
5. Append to `narratives/log.md`: `## [date] promote | <name> | <target-path>`
6. Emit telemetry event: `kind: candidate-promote, target-path: ..., source: ...`
7. Trigger reindex (`brain index`)
8. Confirm to user: one-line summary + new path

## Anti-patterns

- Promoting a candidate that has `_TBD:` markers without resolving them
- Promoting without reading `review-notes:` if the human added any
- Promoting schema changes without dry-run first
- Forgetting the log entry (breaks chronology)

## Related

- `/discard-candidate` for rejection
- `/propose-*` skills produce the candidates this consumes
- `narratives/candidates/README.md` — full lifecycle
