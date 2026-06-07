---
name: diagram-solution
description: "Build clear, faithful architecture / communication / flow diagrams in the company's PoC web app (`brain/frontend/`). Encodes hard-won rules about layout, routing, labels, handles, categorisation, and faithfulness to source data."
when_to_use: "create diagram", "add view", "communications view", "system diagram", "react flow", "architecture-app view", "draw architecture"
argument-hint: "[view-name]"
allowed-tools: Read Write Edit Bash Glob Grep WebFetch
---

# Diagram Solution — How to Build Diagrams That Don't Lie

Source-of-truth: this skill captures rules learned while building [`brain/frontend/src/views/CommunicationsView.jsx`](../../../brain/frontend/src/views/CommunicationsView.jsx). Read that file first if you're about to create a new view — it is the working reference implementation of every rule below.

The the company architecture-app is a **React 19 + ReactFlow (`@xyflow/react`) + Vite** SPA. New views are added as `src/views/<Name>View.jsx` and wired into `src/App.jsx`. This skill is about authoring those views.

---

## The Big Rules (memorise these)

### 1. Truth before aesthetics

Every claim in a diagram must be backed by a source-of-truth file. For the company:

- Device protocols, ports, formats: [`narratives/architecture/communication-flows.md`](../../../narratives/architecture/communication-flows.md)
- System boundaries / membership: [`catalog/systems/<id>/catalog-info.json`](../../../catalog/systems/) and `catalog/repos/<repo>/catalog-info.json`
- Wire-format byte traces: [`narratives/payloads/`](../../../narratives/payloads/)
- Business / sales / org: `narratives/business/`, `narratives/company/`, `narratives/product/`

Never invent connections. If you don't know whether device X talks to backend Y, look it up. If you can't confirm, leave it out and add a `_TBD: confirm with <team>` marker in the source MD, not in the diagram.

### 2. Categorise by role in the system, not by physical type

Bad: "End-user devices" — vacuous, every box in this section is at the user's site.
Good: split by **role in the comms path**:

- **Wireless sensors** — radio-only, depend on a hub
- **Home hub** — aggregates sensors, has cellular uplink
- **Mobile alarms** — own cellular, bypass any hub

The category names should answer "why is this box different from that one?" If the answer is "no reason really", merge them.

### 3. A device removed is information lost

If two products look "similar enough" to merge into one node, **don't**. Eliza A150 and Eliza S+ are different SKUs. Showing only one because it simplifies the layout deletes information from the diagram. Use distinct nodes; solve crossings with handles or routing instead (see §6).

### 4. The diagram has one job — let other diagrams do the rest

Every diagram answers one question. The Communications view answers "what protocol does each device use to reach which backend?" — and only that.

It is **explicitly fine** to omit:
- Backend↔backend internal sync (e.g. dashed `460→ICO`, `generic-iot→ICO`)
- Reverse paths that need a single back-edge crossing the whole canvas (e.g. `ICO → Eliza` SMS)
- Anything that lives in another view or in the source MDs

Document the omission in a comment in the JSX so the next person doesn't add it back "for completeness". Crossings are not free; only spend them on the story this diagram tells.

---

## Layout Rules

### 5. Swim lanes are uniform — vary the cards inside them, not the lane geometry

Every lane (band) shares the **same width**, **same y-start**, and **same vertical extent**. The grid reads as a clean column structure. What varies between lanes is *which cards live inside each one and where*. Mobile alarms feel separate from the hub because their cards sit at y=720 inside their lane, not because the lane itself is shorter or offset.

```js
const bandTop    = TOP_OFFSET - 50
const bandHeight = totalHeight - bandTop
const bandWidth  = BAND_W_PRODUCT   // single value reused for every lane

const lanes = [
  { id: 'band-sensors',  col: COL.sensors,  color: P.radio.color, label: '① Wireless sensors', sublabel: '…' },
  { id: 'band-hub',      col: COL.hub,      color: P.udp.color,   label: '② Home hub' },
  { id: 'band-mobile',   col: COL.mobile,   color: MOBILE_COLOR,  label: '③ Mobile alarms' },
  { id: 'band-backends', col: COL.backends, color: '#3B82F6',     label: '④ Backends' },
  { id: 'band-external', col: COL.external, color: '#F5913E',     label: '⑤ External' },
]
lanes.forEach(l => nodes.push({ id: l.id, type: 'band',
  position: { x: l.col - BAND_PAD_X, y: bandTop },
  data: { width: bandWidth, height: bandHeight, ...l },
  draggable: false, selectable: false, zIndex: -10,
}))
```

Don't hand-size each band to its card count — that produces lanes of mismatched heights and makes the diagram feel arbitrary.

### 6. Columns are roles, not arbitrary buckets

Put each role in its own x-column. Order columns left → right by data-flow direction.

For a comms diagram: `Devices → Hubs → Backends → External`. Backends consumed by mobile devices that bypass the hub get their **own** column at a different y-band so it is visually obvious they are not part of the hub flow.

| Concept | Implementation |
|---|---|
| Column | a constant in `const COL = { sensors: 80, hub: 580, mobile: 1080, backends: 1580, external: 2020 }` |
| Visual band | a `BandNode` (custom node, `zIndex: -10`) with dashed border + numbered label `① Wireless sensors` |
| Vertical separation | when two cards are in the same column but different roles, offset the y-band by ≥300 px so it does not look like the upper feeds the lower |

**Layout constants** (proven values for product cards):

```js
const COL = { /* see above */ }
const ROW_H = 210            // vertical pitch of product cards
const PRODUCT_W = 220        // card width
const BAND_PAD_X = 24        // padding around band relative to column x
const BAND_W_PRODUCT = PRODUCT_W + 2 * BAND_PAD_X
const BAND_W_BACKEND = 280
const TOP_OFFSET = 110       // first card y
const MOBILE_Y_OFFSET = 720  // mobile alarms start well below the hub
```

### 6. Handles must be ID'd or they break silently

Every named `sourceHandle` / `targetHandle` on an edge requires a matching `<Handle id="…">` on the node. If the id is missing, **the edge does not render and ReactFlow gives no warning**. This bit twice — sensor edges and ARC/ICP edges — and the only symptom was a blank gap on screen.

Rule: if you give a node multiple connection points, add the matching ids on the node BEFORE writing the edge that uses them.

The standard handle layout for a node with multiple connections:

```jsx
<Handle id="l-top" type="target" position={Position.Left}  style={{ top: '28%', ... }} />
<Handle id="l-mid" type="target" position={Position.Left}  style={{ top: '50%', ... }} />
<Handle id="l-bot" type="target" position={Position.Left}  style={{ top: '72%', ... }} />
<Handle id="r-top" type="source" position={Position.Right} style={{ top: '28%', ... }} />
<Handle id="r-mid" type="source" position={Position.Right} style={{ top: '50%', ... }} />
<Handle id="r-bot" type="source" position={Position.Right} style={{ top: '72%', ... }} />
```

### 7. Don't render handles that no edge uses

Render only the handles an edge actually connects to. Spare dots make a card look like it has phantom connections.

```jsx
{data.handles?.['l-top'] && <Handle id="l-top" ... />}
```

`data.handles` is computed in `buildGraph` AFTER edges are built (§9).

### 8. Handle colour = line colour

Each connection dot is the colour of the line attached to it. Computed once after edges are built:

```js
const handlesByNode = {}
edges.forEach(e => {
  const stroke = e.style?.stroke
  if (!stroke) return
  if (e.sourceHandle) {
    handlesByNode[e.source] = handlesByNode[e.source] || {}
    handlesByNode[e.source][e.sourceHandle] = stroke
  }
  if (e.targetHandle) {
    handlesByNode[e.target] = handlesByNode[e.target] || {}
    handlesByNode[e.target][e.targetHandle] = stroke
  }
})
nodes.forEach(n => {
  if ((n.type === 'product' || n.type === 'backend') && handlesByNode[n.id]) {
    n.data = { ...n.data, handles: handlesByNode[n.id] }
  }
})
```

This both colours the dots and tells the node which handles to render (§7).

### 9. Build edges first, then derive node metadata

`buildGraph()` should:

1. Push all nodes (positions only)
2. Push all edges (with sourceHandle/targetHandle)
3. Walk edges → compute `handlesByNode`
4. Walk nodes → attach `data.handles`

Doing this in any other order leaves stale data and produces silently-broken nodes.

---

## Routing Rules

### 10. Pick edge type by graph topology

| Topology | Edge type | Why |
|---|---|---|
| **Fan-IN** (many sources, one target) | `smoothstep` (orthogonal) | Source-y values are already distinct, target is shared. Right-angles look tidy and labels are easy to place. |
| **Fan-OUT** (one source, many targets at different y) | `default` (bezier) | Orthogonal forces every edge through the same midpoint x → vertical legs stack and overlap. Bezier curves naturally splay because each curve is shaped by its specific endpoints. |
| Single edge between two nodes | either, smoothstep usually | — |

Don't try to make orthogonal smoothstep work for fan-out by tweaking `pathOptions.offset`. It mitigates but doesn't solve. Switch to bezier.

### 11. One edge per leaver — distinct source handles

When a node has N outgoing edges to different targets, give each edge its own source handle (`r-top` / `r-mid` / `r-bot`). Otherwise all N edges leave from the same right-centre point and look like one line splitting into N colours mid-air.

The colour of each line should still be visible the moment it leaves the node.

### 12. Distribute target handles when multiple edges arrive at one backend

Two edges both targeting `l-mid` of the same backend will overlap as they approach the dot. Spread them across `l-top` / `l-mid` / `l-bot` so each line lands at its own dot.

Example — both Eliza A150 and Eliza S+ go to ICO:
- A150 → ICO uses `l-mid`
- S+ → ICO uses `l-bot`

### 13. Reduce edges before you reroute

Before fighting routing, ask: "is this edge worth the crossing it costs?". Most diagrams improve when 30 % of their edges are deleted.

In Communications we removed:
- `460 → ICO` (sync, dashed)
- `generic-iot → ICO` (sync, dashed)
- `ICO → Eliza` SMS reverse edge

All three were "real" relationships, but they crossed half the canvas and were tangential to the diagram's question. They live in `communication-flows.md` if anyone needs them.

---

## Labelling Rules

### 14. One label per redundant edge group

Six sensors all sending the same `868 MHz · Caretech 9-byte FSK` to the same hub means six identical labels. Label only the **middle edge**:

```js
const labelIdx = Math.floor(SENSORS.length / 2)
SENSORS.forEach((p, i) => {
  edges.push({ ..., label: i === labelIdx ? '868 MHz · …' : undefined })
})
```

Same logic for Eliza S+ — protocol is identical to A150, so S+'s edges go unlabelled and rely on colour + position.

### 15. Labels must render above all edges (use `EdgeLabelRenderer`)

Default ReactFlow edge labels are SVG `<text>` siblings of the edge path. Another edge's path drawn later in DOM order can paint over them. Even with high `zIndex` on the edge, labels can be obscured.

The fix is a **custom edge** that renders the path via `BaseEdge` and the label via `EdgeLabelRenderer` (an HTML overlay layer that always sits above the edges SVG).

```jsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath } from '@xyflow/react'

function LabelOverlayEdge(props) {
  const { sourceX, sourceY, targetX, targetY,
          sourcePosition, targetPosition,
          label, data = {}, style = {}, markerEnd, id } = props
  const opts = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }
  let edgePath, labelX, labelY
  if (data.curve === 'step') {
    [edgePath, labelX, labelY] = getSmoothStepPath({ ...opts, borderRadius: 8 })
  } else {
    [edgePath, labelX, labelY] = getBezierPath(opts)
  }
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan" style={{
            position: 'absolute',
            zIndex: 1000,
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: 'var(--background)',
            border: `1px solid ${style.stroke}55`,
            borderRadius: 4, padding: '4px 8px',
            fontSize: 10, fontWeight: 600,
            color: style.stroke,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 0 2px var(--background)',
          }}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
const edgeTypes = { labeled: LabelOverlayEdge }
```

Belt-and-suspenders the layer ordering with global CSS:

```jsx
const FORCE_LABELS_ON_TOP = `
  .react-flow__edgelabel-renderer { z-index: 1000 !important; }
  .react-flow__edgelabel-renderer > * { z-index: 1000 !important; }
`
// inside the view component:
<style>{FORCE_LABELS_ON_TOP}</style>
```

### 16. Labels need an opaque hit-mask, not just a background

Set the label's HTML div to `background: var(--background)` AND give it `boxShadow: '0 0 0 2px var(--background)'`. The shadow extends the opaque area 2 px beyond the rounded border so antialiasing can't leak the underlying line through.

### 17. Slide labels along their curve to avoid neighbour overlap

For fan-out where multiple curves stack vertically, the default label position (curve midpoint) means the labels sit on top of each other AND on top of neighbour lines.

Fix: parameterise label position along the bezier:

```js
function bezierPointAt(t, p0, p1, p2, p3) {
  const u = 1 - t
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  }
}
```

ReactFlow's bezier between right-and-left handles uses curvature 0.25, so control points are at `(sx + 0.25*|dx|, sy)` and `(tx − 0.25*|dx|, ty)`. Compute the label position at a custom `t` per edge and stagger them: typical values for a 3-edge fan-out are `t = 0.50 / 0.60 / 0.70`. Don't go past 0.75 or labels overlap the destination card.

Each label now sits on its own line, not on a neighbour's.

### 18. Position floating UI on the LEFT — the right is reserved for the drawer

The architecture-app uses a right-side `DetailDrawer` for every node-detail view. Anything floating you add (legends, toolbars, view-specific controls) goes top-**left** so it never competes with the drawer.

```jsx
<div style={{ position: 'absolute', top: 16, left: 16, zIndex: 5, ... }}>
  ...legend...
</div>
```

Make floating panels collapsible AND start them **collapsed**. The diagram is what the user came for — the legend is reference material that shouldn't claim canvas space until asked.

```jsx
const [open, setOpen] = useState(false)  // start collapsed
```

### 19. Strip labels from copies

If two nodes carry the same protocol set (e.g. Eliza A150 and S+), label only one. Duplicate labels add noise without information. The colour + handle id still tells the reader what the unlabelled edge is.

---

## Asset Rules

### 20. Self-host product images via `public/<dir>/`

Reference public-facing product images via `${import.meta.env.BASE_URL}<dir>/<file>`:

```js
const ASSET = (file) => `${import.meta.env.BASE_URL}products/${file}`
```

This works in dev (`/iot-platform-architecture/`) and prod (whatever `vite.config.js` sets `base` to).

Do NOT hot-link to `example.com` — pages move, images get renamed, and the diagram silently breaks.

To download a product page's images:

```bash
mkdir -p brain/frontend/public/products
cd brain/frontend/public/products
curl -sLo enzo.jpg "https://www.brain.com/app/uploads/.../enzo.jpg"
# repeat per product
```

Use `WebFetch` first to extract image URLs from the product page. Verify all images return 200 via `curl -I` before referencing them.

### 21. Always render an image-failure fallback

```jsx
const [errored, setErrored] = useState(false)
{errored
  ? <div>image not found<br/><code>{data.image}</code></div>
  : <img src={data.image} onError={() => setErrored(true)} />}
```

When an image breaks the diagram still tells you exactly which path the browser tried — much faster diagnosis than "broken image icon".

---

## Wiring a New View into the App

### 22. Three places to touch in `src/App.jsx`

```jsx
// 1. Import
import CommunicationsView from './views/CommunicationsView.jsx'

// 2. Tab registry
const mainTabs = [
  { key: 'systems', label: 'Systems', color: '#10B981' },
  { key: 'communications', label: 'Communications', color: '#F5913E' },  // ← new
  { key: 'business', label: 'Business', color: '#6366F1' },
]

// 3. Icon map
const navIcons = {
  catalog: '📋', systems: '🧩', communications: '📡',  // ← new
  ...
}

// 4. Render guard
const isComms = activeTab === 'communications'
// in the conditional render block:
: isComms ? <CommunicationsView key="communications" />
: ...

// 5. Breadcrumb capitalisation
{activeTab === 'communications' ? 'Communications' : ...}
```

### 23. Verify the build before reporting done

```bash
cd brain/frontend
npm run build          # must finish with `✓ built in …`
npm run dev            # background — http://localhost:5173/iot-platform-architecture/?view=<key>
```

Two specific checks once running:

```bash
# 1. The page loads
curl -sIo /dev/null -w "%{http_code}\n" http://localhost:5173/iot-platform-architecture/

# 2. Static assets resolve under base path
curl -sIo /dev/null -w "%{http_code}\n" http://localhost:5173/iot-platform-architecture/products/<file>
```

Both must return `200`. If the second returns `404`, you forgot `import.meta.env.BASE_URL` (§19).

Build clean ≠ diagram correct. Always look at the rendered page — most diagram bugs are visual.

---

## Iteration Discipline

### 24. Don't pre-emptively delete data to "simplify"

When the user complains the diagram is busy, your first instinct will be to remove a node or merge two. **Resist** unless the user explicitly asks. The user knows their domain better than you. They will catch the deletion within one screenshot ("you removed a device???") and you will have eroded trust.

Acceptable simplifications without asking:
- Remove edge labels that duplicate (§14, §18)
- Remove backend↔backend internal edges that are off-topic (§13)
- Hide unused handles (§7)

Ask before:
- Removing nodes
- Merging nodes
- Reordering categories the user already approved

### 25. Verify in the browser, then iterate from screenshots

The user will tell you what's wrong faster than you can guess. After each substantive change:

1. `npm run build` — must pass
2. Tell the user to reload (or wait for HMR)
3. Wait for their screenshot

If you can't see the page yourself (Chrome extension not connected etc), say so explicitly. Don't claim "it should look like X now" — guesses cost trust.

### 26. Use a layered layout engine, do not roll your own

Past a handful of nodes, hand-rolled layout (manual columns, barycenter sort, handle-slot heuristics) compounds into a tangled mess. The proven solution is a **Sugiyama-style layered layout algorithm**. We use **`elkjs`** (Eclipse Layout Kernel) wrapped in [`src/lib/layoutEngine.js`](../../../brain/frontend/src/lib/layoutEngine.js) so views call `layoutLayered(nodes, edges)` and trust the result.

What ELK does for you:

- **Layer assignment** — every node is placed in a layer based on edge direction (no need to compute "depth" yourself)
- **Crossing minimisation** — multi-pass barycenter / median sweep across layers
- **Vertical ordering** within each layer
- **Node spacing** with configurable gaps

What stays in the view:

- Render React components (custom node types, custom edges)
- Decide which **handle** (`l-top` / `r-bot` / …) each edge uses (rules §11–§13)
- Edge styling (colour, label) by protocol family (rule §10)

#### Pipeline

```
allSpecs (catalog)
    │
    ▼
buildSemanticGraph()        ← pure data: rawNodes, rawEdges, cardById
    │
    ▼
layoutLayered(rawNodes, rawEdges)   ← async ELK call, returns positions
    │
    ▼
composeReactFlow()          ← positions + cards + edge styling → React Flow
```

#### Standard call

```js
import { layoutLayered } from '../lib/layoutEngine'

const positioned = await layoutLayered(rawNodes, rawEdges, {
  nodeWidth: 240,
  layerSpacing: 240,
  nodeSpacing: 60,
  padding: 60,
})
// positioned.nodes: [{ id, x, y, width, height, layer }, ...]
```

The view becomes async (`useEffect` + `useState`), not `useMemo`. A 1.5 MB bundle increase is the cost; for a dev / docs tool that's fine.

Rule of thumb: if you find yourself writing topological-wave barycenter sort by hand, stop and use ELK. Anything you hand-tune now will collide with the next addition to the catalog.

### 27. Keep the dev server lifecycle in your head

`npm run dev` runs in background. It survives across many turns of conversation but you may have killed it earlier in the session. If the user reports "site can't be reached", it died — restart it:

```bash
pkill -f vite 2>/dev/null
(nohup npm run dev > /tmp/vite.log 2>&1 &)
```

When done with a session, leave a note that they can stop with `pkill -f vite`.

---

## Reference Files

- Working implementation: [`brain/frontend/src/views/CommunicationsView.jsx`](../../../brain/frontend/src/views/CommunicationsView.jsx)
- App wiring example: [`brain/frontend/src/App.jsx`](../../../brain/frontend/src/App.jsx) — search for `CommunicationsView` to see all 5 wiring points
- Style guide: [`brain/frontend/STYLE_GUIDE.md`](../../../brain/frontend/STYLE_GUIDE.md)
- Source MDs every diagram should ground itself in: [`narratives/architecture/`](../../../narratives/architecture/)

---

## Quick Quality Checklist (before declaring done)

- [ ] Every node and edge traces to a source-of-truth file
- [ ] Categories are by **role**, not physical type
- [ ] No nodes were merged or removed without user OK
- [ ] All `sourceHandle` / `targetHandle` ids exist on the matching node
- [ ] No `<Handle>` is rendered that no edge uses
- [ ] Each handle's colour matches its line
- [ ] Fan-out edges use bezier (`type: 'labeled'`, `data.curve: 'bezier'`); fan-in edges use smoothstep
- [ ] Each protocol family has a distinct colour and appears in the legend
- [ ] Labels render via `EdgeLabelRenderer`, with z-index 1000 + boxShadow halo
- [ ] Duplicate labels stripped (only one per protocol per fan-out group)
- [ ] Label positions staggered along their curves (`labelT` ≈ 0.5 / 0.6 / 0.7)
- [ ] Product images self-hosted under `public/<dir>/`, referenced via `import.meta.env.BASE_URL`
- [ ] Image `onError` fallback present
- [ ] `npm run build` exits clean
- [ ] Dev server reachable + static assets return 200 under base path
- [ ] View wired into `App.jsx` (import + mainTabs + navIcons + isX guard + breadcrumb)
