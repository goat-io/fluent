/**
 * LayeredDiagram — single React component that renders any DiagramPayload
 * from `/api/diagrams/<view>`. Implements PROPOSAL_GENERIC_TREE.md §8.
 *
 * The contract (DiagramPayload):
 *   - lanes[]   — swim lane definitions (id, label, color, order)
 *   - nodes[]   — entities to render (id, laneId, kind, display, layerHint?)
 *   - edges[]   — typed connections (source, target, protocolFamily, label?, curve)
 *   - legend[]  — protocolFamily → color, populates the protocol legend
 *   - meta      — title, view name, generatedAt
 *
 * What stays here (per `diagram-solution` skill, kept generic):
 *   - ELK layout via shared `layoutLayered` (lib/layoutEngine)
 *   - Custom edges with `LabelOverlayEdge` (lib/edgeOverlay)
 *   - Handle distribution: per-node multiple edges spread across l-top/mid/bot,
 *     r-top/mid/bot so lines don't overlap (skill rules §11–§13)
 *   - Lane bands rendered as background nodes (skill rule §5)
 *   - Image fallback for product photos (skill rule §21)
 *
 * What's NOT here:
 *   - Any view-specific data fetching — caller passes payload + onNodeClick
 *   - Any kind-specific rendering branches — node display is driven entirely
 *     by `node.display` fields. New kinds work without code changes.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, Handle, Position, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutLayered } from './layoutEngine'
import { edgeTypes as labeledEdgeTypes, FORCE_LABELS_ON_TOP } from './edgeOverlay'

const NODE_W = 240
const NODE_H_MEDIA = 180   // with image
const NODE_H_TEXT  = 132   // without image

// ─── Lane band node ────────────────────────────────────────────
function LaneBand({ data }) {
  return (
    <div style={{
      width: data.width, height: data.height,
      background: `${data.color}08`,
      border: `1px dashed ${data.color}55`,
      borderRadius: 12,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 8, left: 12,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: data.color,
      }}>
        {data.order != null ? `${circle(data.order)} ` : ''}{data.label}
      </div>
    </div>
  )
}
const CIRCLE = ['①','②','③','④','⑤','⑥','⑦','⑧']
function circle(n) { return CIRCLE[n] ?? `(${n + 1})` }

// ─── Generic node types ────────────────────────────────────────
function MediaNode({ data }) {
  const [errored, setErrored] = useState(false)
  const display = data.display
  return (
    <div
      onClick={data.onClick}
      title={data.onClick ? 'Open details' : undefined}
      style={{
        width: NODE_W,
        background: 'var(--surface, #fff)',
        border: `1.5px solid ${display.accentColor}33`,
        borderLeft: `4px solid ${display.accentColor}`,
        borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        fontFamily: 'var(--font-sans)',
        cursor: data.onClick ? 'pointer' : 'default',
      }}>
      <div style={{
        width: '100%', height: 100, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: `1px solid ${display.accentColor}22`,
        overflow: 'hidden',
      }}>
        {!errored && display.image ? (
          <img
            src={`${import.meta.env.BASE_URL}${display.image.replace(/^\/+/, '')}`}
            alt={display.name}
            onError={() => setErrored(true)}
            style={{ maxWidth: '90%', maxHeight: 90, objectFit: 'contain' }}
          />
        ) : (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700,
            color: `${display.accentColor}66`,
          }}>
            {display.placeholder?.initials || '?'}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{display.name}</div>
        {display.subtitle && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {display.subtitle}
          </div>
        )}
        {display.detail && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.35,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {display.detail}
          </div>
        )}
      </div>
      {renderHandles(data.handles, display.accentColor)}
    </div>
  )
}

function EntityNode({ data }) {
  const display = data.display
  return (
    <div
      onClick={data.onClick}
      title={data.onClick ? 'Open details' : undefined}
      style={{
        width: NODE_W, padding: '12px 14px',
        background: 'var(--surface, #fff)',
        border: `1.5px solid ${display.accentColor}33`,
        borderLeft: `4px solid ${display.accentColor}`,
        borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        fontFamily: 'var(--font-sans)',
        cursor: data.onClick ? 'pointer' : 'default',
      }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{display.name}</div>
      {display.subtitle && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {display.subtitle}
        </div>
      )}
      {display.detail && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {display.detail}
        </div>
      )}
      {display.badges && display.badges.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {display.badges.map((b, i) => (
            <span key={i} style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: `${b.color}18`, color: b.color, border: `1px solid ${b.color}33`,
            }}>{b.label}</span>
          ))}
        </div>
      )}
      {renderHandles(data.handles, display.accentColor)}
    </div>
  )
}

const HANDLE_BASE = {
  width: 8, height: 8, border: 'none', opacity: 0.9,
}
const TOP_PCTS = { 1: ['50%'], 2: ['30%','70%'], 3: ['25%','50%','75%'], 4: ['20%','40%','60%','80%'] }

function renderHandles(handles, defaultColor) {
  if (!handles) return null
  // handles = { 'l-0': color, 'l-1': color, 'r-0': color, ... }
  const left  = Object.keys(handles).filter(k => k.startsWith('l-')).sort()
  const right = Object.keys(handles).filter(k => k.startsWith('r-')).sort()
  const leftPcts  = TOP_PCTS[left.length]  || left.map((_, i) => `${((i + 1) * 100) / (left.length + 1)}%`)
  const rightPcts = TOP_PCTS[right.length] || right.map((_, i) => `${((i + 1) * 100) / (right.length + 1)}%`)
  return (
    <>
      {left.map((id, i) => (
        <Handle key={id} id={id} type="target" position={Position.Left}
                style={{ ...HANDLE_BASE, top: leftPcts[i], background: handles[id] || defaultColor }} />
      ))}
      {right.map((id, i) => (
        <Handle key={id} id={id} type="source" position={Position.Right}
                style={{ ...HANDLE_BASE, top: rightPcts[i], background: handles[id] || defaultColor }} />
      ))}
    </>
  )
}

const nodeTypes = {
  media: MediaNode,
  entity: EntityNode,
  band: LaneBand,
}
const edgeTypes = labeledEdgeTypes // { labeled: LabelOverlayEdge }

// ─── Edge handle assignment ────────────────────────────────────
//
// For each node, sort outgoing edges by target's vertical position; assign
// `r-0`, `r-1`, … in that order. Same for incoming. This guarantees lines
// don't cross at the connection point (skill rules §11–§13).
function assignHandles(positionedNodes, edges) {
  const yById = new Map(positionedNodes.map(n => [n.id, n.y + n.height / 2]))
  const outBySource = new Map()
  const inByTarget = new Map()
  edges.forEach(e => {
    if (!outBySource.has(e.source)) outBySource.set(e.source, [])
    outBySource.get(e.source).push(e)
    if (!inByTarget.has(e.target)) inByTarget.set(e.target, [])
    inByTarget.get(e.target).push(e)
  })
  const assignment = new Map() // edge.id → { sourceHandle, targetHandle }
  outBySource.forEach((list, src) => {
    list.sort((a, b) => (yById.get(a.target) || 0) - (yById.get(b.target) || 0))
    list.forEach((e, i) => {
      const a = assignment.get(e.id) || {}
      a.sourceHandle = `r-${i}`
      assignment.set(e.id, a)
    })
  })
  inByTarget.forEach((list, tgt) => {
    list.sort((a, b) => (yById.get(a.source) || 0) - (yById.get(b.source) || 0))
    list.forEach((e, i) => {
      const a = assignment.get(e.id) || {}
      a.targetHandle = `l-${i}`
      assignment.set(e.id, a)
    })
  })
  return assignment
}

// ─── Main component ────────────────────────────────────────────
export default function LayeredDiagram({ payload, onNodeClick }) {
  const [graph, setGraph] = useState({ nodes: [], edges: [] })

  // Memoise legend lookup so each render doesn't rebuild it.
  const colorOf = useMemo(() => {
    const m = new Map()
    ;(payload?.legend || []).forEach(l => m.set(l.protocolFamily, l.color))
    return f => m.get(f) || '#94A3B8'
  }, [payload])

  // Build the graph once payload arrives (or changes).
  useEffect(() => {
    if (!payload?.nodes?.length) {
      setGraph({ nodes: [], edges: [] })
      return
    }
    let cancelled = false
    buildGraph(payload, colorOf).then(g => {
      if (!cancelled) setGraph(g)
    }).catch(err => console.error('[LayeredDiagram] layout failed:', err))
    return () => { cancelled = true }
  }, [payload, colorOf])

  // Apply onClick at render time (fresh callback closure).
  const decoratedNodes = useMemo(() => graph.nodes.map(n => {
    if (n.type === 'band' || !n.data?.payloadNode?.clickable || !onNodeClick) return n
    return { ...n, data: { ...n.data, onClick: () => onNodeClick(n.data.payloadNode) } }
  }), [graph, onNodeClick])

  if (!payload) return <Loader text="Loading…" />
  if (!payload.nodes?.length) return <Loader text="No data." />

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--background, #FAFBFC)', position: 'relative' }}>
      <style>{FORCE_LABELS_ON_TOP}</style>
      <Legend legend={payload.legend} title={payload.meta?.title} />
      <ReactFlow
        nodes={decoratedNodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={24} size={1} color="var(--border, #E2E8F0)" />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

function Loader({ text }) {
  return <div style={{ padding: 40, color: 'var(--text-muted, #94A3B8)' }}>{text}</div>
}

// ─── Build the React Flow graph ────────────────────────────────
async function buildGraph(payload, colorOf) {
  // 1. Compute a layer hint per node — prefer payload.node.layerHint, fall
  //    back to the lane's `order` value, fall back to nothing.
  const laneById = new Map((payload.lanes || []).map(l => [l.id, l]))
  const rawNodes = payload.nodes.map(n => {
    const lane = laneById.get(n.laneId)
    const layer = n.layerHint != null ? n.layerHint : (lane?.order != null ? lane.order : null)
    const hasImage = !!n.display?.image
    return {
      id: n.id,
      width: n.size?.width || NODE_W,
      height: n.size?.height || (hasImage ? NODE_H_MEDIA : NODE_H_TEXT),
      ...(layer != null ? { layer } : {}),
    }
  })
  const rawEdges = payload.edges.map(e => ({ id: e.id, source: e.source, target: e.target }))

  // 2. ELK layout.
  const positioned = await layoutLayered(rawNodes, rawEdges, {
    nodeWidth: NODE_W,
    layerSpacing: 280,
    nodeSpacing: 70,
    padding: 80,
  })
  const posById = new Map(positioned.nodes.map(p => [p.id, p]))

  // 3. Assign handles per node based on edge topology (rule §11–§13).
  const handleAssignment = assignHandles(positioned.nodes, payload.edges)

  // 4. Group nodes per lane to compute band bounds.
  const laneNodes = new Map() // laneId → [positions]
  payload.nodes.forEach(n => {
    const p = posById.get(n.id)
    if (!p) return
    if (!laneNodes.has(n.laneId)) laneNodes.set(n.laneId, [])
    laneNodes.get(n.laneId).push(p)
  })

  // Make every band span the full vertical extent (skill rule §5: uniform lanes).
  let globalMinY = Infinity, globalMaxY = -Infinity
  positioned.nodes.forEach(p => {
    globalMinY = Math.min(globalMinY, p.y)
    globalMaxY = Math.max(globalMaxY, p.y + p.height)
  })
  const bandTop = globalMinY - 56
  const bandBottom = globalMaxY + 24
  const bandPadX = 24

  const reactFlowNodes = []

  // 4a. Lane bands (rendered first so they sit underneath).
  laneNodes.forEach((ps, laneId) => {
    const lane = laneById.get(laneId)
    if (!lane) return
    const minX = Math.min(...ps.map(p => p.x))
    const maxX = Math.max(...ps.map(p => p.x + p.width))
    reactFlowNodes.push({
      id: `band-${laneId}`,
      type: 'band',
      position: { x: minX - bandPadX, y: bandTop },
      data: {
        label: lane.label,
        color: lane.color,
        order: lane.order,
        width: (maxX - minX) + bandPadX * 2,
        height: bandBottom - bandTop,
      },
      draggable: false, selectable: false, zIndex: -10,
    })
  })

  // 4b. Compute handles per node from edge topology.
  const handlesByNode = {}
  payload.edges.forEach(e => {
    const a = handleAssignment.get(e.id)
    if (!a) return
    const stroke = colorOf(e.protocolFamily)
    if (a.sourceHandle) {
      handlesByNode[e.source] ||= {}
      handlesByNode[e.source][a.sourceHandle] = stroke
    }
    if (a.targetHandle) {
      handlesByNode[e.target] ||= {}
      handlesByNode[e.target][a.targetHandle] = stroke
    }
  })

  // 4c. Entity nodes.
  payload.nodes.forEach(n => {
    const p = posById.get(n.id)
    if (!p) return
    const hasImage = !!n.display?.image
    reactFlowNodes.push({
      id: n.id,
      type: hasImage ? 'media' : 'entity',
      position: { x: p.x, y: p.y },
      data: {
        display: n.display,
        handles: handlesByNode[n.id],
        payloadNode: n,
      },
      draggable: false,
    })
  })

  // 5. Edges. Pick curve style: bezier when source has 2+ outgoing (fan-out),
  //    smoothstep otherwise (better for fan-in / single edge). Stagger labels
  //    along bezier curves when 2+ leave the same source.
  const outDegree = new Map()
  payload.edges.forEach(e => {
    outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1)
  })
  const sourceLabelIdx = new Map() // source → running counter
  const reactFlowEdges = payload.edges.map(e => {
    const stroke = colorOf(e.protocolFamily)
    const a = handleAssignment.get(e.id) || {}
    const fanOut = (outDegree.get(e.source) || 0) > 1
    const curve = e.curve || (fanOut ? 'bezier' : 'step')
    let labelT
    if (fanOut && curve === 'bezier' && e.label) {
      const i = sourceLabelIdx.get(e.source) || 0
      const n = outDegree.get(e.source)
      // Stagger labelT in [0.40 .. 0.75] across the fan-out group.
      labelT = 0.40 + (n > 1 ? (0.35 * i) / (n - 1) : 0)
      sourceLabelIdx.set(e.source, i + 1)
    }
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: a.sourceHandle,
      targetHandle: a.targetHandle,
      type: 'labeled',
      label: e.label,
      data: { curve, labelT },
      style: {
        stroke, strokeWidth: e.weight ? Math.min(1 + e.weight * 0.4, 4) : 1.5,
        strokeDasharray: e.dashed ? '6 4' : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
    }
  })

  return { nodes: reactFlowNodes, edges: reactFlowEdges }
}

// ─── Legend (top-left, collapsed by default per skill rule §18) ─
function Legend({ legend, title }) {
  const [open, setOpen] = useState(false)
  if (!legend?.length) return null
  return (
    <div style={{
      position: 'absolute', top: 16, left: 16, zIndex: 5,
      background: 'var(--surface, #fff)',
      border: '1px solid var(--border, #E2E8F0)',
      borderRadius: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      fontFamily: 'var(--font-sans)',
      maxWidth: 320,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '8px 12px', textAlign: 'left',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
          textTransform: 'uppercase', color: 'var(--text-muted, #64748B)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
        <span>{open ? '▼' : '▶'}</span>
        <span>Protocol legend</span>
        {title && <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>{title}</span>}
      </button>
      {open && (
        <div style={{ padding: '4px 12px 10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {legend.map(l => (
            <div key={l.protocolFamily} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <div style={{
                width: 24, height: 2, background: l.color,
                ...(l.dashed ? { borderTop: `2px dashed ${l.color}`, background: 'transparent' } : {}),
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted, #64748B)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
