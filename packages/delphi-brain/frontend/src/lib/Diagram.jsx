/**
 * Generic ReactFlow Diagram wrapper. Reused by App.jsx, DocumentShell
 * (kind: 'diagram' docs), and markdown code-fence embeds.
 *
 * Pure presentational: takes nodes + edges + nodeTypes + onNodeClick. No data
 * coupling to any company.
 */
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from '@xyflow/react'

export default function Diagram({ nodes: nodesIn, edges: edgesIn, nodeTypes, onNodeClick, fitViewPadding = 0.15 }) {
  const [nodes, , onNodesChange] = useNodesState(nodesIn)
  const [edges, , onEdgesChange] = useEdgesState(edgesIn)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onNodeClick?.(node)}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: fitViewPadding }}
      minZoom={0.2}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant="dots" gap={32} size={1} color="#D5DCE1" />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
