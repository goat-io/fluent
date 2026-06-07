/**
 * ReactFlow node types registry — lifted out of App.jsx so any diagram
 * component (App's main canvas, Documents-mounted diagrams, markdown-embed
 * diagrams) can consume the same map.
 */
import {
  DeviceNode, ServiceNode, CoreNode, LabelNode, ZoneNode,
  DatabaseNode, PersonaNode, StepNode, InfraNode,
  SwimLaneNode, LayerDividerNode, CanvasBlockNode,
} from './nodes'

export const nodeTypes = {
  device: DeviceNode, service: ServiceNode, core: CoreNode,
  label: LabelNode, zone: ZoneNode, database: DatabaseNode,
  persona: PersonaNode, step: StepNode, infra: InfraNode,
  swimlane: SwimLaneNode, layerdivider: LayerDividerNode,
  canvasblock: CanvasBlockNode,
}
