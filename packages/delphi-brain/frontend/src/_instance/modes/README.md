---
name: "Mode plugins — UnifiedView render strategies"
description: "Phase 7 of brain-llm-wiki-evolution-plan.md. Each mode is a React component the UnifiedView dispatches to based on the lens's `defaultMode` or user selection. Drop a .jsx file in this dir to add a new mode."
last-updated: 2026-05-13
owner: engineering
status: active
ownership: shared
---

# `_instance/modes/`

Mode plug-ins for UnifiedView. Each `<name>.jsx` exports a default React component that renders one lens's data in a particular way.

## Contract

```jsx
export default function MyMode({ lens, data, filters, onFilterChange }) {
  // lens     — the parsed lens manifest
  // data     — the catalog entries to render (already filtered by `filters`)
  // filters  — current facet selections
  // onFilterChange(facet, value) — update facet
  return <div>{/* your render */}</div>
}
```

Optional named exports:

```jsx
export const label = 'Kanban'    // display in mode-switcher
export const icon = '📋'         // single emoji or import an SVG component
export const supports = (lens) => lens.kinds.includes('action')
                                  // gate: hide mode if lens doesn't fit
```

## Discovery

UnifiedView's mode dispatcher reads `import.meta.glob('./_instance/modes/*.jsx', { eager: true })` at startup. New mode = new file + refresh.

## Existing modes (to be migrated to this directory)

- `table` — currently in `_instance/views/UnifiedView.jsx` (TODO Phase 7)
- `dashboard` — currently in same file
- `graph` — currently in same file (cytoscape)

Migration: extract each into its own file here; leave the dispatch in UnifiedView. Behavior must be identical before/after.

## Mode candidates (future)

- `kanban` (Phase 8) — drag-and-drop board for `action` / `experiment` / `signal` kinds
- `timeline` — decisions and handovers over time
- `blast-radius` — graph view rooted at a single customer/contract, showing affected systems
- `sankey` — cost attribution across kinds
- `risk-board` — risk-severity matrix (when `risk` kind exists)

## Anti-patterns

- Modes that mutate `data` in place (treat as immutable)
- Modes that fetch their own data (the lens loader handles fetching; mode only renders)
- Per-kind logic inside a mode — use a different mode if you need per-kind behavior at the top level

## Related

- `_instance/lenses/README.md` — lens manifest spec
- Plan §3.5 + §6 Phase 7
