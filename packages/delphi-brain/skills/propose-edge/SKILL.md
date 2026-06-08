---
name: propose-edge
description: "Promote a free-string edge type to a typed enum after N+ uses. Drafts the schema change to one or more kind schemas' dependsOn/relations enum lists. Auto-invoked by /brain-evolve when edge-pattern signals surface."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /propose-edge

Phase 4 sub-skill. When the same free-string edge value (e.g., `replaces`, `mitigates`, `documents`) appears 5+ times across catalog entries, this skill drafts the schema change that formalizes it as a typed value.

## When to invoke

- Auto-dispatched by `/brain-evolve` on `propose-edge` proposals
- Manual: `/propose-edge <value>` to inspect usage and draft promotion

## Workflow

1. Confirm count with `brain telemetry query "SELECT * FROM events WHERE kind='edge-pattern' AND value='<value>' "`
2. Identify which kinds use this edge (which schemas reference `dependsOn` or `relations`)
3. Draft schema diff: add `<value>` to the relevant enum or expand a free-string field's allowed values
4. Write migration script (lint validates new enum values)
5. Output as candidate under `narratives/candidates/brain/schema/`
6. Append to log + CHANGELOG draft

## Quality bar

- Same rules as `/propose-kind`: generality test, backwards compat, idempotent migration
- Edges must remain extensible — never close `additionalProperties` on dependsOn

## Related

- Plan §3.4 (edge openness)
- `/propose-kind` (same machinery, different target)
