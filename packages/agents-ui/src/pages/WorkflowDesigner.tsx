import { NavHeader } from '@/components/common/NavHeader'
import { WorkflowEditor } from '@/components/workflow-editor/WorkflowEditor'

export function WorkflowDesigner() {
  return (
    <div className="h-screen flex flex-col bg-[var(--color-surface-0)]">
      <NavHeader title="Workflow Designer" />
      <div className="flex-1 overflow-hidden">
        <WorkflowEditor />
      </div>
    </div>
  )
}
