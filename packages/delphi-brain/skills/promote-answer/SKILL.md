---
name: promote-answer
description: "File a useful chat synthesis as a wiki page so it compounds. Karpathy: 'good answers can be filed back into the wiki as new pages.' Drafts a candidate from the current chat answer + provenance."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /promote-answer

Phase 4 sub-skill. When the assistant produces a synthesis worth keeping — a comparison, an analysis, a connection across multiple sources — this skill files it as a candidate so the next person to ask gets a ready answer.

## When to invoke

- Manual: at the end of a chat exchange you want preserved (`/promote-answer`)
- Auto: when `/brain-evolve` detects a query-gap that the current session just filled

## Workflow

1. Capture the answer text from the current conversation
2. Identify provenance: which RAG hits / source files / queries fed the answer
3. Draft a candidate page under `narratives/candidates/<best-area>/<slug>.md`
4. Frontmatter:
   ```yaml
   ---
   name: "..."
   description: "Filed from chat synthesis"
   last-updated: today
   owner: ...
   status: candidate
   ownership: llm
   source: chat-synthesis
   target-path: narratives/<area>/<slug>.md
   proposed-by: /promote-answer
   ---
   ```
5. Cite RAG hits inline as the body
6. Append `## [date] evolve-proposal | promote-answer <topic> | <candidate-path>` to log.md
7. Surface to user with target-path, ask for `/promote-candidate` confirmation

## Quality bar

- **Don't promote partial answers.** If the synthesis is half-formed, push back instead.
- **Cite everything.** No claim should appear without a wiki/source link.
- **Pick area carefully.** Use the existing `narratives/<area>/` taxonomy; create a new area only if existing ones genuinely don't fit.

## Related

- `/promote-candidate` — the ship step
- Karpathy llm-wiki.md "Query" section
