---
name: "Lens manifests — UnifiedView plug-in registry"
description: "Phase 7 of brain-llm-wiki-evolution-plan.md. Each lens is a JSON manifest declaring which kinds it covers, which modes it supports, and which fields to surface. UnifiedView auto-discovers all manifests in this dir — drop a JSON, lens appears in the selector after refresh."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# `_instance/lenses/`

Phase 7 plug-in registry for UnifiedView lenses. Each `<name>.json` here defines one lens. The shell discovers all manifests at build time via Vite `import.meta.glob('./_instance/lenses/*.json')`.

## Manifest shape

```json
{
  "$schema": "../lens-manifest.schema.json",
  "name": "<unique-id>",
  "label": "<human-readable label, shown in the lens selector>",
  "kinds": ["<kind1>", "<kind2>"],
  "defaultMode": "table",
  "modes": ["table", "dashboard", "graph"],
  "filters": [
    {"field": "owner", "type": "select"},
    {"field": "status", "type": "select"},
    {"field": "lifecycle", "type": "select"}
  ],
  "columns": [
    {"field": "name", "label": "Name", "primary": true},
    {"field": "owner"},
    {"field": "status"}
  ],
  "graph": {
    "rootKinds": ["<kind1>"],
    "edgeFields": ["dependsOn", "relations"]
  },
  "description": "What this lens shows and why",
  "ownership": "shared"
}
```

## Discovery

The UnifiedView shell reads `import.meta.glob('./_instance/lenses/*.json', { eager: true })` at startup. Adding a lens = drop a JSON file + refresh.

## Field semantics

- **`kinds`** — which catalog kinds populate the lens (matches `kind` field in catalog-info.json)
- **`defaultMode`** — which mode opens first when the user clicks the lens
- **`modes`** — modes available in the mode-switcher tab strip
- **`filters`** — facets shown in the sidebar; field must exist on the kind
- **`columns`** — for `table` mode only; first one with `primary: true` becomes the row link
- **`graph`** — for `graph` mode only; declares which kinds anchor the visualization and which edge fields to traverse

## Examples

See `catalog-flat.json` in this folder — the existing flat catalog table, reformatted as a manifest (proof-of-concept that the spec covers current UI).

## When to add a new lens

- A kind has many entries but no existing lens surfaces it well → propose via `/propose-lens`
- A query pattern slices by a dimension current lenses don't expose
- A new workflow primitive (action, experiment, signal) needs a dedicated view

## When NOT to add

- For a one-off filter — use the existing lens's facet sidebar instead
- For a brand-new mode — only add when ≥2 lenses want it (avoid mode proliferation)

## Modes

Modes live in `_instance/modes/<name>.jsx`. They're React components that accept `{lens, data, filters}` and render. Existing modes: `table`, `dashboard`, `graph`. Future candidates per Phase 8/9: `kanban` (actions board), `timeline` (decisions over time), `blast-radius` (customer→system graph), `sankey` (cost attribution).

## Related

- `narratives/decisions/brain-llm-wiki-evolution-plan.md` §3.5 + §6 Phase 7
- `brain/skills/propose-lens/SKILL.md` — the skill that drafts new manifests
- `_instance/modes/README.md` — mode plug-in spec
