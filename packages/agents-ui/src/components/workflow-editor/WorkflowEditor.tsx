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

      const configJson = event.dataTransfer.getData('application/workflow-step-config')
      const prefilledConfig = configJson ? JSON.parse(configJson) : undefined

      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return

      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 35,
      }

      addStep(type, position, prefilledConfig)
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
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface-0, #0a0a0f)' }}>
      <EditorToolbar editor={editor} />

      {/* Validation errors banner */}
      {validationErrors.length > 0 && (
        <ValidationErrorList errors={validationErrors} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - step palette */}
        <StepPalette onAddStep={(type, config) => addStep(type, undefined, config)} />

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
            fitViewOptions={{ padding: 0.5 }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={true}
            nodesConnectable={true}
            deleteKeyCode="Delete"
            snapToGrid={true}
            snapGrid={[20, 20]}
            style={{ background: 'var(--color-surface-0, #0a0a0f)' }}
          >
            <Background color="rgba(255,255,255,0.03)" gap={20} />
            <Controls
              style={{
                background: 'var(--color-surface-2, #1a1a26)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={() => 'var(--color-accent, #6366f1)'}
              style={{
                height: 80,
                width: 120,
                background: 'var(--color-surface-1, #12121a)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
              }}
              maskColor="rgba(0,0,0,0.6)"
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
