/**
 * Universal diagram payload — Phase 8 of PROPOSAL_GENERIC_TREE.md §8.
 *
 * Every backend `/api/diagrams/<view>` endpoint returns this shape; one React
 * component (`<LayeredDiagram>`) consumes it. New views become new backend
 * endpoints, not new React files.
 */

export type DiagramPayload = {
  lanes: Lane[]
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  legend: LegendItem[]
  meta: DiagramMeta
}

export type DiagramMeta = {
  title: string
  view: string
  filters?: Record<string, string | number | boolean>
  generatedAt: string // ISO 8601
}

export type Lane = {
  id: string
  label: string
  color: string
  order: number
  groupBy?: string
}

export type DiagramNode = {
  id: string
  laneId: string
  kind: string
  display: NodeDisplay
  size?: { width: number; height: number }
  clickable: boolean
  layerHint?: number
}

export type NodeDisplay = {
  name: string
  subtitle?: string
  image?: string
  accentColor: string
  badges?: { label: string; color: string }[]
  detail?: string
  placeholder?: { initials: string; fallbackText: string }
}

export type DiagramEdge = {
  id: string
  source: string
  target: string
  protocolFamily: string
  label?: string
  curve: 'bezier' | 'step'
  weight?: number
  dashed?: boolean
}

export type LegendItem = {
  protocolFamily: string
  color: string
  label: string
  dashed?: boolean
}

/**
 * Entity expansion contract — Phase 6 stitcher API.
 * Returned by GET /api/entity/:name and shaped by the backend.
 */
export type StitchedEntry = {
  name: string
  kind: string
  description: string
  system?: string
  layer?: string
  domain?: string
  folder: string
  spec: Record<string, unknown>
  outbound: StitchedEdge[]
  inbound: StitchedEdge[]
}

export type StitchedEdge = {
  relation: string
  source: string
  target: string
  kind?: string
  meta?: { protocol?: string; port?: number; purpose?: string; instance?: string }
}
