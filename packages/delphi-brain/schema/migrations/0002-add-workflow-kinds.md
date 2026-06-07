---
name: "Migration 0002 — add workflow kinds (action, experiment, signal, decision)"
description: "Adds four kinds that turn Brain from documentation pile into workflow cockpit. Phase 8 of brain-llm-wiki-evolution-plan.md. No data migration — schemas only; first instances will be drafted when concrete use cases arrive."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: llm
---

# Migration 0002 — workflow kinds

Phase 8 of [brain-llm-wiki-evolution-plan.md](../../../narratives/decisions/brain-llm-wiki-evolution-plan.md).

## What this migration does

Adds four schemas:
- `brain/schema/action.schema.json` — concrete things to do
- `brain/schema/experiment.schema.json` — hypothesis-driven trials
- `brain/schema/signal.schema.json` — observations not yet acted on
- `brain/schema/decision.schema.json` — formal ADR/BDR with structured options

These four kinds share the lifecycle base per §8 Q4 = (c): `proposed → in-progress → blocked → done → superseded`, with per-kind `subStatus` extension for specialized states (e.g., `signal.acknowledged`, `experiment.concluded`).

## How to run

The schemas register automatically:
```bash
make build                      # regenerates kinds-registry.json
brain schema list               # confirms 4 new kinds appear
brain schema get action         # inspect
```

No catalog data exists for these kinds yet — first instances arrive when:
- `action`: AWS cost plan pilot promotes recommendations into structured actions
- `experiment`: first ICO BYOD trial
- `signal`: first /brain-evolve telemetry triage
- `decision`: when migrating existing `narratives/decisions/*.md` to typed form

## Rollback

Delete the four schema files + this migration doc. Catalog stays untouched (no entries yet).

## Generality

Every company tracks actions and decisions; every R&D org runs experiments; every operations team accumulates signals. These four primitives generalize to any Brain-adopting organization. The `subStatus` escape hatch keeps per-domain variation possible without bloating the base enum.

## Tradeoffs accepted

- **No dashboard mode yet** — Phase 7 plug-in registry is scaffolded but not wired; full UnifiedView refactor lands later. For now, actions are visible via `brain schema examples action` once the first one is created.
- **No external-system kinds (`jira-ticket`, etc.)** — Phase 9, deferred. Today `action.target` is a free string; integrations can plug in when needed.
