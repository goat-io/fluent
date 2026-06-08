/**
 * DependencyGraph — renders pre-computed graph from Brain API.
 * All node positions, edges, and zones are computed server-side.
 * Frontend only handles rendering + interaction (click, filter, search highlight).
 */
import { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ReactFlow, Background, Controls, MiniMap,
  Handle, Position, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { fetchGraph } from '../api'
import { domainOf, statusOf } from '../lib/badgeRegistry'

// Domain + status colour maps come from lib/badgeRegistry — generic Brain
// fallback + `_instance/lib/domains.js` for the company-specific palette.
// No domain ids hardcoded here.

// ── Custom node ──
function CatalogNode({ data }) {
  const dc = domainOf(data.domain).color ?? '#94A3B8'
  const sc = statusOf(data.status).color ?? 'var(--status-neutral)'
  const isProd = data.status === 'production'

  return (
    <div
      onClick={data.onClick}
      title={data.description || data.name}
      style={{
        width: 220, minHeight: 52,
        background: data.dimmed ? 'var(--surface-raised)' : 'var(--surface)',
        border: `${isProd ? 2 : 1.5}px solid ${data.highlighted ? dc : data.dimmed ? 'var(--border)' : `${dc}55`}`,
        borderRadius: 8, padding: '7px 10px',
        display: 'flex', flexDirection: 'column', gap: 3,
        cursor: 'pointer',
        opacity: data.dimmed ? 0.35 : 1,
        transition: 'opacity 150ms ease, border-color 150ms ease',
        fontFamily: 'var(--font-sans)',
        boxShadow: data.highlighted
          ? `0 0 0 2px ${dc}40, 0 2px 8px rgba(0,0,0,0.08)`
          : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc, flexShrink: 0 }} />
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: data.dimmed ? 'var(--text-muted)' : 'var(--text-heading)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>{data.name}</span>
        {data.hasSecurity && <span title="Security findings" style={{ fontSize: 11 }}>⚠</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          fontSize: 9, fontWeight: 600, color: dc,
          background: `${dc}14`, border: `1px solid ${dc}22`,
          padding: '1px 6px', borderRadius: 4,
        }}>{data.domain}</span>
        {data.language && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {data.language}
          </span>
        )}
        {data.depCount > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {data.depCount}↗
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left}
        style={{ width: 6, height: 6, background: dc, border: 'none', opacity: 0.6 }} />
      <Handle type="source" position={Position.Right}
        style={{ width: 6, height: 6, background: dc, border: 'none', opacity: 0.6 }} />
    </div>
  )
}

// ── Zone background ──
function ZoneBgNode({ data }) {
  const dc = domainOf(data.domain)?.color ?? '#94A3B8'
  return (
    <div style={{
      width: data.width, height: data.height,
      background: `${dc}07`, border: `1px solid ${dc}20`, borderRadius: 12,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 10, left: 14,
        fontSize: 11, fontWeight: 700, color: dc,
        letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.7,
        fontFamily: 'var(--font-sans)',
      }}>
        {data.label}
        {data.team && (
          <span style={{ fontWeight: 400, opacity: 0.7, textTransform: 'none', marginLeft: 6 }}>
            · {data.team}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Horizontal type lane ──
function LaneNode({ data }) {
  return (
    <div style={{
      width: data.width, height: data.height,
      background: 'rgba(0,0,0,0.015)',
      borderTop: '1px dashed var(--border)',
      borderBottom: '1px dashed var(--border)',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 6, right: 14,
        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
        letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.5,
        fontFamily: 'var(--font-sans)',
      }}>
        {data.label}
      </div>
    </div>
  )
}

const nodeTypes = { catalogNode: CatalogNode, zoneBg: ZoneBgNode, lane: LaneNode }

// ── Main component ──
export default function DependencyGraph({ domainFilter, typeFilter, teamFilter, kindFilter, layerFilter, systemFilter, search, onSelectService, prefetched }) {
  // When a parent passes `prefetched`, skip the network round-trip — the
  // UnifiedView route fetches via /api/scope/catalog/graph and hands the
  // payload down. CatalogView still triggers its own fetch.
  const { data: fetched, isLoading } = useQuery({
    queryKey: ['architecture-graph'],
    queryFn: fetchGraph,
    staleTime: Infinity,
    enabled: !prefetched,
  })
  const graph = prefetched ?? fetched

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] }

    const allNames = new Set(graph.nodes.map(n => n.id))
    const q = (search ?? '').toLowerCase().trim()
    const hasSearch = q.length > 0

    // Search highlighting
    const highlighted = new Set()
    if (hasSearch) {
      graph.nodes.forEach(n => {
        if (n.name.toLowerCase().includes(q) || (n.domain ?? '').includes(q) ||
            (n.description ?? '').toLowerCase().includes(q) || (n.language ?? '').includes(q))
          highlighted.add(n.id)
      })
    }

    // Build node lookup for filtering
    const nodeById = {}
    graph.nodes.forEach(n => { nodeById[n.id] = n })

    // Apply all filters — start with all, narrow down
    let visible = allNames

    // Domain filter
    if (domainFilter && domainFilter !== 'all') {
      const primary = new Set(graph.nodes.filter(n => n.domain === domainFilter).map(n => n.id))
      const depNames = new Set()
      graph.edges.forEach(e => {
        if (primary.has(e.source) && allNames.has(e.target)) depNames.add(e.target)
        if (primary.has(e.target) && allNames.has(e.source)) depNames.add(e.source)
      })
      visible = new Set([...primary, ...depNames])
    }

    // Type filter
    if (typeFilter && typeFilter !== 'all') {
      const typeMatch = new Set(graph.nodes.filter(n => n.type === typeFilter).map(n => n.id))
      visible = new Set([...visible].filter(id => typeMatch.has(id)))
    }

    // Team filter
    if (teamFilter && teamFilter !== 'all') {
      const teamMatch = new Set(graph.nodes.filter(n => n.team === teamFilter).map(n => n.id))
      visible = new Set([...visible].filter(id => teamMatch.has(id)))
    }

    // Kind filter (NEW)
    if (kindFilter && kindFilter !== 'all') {
      const kindMatch = new Set(graph.nodes.filter(n => (n.kind || 'repo') === kindFilter).map(n => n.id))
      visible = new Set([...visible].filter(id => kindMatch.has(id)))
    }

    // Layer filter (NEW)
    if (layerFilter && layerFilter !== 'all') {
      const layerMatch = new Set(graph.nodes.filter(n => n.layer === layerFilter).map(n => n.id))
      visible = new Set([...visible].filter(id => layerMatch.has(id)))
    }

    // System filter (NEW)
    if (systemFilter && systemFilter !== 'all') {
      const systemMatch = new Set(graph.nodes.filter(n => n.system === systemFilter).map(n => n.id))
      visible = new Set([...visible].filter(id => systemMatch.has(id)))
    }

    // Search filter
    if (hasSearch) {
      visible = new Set([...visible].filter(id => highlighted.has(id)))
    }

    // Determine which domains have visible nodes (for zone filtering)
    const visibleDomains = new Set()
    graph.nodes.forEach(n => { if (visible.has(n.id)) visibleDomains.add(n.domain) })

    // Build zone nodes — only for domains that have visible nodes
    const zoneNodes = graph.zones
      .filter(z => visibleDomains.has(z.domain))
      .map(z => ({
        id: `zone-${z.domain}`,
        type: 'zoneBg',
        position: { x: z.x, y: z.y },
        data: { domain: z.domain, label: z.label, team: z.team, width: z.width, height: z.height },
        zIndex: -1, draggable: false, selectable: false,
      }))

    // Build horizontal type lane nodes
    const laneNodes = (graph.lanes ?? []).map(lane => ({
      id: `lane-${lane.type}`,
      type: 'lane',
      position: { x: -80, y: lane.y },
      data: { label: lane.label, width: 2200, height: lane.height },
      zIndex: -2, draggable: false, selectable: false,
    }))

    // Build repo nodes — only visible ones
    const repoNodes = graph.nodes
      .filter(n => visible.has(n.id))
      .map(n => ({
        id: n.id,
        type: 'catalogNode',
        position: { x: n.x, y: n.y },
        data: {
          ...n,
          dimmed: false,
          highlighted: hasSearch && highlighted.has(n.id),
          onClick: () => onSelectService?.({
            id: n.id, name: n.name, domain: n.domain, team: n.team,
            tech: n.language, status: n.status, description: n.description,
          }),
        },
      }))

    // Build edges — only between visible nodes
    const graphEdges = graph.edges
      .filter(e => visible.has(e.source) && visible.has(e.target))
      .map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'default',
        animated: false,
        style: { stroke: '#94A3B8', strokeWidth: 1.2, opacity: 0.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: '#94A3B8' },
      }))

    return { nodes: [...laneNodes, ...zoneNodes, ...repoNodes], edges: graphEdges }
  }, [graph, domainFilter, typeFilter, teamFilter, kindFilter, layerFilter, systemFilter, search, onSelectService])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading dependency graph...
      </div>
    )
  }

  const mmColor = (node) => domainOf(node?.data?.domain)?.color ?? '#94A3B8'

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background variant="dots" gap={32} size={1} color="#D5DCE1" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)',
        padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
      }}>
        {graph?.nodes?.length ?? 0} services · {graph?.edges?.length ?? 0} dependencies
      </div>
    </div>
  )
}
