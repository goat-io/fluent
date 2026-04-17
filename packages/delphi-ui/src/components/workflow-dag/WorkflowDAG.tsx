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
        fitViewOptions={{ padding: 0.4, maxZoom: 0.85 }}
        maxZoom={1.5}
        minZoom={0.3}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="hsl(var(--border, 0 0% 85%))" gap={20} />
        <Controls
          showInteractive={false}
          style={{
            backgroundColor: 'hsl(var(--card, 0 0% 100%))',
            borderColor: 'hsl(var(--border, 0 0% 90%))',
            borderRadius: '8px',
            boxShadow: 'none',
          }}
        />
      </ReactFlow>
    </div>
  )
}
