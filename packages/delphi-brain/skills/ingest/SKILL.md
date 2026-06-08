---
name: ingest
description: "Read a raw source (PDF, transcript, web clip, slack export) from raw/sources/, summarize, identify affected entities, draft updates to one or more wiki pages, and stage everything under narratives/candidates/ for human review. Karpathy's ingest pattern, Phase 6 of brain-llm-wiki-evolution-plan.md."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /ingest

Phase 6 keystone. Moves new material from `raw/sources/` into the wiki via the candidates staging area. Never writes directly to live wiki.

## When to invoke

- Manual: `/ingest raw/sources/<file>` after dropping a new source
- Auto (batch): `/ingest --batch raw/sources/<dir>` (downgrades to less supervision per Q6 default)

## Workflow

1. **Read the source.** PDF, transcript, MD, CSV — handle each. Use `WebFetch` if source is a URL not yet downloaded.
2. **Extract key takeaways.** Surface to user in 3-5 bullets for confirmation before drafting.
3. **Identify affected entities.** Run `brain rag query "<topic>"` + `brain schema list` to know what kinds + existing pages might be touched. A single source might affect 5-15 entries.
4. **Draft updates as candidates.** For each affected entry:
   - If updating an existing page: copy the live page to `narratives/candidates/<same-path>` with merged content + `target-path:` set to the live path
   - If creating a new page: place under `narratives/candidates/<area>/<slug>.md` with frontmatter set
   - If creating a new catalog entry: place under `narratives/candidates/catalog/<kind>/<name>/`
5. **Stage via CLI:** `brain candidate list` confirms each draft is in place. (The skill should write files directly; the CLI exists for ops, not the skill flow.)
6. **Append to log.md:** `## [date] ingest | <source-name> | raw/sources/<path>` + per-draft `candidate-stage | <draft> | <path>`
7. **Emit telemetry:** `kind: ingest, source: raw/sources/<path>, entries: [<draft-paths>]`
8. **Surface to user:** list of drafts with target-paths + one-line per-draft summary. User reviews, runs `/promote-candidate <path>` per draft (or `/discard-candidate`).

## Candidate frontmatter template

```yaml
---
name: "..."
description: "..."
last-updated: 2026-05-13
owner: ...
status: candidate
ownership: llm
source: raw/sources/2026-05-13-vendor-deck.pdf
target-path: narratives/external/vendor-name.md
proposed-by: /ingest
review-notes: ""        # human appends notes here before promote/discard
---
```

## Rules

- **Never modify `raw/sources/` files.** They are immutable.
- **Never write directly to `catalog/` or `narratives/`** (except `narratives/log.md`). Always stage.
- **Cite the source in every drafted page.** Use the `source:` frontmatter field + inline citations in body.
- **Prefer one-at-a-time.** Karpathy's preference — better human oversight. `--batch` exists for scale; default is single-file.
- **Don't promote yourself.** Promotion is a separate human-driven step.

## Side effects

- Files appear under `narratives/candidates/`
- `narratives/log.md` gets `## [date] ingest |…` + per-draft `candidate-stage |…`
- Telemetry emits `ingest` + N × `candidate-stage` events

## CLI helpers

```bash
brain candidate list                              # what's staged
brain candidate promote <path>                    # ship to live wiki
brain candidate discard <path> -r "why"           # delete + log
```

## Anti-patterns

- Ingesting a source the same day as the deck it summarizes (dup data; flag and skip)
- Drafting >20 candidate updates from a single source (probably should split source into multiple files first)
- Forgetting the `target-path:` field (breaks promote)
- Promoting from inside the ingest skill (violates two-step pattern)

## Related

- `raw/sources/README.md` — source rules
- `narratives/candidates/README.md` — candidate lifecycle
- `brain/skills/promote-candidate/SKILL.md` — the ship step
- Plan §3.6 + §6 Phase 6
