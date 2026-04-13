import { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useWorkflowEditor } from './useWorkflowEditor'
import type { ExecutorType } from './useWorkflowEditor'
import { StepPalette } from './StepPalette'
import { StepConfigPanel } from './StepConfigPanel'
import { EditorToolbar } from './EditorToolbar'
import { EditorStepNode } from './EditorStepNode'
import { ValidationErrorList } from './ValidationErrorList'
import { WorkflowSettingsPanel } from './WorkflowSettingsPanel'

const nodeTypes = { editorStep: EditorStepNode }

export function WorkflowEditor() {
  const editor = useWorkflowEditor()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const {
    nodes,
    edges,
    selectedNodeId,
    validationErrors,
    setNodes,
    setEdges,
    setSelectedNodeId,
    addStep,
    removeStep,
    onConnect,
  } = editor

  // ── React Flow event handlers ──────────────────────────────

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Handle selection changes
      for (const change of changes) {
        if (change.type === 'select' && change.selected) {
          setSelectedNodeId(change.id)
        }
      }
      setNodes((prev) => applyNodeChanges(changes, prev))
    },
    [setNodes, setSelectedNodeId],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((prev) => applyEdgeChanges(changes, prev))
    },
    [setEdges],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        removeStep(node.id)
      }
    },
    [removeStep],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  // ── Drag & Drop from palette ───────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/workflow-step-type') as ExecutorType
      if (!type) return

      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return

      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 35,
      }

      addStep(type, position)
    },
    [addStep],
  )

  // Highlight selected node
  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    [nodes, selectedNodeId],
  )

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />

      {/* Validation errors banner */}
      {validationErrors.length > 0 && (
        <ValidationErrorList errors={validationErrors} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - step palette */}
        <StepPalette onAddStep={(type) => addStep(type)} />

        {/* Center - React Flow canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={styledNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={true}
            nodesConnectable={true}
            deleteKeyCode="Delete"
            snapToGrid={true}
            snapGrid={[20, 20]}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={() => '#93c5fd'}
              style={{ height: 80, width: 120 }}
            />
          </ReactFlow>
        </div>

        {/* Right sidebar - step config */}
        <StepConfigPanel editor={editor} />
      </div>

      {/* Settings modal */}
      {editor.showSettings && <WorkflowSettingsPanel editor={editor} />}
    </div>
  )
}
