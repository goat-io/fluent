---
name: "Migration 0001 — add kind: telemetry-event"
description: "Adds brain/schema/telemetry-event.schema.json. No data migration needed — telemetry events are written by Brain at runtime, not stored in catalog."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: llm
---

# Migration 0001 — add `kind: telemetry-event`

Phase 2 of brain-llm-wiki-evolution-plan.md.

## What this migration does

Adds the JSON Schema file `brain/schema/telemetry-event.schema.json`, which formalizes the event payload shape stored in `brain/telemetry/events.jsonl`.

No catalog data migration needed — telemetry events are runtime-only, not persisted as catalog entries.

## How to run

This migration is no-op at the data layer. The schema file itself is the migration.

```bash
# Verify the schema is loadable:
brain schema get telemetry-event

# Verify rollup picks up events:
brain telemetry log skill-complete '{"skill":"migration-test"}'
brain telemetry rollup
brain telemetry stats
```

## Rollback

Delete the schema file. Telemetry data files remain (gitignored WAL aside).

## Generality

Every wiki needs an event log. A non-company-specific adopter with a different domain (e.g., research notes) would emit different `kind` values but use the same envelope. The enum is extensible.
