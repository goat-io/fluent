---
name: lint
description: "Run Brain's structural health check — orphan pages, broken links, stale claims, ad-hoc field clusters, missing back-edges. Phase 3 of brain-llm-wiki-evolution-plan.md. Use when wiki health needs auditing, after large ingests, or when /brain-evolve flags issues."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /lint

Phase 3 deliverable. Surfaces wiki health issues + emits `lint-finding` telemetry events that feed `/brain-evolve`.

## When to invoke

- After ingesting new sources (`/ingest`)
- After large refactors of `narratives/` or `catalog/`
- Before major decisions where wiki accuracy matters
- Periodically (weekly) as background hygiene
- When `/brain-evolve` reports it needs more lint signal

## What it checks

| Check | What it surfaces | Severity |
|---|---|---|
| `stale` | `status: active` files with `last-updated` >90d | soft |
| `missing-frontmatter` | `.md` files without YAML frontmatter, or missing `last-updated` | soft / pattern |
| `broken-link` | Markdown links to files that don't exist | pattern |
| `orphan-page` | Narrative files with zero inbound links (excludes handovers, decisions, README/index/log) | soft |
| `ad-hoc-field-cluster` | Catalog properties used in 3+ entries but not in any kind schema → `/propose-kind-field` candidate | pattern |
| `missing-back-edge` | `dependsOn: A→B` where B's catalog-info.json doesn't reference A | soft |

Each finding emits a `lint-finding` telemetry event so `/brain-evolve` can rank.

## Invocation

```bash
# Full report (JSON)
brain lint

# Filter via jq
brain lint | jq '.findings[] | select(.severity=="pattern")'
brain lint | jq '.byType'
```

## Output

```json
{
  "generatedAt": "2026-05-13T...",
  "findings": [
    {"type": "broken-link", "severity": "pattern", "path": "narratives/old.md", "detail": "../missing.md"},
    {"type": "ad-hoc-field-cluster", "severity": "pattern", "field": "repo.data-classification", "occurrences": 7, "examples": ["catalog/repos/a/...", "..."]}
  ],
  "byType": {...},
  "bySeverity": {...}
}
```

## What this skill does NOT do

- **Doesn't fix anything.** Only reports. Use `/brain-evolve` to turn findings into proposals; promote/discard manually.
- **Doesn't reason about contradictions** — that's an LLM-grade check; left for a future addition (start with structural; add LLM-judge contradiction detection when first false-positive surfaces).
- **Doesn't enforce `ownership: human`** — Q8 decision is warning only; skill emits soft signal at most. Hard fail can be promoted later.

## Side effects

- Appends one summary line to `narratives/log.md`: `## [date] lint | N findings (soft=A, pattern=B) | brain lint output`
- Emits one `lint-finding` telemetry event per finding (Phase 2)

## Related

- `narratives/decisions/brain-llm-wiki-evolution-plan.md` §3 + §6 Phase 3
- `brain/cli/internal/app/lint.go` — engine
- `brain/skills/brain-evolve/SKILL.md` — consumes lint telemetry
