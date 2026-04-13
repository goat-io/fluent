// @goatlab/agents-ui — Embeddable workflow dashboard components

// Components
export { WorkflowDAG } from './components/workflow-dag/WorkflowDAG'
export { StepNode } from './components/workflow-dag/StepNode'
export { StepDetailPanel } from './components/step-detail/StepDetailPanel'
export { WorkflowList } from './components/workflow-list/WorkflowList'
export { StatusBadge } from './components/common/StatusBadge'
export { DurationDisplay } from './components/common/DurationDisplay'
export { RelativeTime } from './components/common/RelativeTime'
export { JsonViewer } from './components/common/JsonViewer'

export { MetricsPanel } from './components/metrics/MetricsPanel'
export { StepMetricsTab } from './components/metrics/StepMetricsTab'

// Workflow Editor
export { WorkflowEditor } from './components/workflow-editor/WorkflowEditor'
export { StepPalette } from './components/workflow-editor/StepPalette'
export { StepConfigPanel } from './components/workflow-editor/StepConfigPanel'
export { EditorToolbar } from './components/workflow-editor/EditorToolbar'
export { useWorkflowEditor } from './components/workflow-editor/useWorkflowEditor'

// Pages
export { WorkflowDesigner } from './pages/WorkflowDesigner'

// Providers
export { AgentsProvider, useAgents } from './providers/AgentsProvider'

// API Client
export { AgentsClient } from './api/client'
export type * from './api/types'
