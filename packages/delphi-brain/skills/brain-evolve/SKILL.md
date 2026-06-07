---
name: brain-evolve
description: "Orchestrator for Brain's self-evolution loop. Reads telemetry + lint signals, ranks proposals, dispatches to /propose-kind, /propose-edge, /propose-page, /promote-candidate, /promote-answer. Run at session end (chained from document-learning), weekly as background, or on demand when wiki gaps surface."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /brain-evolve

Phase 4 keystone — the loop that makes Brain self-evolving. Aggregates signals from telemetry (Phase 2) + lint (Phase 3) into ranked proposals, then routes each to the right sub-skill.

## When to invoke

- Automatically chained from `document-learning` at session end (Phase 5 hook)
- Weekly as background hygiene
- After a `/lint` run with significant findings
- When a chat session repeatedly hits zero-RAG queries

## How it works

1. Run `brain telemetry rollup` to refresh sqlite from events.jsonl (the scanner already does this internally).
2. Call `brain evolve scan --top 3` to get ranked proposals.
3. For each proposal, dispatch to the named sub-skill:
   - `propose-kind` → `/propose-kind`
   - `propose-edge` → `/propose-edge`
   - `propose-page` → `/propose-page`
   - `propose-lens` → `/propose-lens`
   - `promote-candidate` → `/promote-candidate`
4. Each sub-skill drafts a candidate (PR-shaped diff) under `narratives/candidates/` or `brain/schema/candidates/` (for schema work).
5. Surface to the user a one-line summary per proposal + path to draft.
6. User approves or discards via `/promote-candidate` / `/discard-candidate`.

## Invocation

```bash
brain evolve scan --top 3       # Top 3 ranked proposals
brain evolve scan --top 0       # All proposals (no truncation)
```

## Output

```json
{
  "generatedAt": "2026-05-13T...",
  "proposals": [
    {
      "kind": "propose-kind",
      "subject": "repo.data-classification",
      "score": 7.0,
      "reason": "ad-hoc field cluster surfaced by lint",
      "examples": ["catalog/repos/foo", "catalog/repos/bar"],
      "sourceTypes": ["lint-finding"]
    }
  ],
  "truncated": false
}
```

## Rules of engagement

- **Never auto-apply.** All proposals are drafts. Human reviews + approves.
- **Top 3 by default.** Avoid proposal fatigue. `--top 0` for full firehose.
- **Preserve provenance.** Each proposal must carry `sourceTypes` so the human knows which signal drove it.
- **Append to log.md** — emit `## [date] evolve-proposal | <subject> | <draft-path>` per proposal that produces a draft.
- **Log evolve-scan as telemetry** — `kind: skill-complete, skill: brain-evolve` so future scans know which signals were already consumed.

## Side effects

- Calls `brain telemetry rollup` (rebuilds sqlite)
- Emits `skill-complete` event
- Writes draft files under `narratives/candidates/` (via sub-skills)
- Appends `evolve-proposal` lines to `narratives/log.md`

## Related

- `narratives/decisions/brain-llm-wiki-evolution-plan.md` §3.3 + §3.7 + §6 Phase 4
- `brain/cli/internal/app/evolve.go` — scanner
- Sub-skills: `propose-kind`, `propose-edge`, `propose-page`, `propose-lens`, `promote-candidate`, `promote-answer`
