/**
 * GraphMode — dispatches by payload.renderer so a single mode can host
 * multiple graph styles. The backend tags each payload with the renderer it
 * expects:
 *
 *   - missing/`layered`  → LayeredDiagram (DiagramPayload: lanes + nodes + edges + legend)
 *   - `dependency`       → DependencyGraph (pre-positioned nodes + system zones)
 *
 * Adding a new graph style means: pick a renderer name, emit it from the
 * server, add a branch here. Nothing else.
 */
import LayeredDiagram from '../../lib/LayeredDiagram.jsx'
import DependencyGraph from '../DependencyGraph.jsx'

export default function GraphMode({ payload, onSelect }) {
  if (payload?.renderer === 'dependency') {
    return (
      <DependencyGraph
        prefetched={payload.data}
        onSelectService={(svc) => onSelect?.({
          id: svc.id || svc.name,
          name: svc.name || svc.id,
          domain: svc.domain,
        })}
      />
    )
  }
  return (
    <LayeredDiagram
      payload={payload}
      onNodeClick={(node) => onSelect?.({
        id: node.id,
        name: node.id,
        kind: node.kind,
      })}
    />
  )
}
