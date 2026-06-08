---
name: Brain Conventions
description: Generic conventions every catalog entry and narrative file follows. Company-agnostic.
last-updated: 2026-05-13
owner: engineering
status: draft
---

# Conventions

Every file Brain indexes follows these rules. They are deliberately generic so the same rules apply to any company adopting Brain.

## File layout

```
catalog/
  <kind>s/<name>/
    catalog-info.json       # typed metadata (validated against brain/schema/<kind>.schema.json)
    README.md               # human-readable analysis
    openapi.json            # only for entries that expose HTTP/GraphQL APIs
narratives/
  <area>/                   # cross-cutting prose Brain can't derive
    <topic>.md
```

## Frontmatter (markdown)

Every `.md` file Brain indexes must start with YAML frontmatter:

```yaml
---
name: "Human-readable title"
description: "One-line description"
last-updated: YYYY-MM-DD       # ISO 8601, absolute (never "next quarter")
owner: <generic-role-name>     # whichever role-naming convention the company uses
status: draft | active | deprecated | archived
---
```

Optional fields any `.md` file may add — they power Brain's faceted browser
and the `/api/documents/facets` endpoint:

```yaml
system: <system-id>            # id of a kind:system entry the doc belongs to
tags: [architecture, decision] # free-form kebab-case keywords
audience: [engineer, leadership] # who's the intended reader
```

Tags are free-form. Brain surfaces frequency in the facets endpoint so
authors see existing tags before adding new ones — the vocabulary
self-organises. Suggested seed tags: `architecture`, `decision`, `roadmap`,
`runbook`, `compliance`, `security`, `cost`, `migration`, `incident`,
`proposal`, `handover`, `spec`, `process`, `glossary`. `audience` values:
`agent`, `engineer`, `product`, `leadership`, `ops`.

### Ownership

Every `.md` file may declare who is allowed to write to it:

```yaml
ownership: llm | human | shared
```

| Value | Meaning | Lint behavior |
|---|---|---|
| `llm` | LLM-owned. Auto-maintained by Brain skills. Human edits are tolerated but lint will flag drift. | warn |
| `human` | Human-owned. LLM must not modify. | **hard fail** if LLM modifies |
| `shared` | Either may edit. Default for most narrative content. | no lint |

Default when omitted: `shared`. The `brain/` framework files default to `human` (only humans edit the framework itself, per the brain/instance separation rule). `narratives/log.md`, `narratives/candidates/*`, `brain/schema/CHANGELOG.md`, and `brain/telemetry/*` default to `llm`.

Catalog `README.md` entries of `kind: repo` additionally carry:

```yaml
domain: <domain-id>            # the company-specific domain bucket
repo: https://github.com/...   # canonical source URL
```

## `catalog-info.json`

Every catalog entry has a typed sidecar:

```json
{
  "name": "<unique-id>",
  "kind": "<see brain/kinds.md>",
  "description": "...",
  "system": "<system id this belongs to>",
  "layer": "device | edge | domain | platform | data | cross-cutting | r-and-d",
  "lifecycle": "production | prototype | sunset | dead | unknown",
  "dependsOn": [
    { "target": "<other-entry-name>", "kind": "<that entry's kind>",
      "protocol": "...", "port": 0, "purpose": "..." }
  ]
}
```

`dependsOn[]` items are **objects**, not strings. The full reference schema lives in `brain/schema/<kind>.schema.json`.

## Naming

- Filenames: `kebab-case`
- One entry per folder; one folder per entry
- Folder name = `name` field in `catalog-info.json`

## Linking

- Always relative paths
- Link the first mention of a concept that has its own page
- Don't link the same thing twice in the same section

## Gap markers

- `_TODO_` — fillable from code or existing docs
- `_TBD: confirm with [team]_` — needs a human

Both are searchable: `grep -r "_TODO_\|_TBD:"`.

## What NOT to put in the catalog

- Source code (link to the repo instead)
- Secrets (reference where they live)
- Information already derivable from another tracked source

## What lives in `narratives/` instead

Cross-cutting prose Brain can't derive: architecture overviews, transformation roadmaps, handovers, glossaries, mission statements. Anything that doesn't map cleanly onto one entity.

## Three-layer model (Karpathy LLM-Wiki pattern)

Brain follows a three-layer model. Each file belongs to exactly one layer:

| Layer | Path | Owned by | Purpose |
|---|---|---|---|
| **Raw** | `raw/sources/`, `raw/assets/`, `repos/` | human | Immutable source material. Never modified after drop. |
| **Wiki** | `catalog/`, `narratives/` | llm (with human approval) | Synthesized, structured, interlinked knowledge. |
| **Schema** | `brain/`, `CLAUDE.md` | human (with LLM proposals) | The rules that govern the wiki. Generic, portable, company-agnostic. |

Skills that move data between layers:

- `/ingest <raw-path>` — raw → wiki (via `narratives/candidates/` staging)
- `/promote-candidate <path>` — candidate → wiki
- `/propose-kind`, `/propose-edge`, `/propose-lens` — wiki signal → schema proposal
- `/brain-evolve` — orchestrates the schema-evolution loop from telemetry

See `narratives/decisions/brain-llm-wiki-evolution-plan.md` for the full design.

## Rolling log

`narratives/log.md` is the append-only chronology of every material wiki event. One line per event:

```
## [YYYY-MM-DD] <event-kind> | <title> | <path-or-ref>
```

Parseable with `grep "^## \[" narratives/log.md`. Event kinds enumerated in `narratives/log.md` itself.

The log is `ownership: llm` — skills append to it automatically. Humans append manually only for events outside skill flows (a decision in a meeting, an externally-driven schema change).

## Candidates staging

`narratives/candidates/` is the staging area for LLM-proposed wiki updates pending human review. See `narratives/candidates/README.md` for lifecycle. Indexer must skip this directory (BM25, RAG, graph traversal all exclude it).
