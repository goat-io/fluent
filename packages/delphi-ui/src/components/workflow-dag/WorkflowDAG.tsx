import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { StepNode } from './StepNode'
import type { StepDetail } from '@/api/types'

interface WorkflowDAGProps {
  steps: StepDetail[]
  dependencies: Record<string, string[]>
  selectedStep?: string
  onStepSelect?: (stepName: string) => void
}

const nodeTypes = { step: StepNode }

function layoutDAG(steps: StepDetail[], dependencies: Record<string, string[]>) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  for (const step of steps) {
    g.setNode(step.stepName, { width: 200, height: 70 })
  }

  for (const [stepName, deps] of Object.entries(dependencies)) {
    for (const dep of deps) {
      g.setEdge(dep, stepName)
    }
  }

  dagre.layout(g)

  const nodes: Node[] = steps.map(step => {
    const pos = g.node(step.stepName)
    return {
      id: step.stepName,
      type: 'step',
      position: { x: pos.x - 100, y: pos.y - 35 },
      data: step as unknown as Record<string, unknown>,
    }
  })

  const edges: Edge[] = []
  for (const [stepName, deps] of Object.entries(dependencies)) {
    for (const dep of deps) {
      edges.push({
        id: `${dep}-${stepName}`,
        source: dep,
        target: stepName,
        animated: steps.find(s => s.stepName === stepName)?.status === 'RUNNING',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      })
    }
  }

  return { nodes, edges }
}

export function WorkflowDAG({
  steps,
  dependencies,
  selectedStep,
  onStepSelect,
}: WorkflowDAGProps) {
  // Recompute layout on every render — nodes update when steps change via SSE
  const { nodes, edges } = useMemo(
    () => layoutDAG(steps, dependencies),
    [steps, dependencies],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onStepSelect?.(node.id),
    [onStepSelect],
  )

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node: Node) => {
            const status = (node.data as unknown as StepDetail)?.status
            if (status === 'COMPLETED') return '#22c55e'
            if (status === 'RUNNING') return '#3b82f6'
            if (status === 'FAILED') return '#ef4444'
            if (status === 'WAITING_HUMAN') return '#a855f7'
            return '#d1d5db'
          }}
        />
      </ReactFlow>
    </div>
  )
}
