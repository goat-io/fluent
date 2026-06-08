---
name: propose-lens
description: "Draft a new UnifiedView lens definition + recommended mode when query patterns or entity clusters aren't surfaced well by existing UI. Phase 4 + Phase 7."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# /propose-lens

Phase 4 sub-skill (with Phase 7 plug-in registry as the substrate). When a kind has many entries but no good UI surface — or queries repeatedly slice by a dimension current lenses don't expose — this skill drafts a new lens manifest.

## When to invoke

- Auto-dispatched by `/brain-evolve` on `propose-lens` proposals
- Manual: `/propose-lens <description>` to draft a custom lens

## Workflow

1. Read the signal (kind + query patterns + entry count)
2. Pick a base mode: `table`, `dashboard`, `graph`, or propose a new mode (kanban, timeline, sankey, blast-radius)
3. Draft `brain/frontend/src/_instance/lenses/<name>.json`:
   ```json
   {
     "name": "<name>",
     "label": "<human label>",
     "kinds": ["<kind1>", "<kind2>"],
     "defaultMode": "table",
     "modes": ["table", "dashboard"],
     "filters": [...],
     "columns": [...]
   }
   ```
4. If a new mode is needed, draft `_instance/modes/<mode>.jsx` skeleton too
5. Stage as candidate under `narratives/candidates/_instance/lenses/`
6. Surface to user with rationale + screenshot of similar existing lens for comparison

## Quality bar

- **Reuse before invent** — if `table` + a new filter satisfies, do that. Only propose a new mode when current modes truly can't render
- **Generic** — lenses live in `_instance/` because they're company-specific. Don't push lens definitions to `brain/` framework
- **Plug-in compatible** — must conform to the lens manifest schema (see Phase 7 spec)

## Related

- Plan §3.5 + §6 Phase 7
- `brain/frontend/src/_instance/lenses/README.md` — full manifest spec (Phase 7)
