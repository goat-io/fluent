---
name: propose-page
description: "Draft a new wiki page when chat queries repeatedly hit a topic with zero RAG results. Auto-invoked by /brain-evolve when query-gap signals surface."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /propose-page

Phase 4 sub-skill. When users repeatedly ask Brain about a topic that doesn't have a wiki page (zero RAG hits), this skill drafts the missing page.

## When to invoke

- Auto-dispatched by `/brain-evolve` on `propose-page` proposals
- Manual: `/propose-page <topic>` to draft a synthesis page on demand

## Workflow

1. Read the query-gap signal: topic + queries-in-7d + page-exists=false
2. Search existing wiki for related material (RAG + grep)
3. Read raw sources under `raw/sources/` that might cover the topic
4. Draft a synthesis page with required frontmatter
5. Place at `narratives/candidates/<area>/<slug>.md` with `target-path:` set to the proposed live location
6. Surface to user with the topic, evidence base, and draft path

## Quality bar

- **Cite sources** — every claim links to the raw/source/file or existing wiki page that supports it
- **Don't invent** — if a section needs info not in any source, mark `_TBD: source needed_`
- **Cross-link** — link the new page from at least one existing page (avoids creating an orphan from day one)
- **Frontmatter complete** — name, description, last-updated, owner, status: candidate, ownership: llm, source, target-path

## Related

- Plan §3.6 + §6 Phase 4
- `/promote-candidate` to ship the draft into the live wiki
