/**
 * Custom React Flow edge that renders the path in SVG (so it sits in the
 * normal edges layer) but the label as an HTML element via
 * `EdgeLabelRenderer` — that layer is rendered ABOVE every SVG edge by
 * React Flow, so labels never get clipped by other lines.
 *
 * Use as `type: 'labeled'` on an edge. Optional `data.curve` selects
 * 'bezier' (default) or 'step' (orthogonal smoothstep). Optional
 * `data.labelT` (0..1) slides the label along the curve so adjacent
 * labels from the same source don't overlap.
 *
 * This is the standard edge component for our diagrams. Both
 * CommunicationsView and SystemsView register it so labels read the
 * same way everywhere.
 */
import {
  BaseEdge, EdgeLabelRenderer,
  getBezierPath, getSmoothStepPath,
} from '@xyflow/react'

function bezierPointAt(t, p0, p1, p2, p3) {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

export function LabelOverlayEdge(props) {
  const {
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    label, data = {}, style = {}, markerEnd,
  } = props
  const opts = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }
  let edgePath, labelX, labelY
  if (data.curve === 'step') {
    [edgePath, labelX, labelY] = getSmoothStepPath({ ...opts, borderRadius: 8 })
  } else {
    [edgePath, labelX, labelY] = getBezierPath(opts)
    if (data.labelT != null) {
      const dx = targetX - sourceX
      const cx = 0.25 * Math.abs(dx)
      const p = bezierPointAt(data.labelT,
        { x: sourceX,      y: sourceY },
        { x: sourceX + cx, y: sourceY },
        { x: targetX - cx, y: targetY },
        { x: targetX,      y: targetY },
      )
      labelX = p.x
      labelY = p.y
    }
  }
  const stroke = style.stroke || 'currentColor'
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              zIndex: 1000,
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: 'var(--background)',
              border: `1px solid ${stroke}55`,
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 10, fontWeight: 600,
              color: stroke,
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              pointerEvents: 'all',
              boxShadow: '0 0 0 2px var(--background)',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const edgeTypes = { labeled: LabelOverlayEdge }

// Global CSS forcing the label-renderer layer above the edges SVG no
// matter how React Flow's default z-indices behave.
export const FORCE_LABELS_ON_TOP = `
  .react-flow__edgelabel-renderer { z-index: 1000 !important; }
  .react-flow__edgelabel-renderer > * { z-index: 1000 !important; }
`
