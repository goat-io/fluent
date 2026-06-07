---
name: propose-kind
description: "Draft a new Brain JSON Schema kind (or extend an existing one with a new field) from observed usage patterns. Output is a PR-shaped diff: schema file + migration script + 2-3 examples + rationale. Auto-invoked by /brain-evolve when ad-hoc field clusters or validation failures surface."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /propose-kind

Phase 4 sub-skill. Takes a signal — usually an ad-hoc field cluster like `repo.data-classification` used in 7 entries — and drafts the schema change that formalizes it.

## When to invoke

- Auto-dispatched by `/brain-evolve` when `propose-kind` proposals appear
- Manual: `/propose-kind <kind-name>` to draft a brand-new kind
- Manual: `/propose-kind <kind>.<field>` to extend an existing kind with a field

## Inputs

Either:
- A signal object (`{kind:"propose-kind", subject:"repo.data-classification", examples:[…]}` from `brain evolve scan`)
- A user description: *"add a kind for `risk` with fields severity, owner, mitigations"*
- A raw source file: *"propose a kind that fits the entries in `raw/sources/customers.csv`"*

## Outputs (PR-shaped)

For a NEW kind `<name>`:
1. `brain/schema/<name>.schema.json` — JSON Schema 2020 draft (use existing kinds as template)
2. `brain/schema/migrations/NNNN-add-<name>-kind.md` — rationale doc (must include at least one non-company-specific example proving generality, per principle 2)
3. `brain/schema/migrations/NNNN-add-<name>-kind.py` — idempotent script with `--dry-run`
4. 2-3 example entries under `narratives/candidates/catalog/<name>/<example-id>/`
5. Append to `brain/schema/CHANGELOG.md`

For a NEW FIELD on existing `<kind>.<field>`:
1. Diff the existing `brain/schema/<kind>.schema.json` (do NOT auto-apply; output the diff)
2. `brain/schema/migrations/NNNN-add-<kind>-<field>.{md,py}`
3. Update CHANGELOG

## Quality bar

- **Generality test:** rationale doc must show one non-company-specific use case. If you can't think of one, the field is too instance-specific — push back to `_instance/` instead.
- **Backwards compat:** new fields must be optional initially (`required: []` for the new field). Tighten only when adoption proves stable (per principle 3).
- **Open by default:** if the field is enum-like, declare it as a free string first. Lint promotes to enum after threshold (per principle 3).
- **Cite the signal:** include the score, occurrences, and example paths from the proposal so future readers know the data behind the change.
- **Migration must be idempotent:** safe to run twice. Always include `--dry-run`.

## Workflow

1. Read the proposal (signal or user input).
2. Read 2-3 example entries from the cluster (`brain schema examples <kind>` if extending).
3. Draft the schema change. Look at existing schemas in `brain/schema/` as templates.
4. Write all artifacts under `narratives/candidates/` mirroring the target paths (do NOT touch `brain/schema/` directly — that's the human-approved layer).
5. Append `## [date] evolve-proposal | propose-kind <subject> | narratives/candidates/...` to `narratives/log.md`.
6. Surface to user: one-line summary + paths to drafts.
7. Wait for `/promote-candidate <path>` or `/discard-candidate <path>`.

## Promotion (manual, by human)

`/promote-candidate <path>`:
- Schema files move from `narratives/candidates/brain/schema/` → `brain/schema/`
- Migration files move into `brain/schema/migrations/`
- Examples move into `catalog/<kind>/`
- Run the migration script with `--dry-run` first, then for real
- `make build` regenerates `kinds-registry.json`
- Lint should now show fewer ad-hoc-field clusters

## Anti-patterns

- Adding a kind for a one-off observation (need ≥3 instances per principle 2)
- Adding fields with `required: true` on first ship
- Forgetting the migration script (every change needs one for forward replay)
- Skipping the non-company-specific example in rationale (kills genericity)

## Related

- Plan §3.3 + §6 Phase 4
- `brain/skills/brain-evolve/SKILL.md` — dispatcher
- `tools/scripts/migrate-catalog-v2.py` — migration template
