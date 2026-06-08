---
name: "Brain telemetry"
description: "Append-only event log + sqlite rollup that drives /brain-evolve. Both files are committed to git per §8 Q1 of the LLM-Wiki evolution plan."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: llm
---

# brain/telemetry/

Phase 2 of [brain-llm-wiki-evolution-plan.md](../../narratives/decisions/brain-llm-wiki-evolution-plan.md). Substrate for self-evolution.

## Files

- `events.jsonl` — append-only, one JSON object per line. Grep-friendly. Schema in `brain/schema/telemetry-event.schema.json`.
- `rollup.sqlite` — periodic aggregate. Built from events.jsonl via `brain telemetry rollup`. Read-only queries via `brain telemetry query "SELECT ..."`.

## Privacy warning (§8 Q1 = c)

Both files commit to git. Chat queries become permanent history. Don't paste secrets, customer PII, or private people-context into Brain Chat. If this proves unacceptable, downgrade to Q1=(b) by gitignoring `events.jsonl` only.

## Event kinds

See `brain/schema/telemetry-event.schema.json` for the full enum + per-kind fields.

## CLI

```bash
brain telemetry log <kind> '<json-payload>'   # append one event
brain telemetry rollup                         # rebuild sqlite
brain telemetry query "SELECT ..."             # SELECT-only
brain telemetry stats                          # counts by kind
```
