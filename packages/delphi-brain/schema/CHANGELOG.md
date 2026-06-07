---
name: "Brain schema changelog"
description: "Append-only record of every Brain JSON Schema change with rationale, migration script reference, and backwards-compat note. Maintained by AI through /propose-kind / /propose-edge / /promote-candidate."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: llm
---

# Brain schema changelog

Append-only. Newest at bottom. Each entry references the migration script that applies the change.

## Format

```
## [YYYY-MM-DD] <change-type> | <subject> | <migration-path>

**Rationale:** why this change.
**Backwards compatible:** yes | no (with explanation if no).
**Generality:** non-company-specific use case proving the change is generic.
**Reverts:** previous changelog entry being undone, if applicable.
```

Change types: `new-kind`, `new-field`, `new-edge`, `enum-promotion`, `field-deprecate`, `kind-deprecate`, `migration-fix`.

## Entries

## [2026-05-13] new-kind | telemetry-event | (no migration — schema is read-only by Brain itself)

**Rationale:** Phase 2 of brain-llm-wiki-evolution-plan.md introduces the substrate for self-evolution. Captures every observation that can drive `/brain-evolve` proposals.
**Backwards compatible:** yes (additive).
**Generality:** any wiki built on Brain needs an event log to surface its own gaps. Not the company-specific.
**Reverts:** none.

## [2026-05-13] new-kind | action, experiment, signal, decision | brain/schema/migrations/0002-add-workflow-kinds.md

**Rationale:** Phase 8 of brain-llm-wiki-evolution-plan.md. Workflow primitives that turn Brain from a documentation pile into a workflow cockpit. Shared lifecycle base per §8 Q4 = (c).
**Backwards compatible:** yes (additive — no existing kinds modified).
**Generality:** every R&D org has actions, experiments, signals, decisions. Universal primitives.
**Reverts:** none.
