import { useCallback, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAgents } from '@/providers/AgentsProvider'
import { useRealtimeWorkflow } from '@/hooks/useRealtimeWorkflow'
import { WorkflowDAG } from '@/components/workflow-dag/WorkflowDAG'
import { StepDetailPanel } from '@/components/step-detail/StepDetailPanel'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DurationDisplay } from '@/components/common/DurationDisplay'

export function WorkflowRun() {
  const { runId } = useParams<{ runId: string }>()
  const { client } = useAgents()
  const { workflow, loading, setWorkflow } = useRealtimeWorkflow(runId)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)

  const dependencies = useMemo(() => {
    if (!workflow) return {}
    const deps: Record<string, string[]> = {}
    for (const step of workflow.steps) {
      deps[step.stepName] = step.dependsOn ?? []
    }
    return deps
  }, [workflow])

  const selectedStepData = useMemo(() => {
    if (!workflow || !selectedStep) return null
    return workflow.steps.find(s => s.stepName === selectedStep) ?? null
  }, [workflow, selectedStep])

  const handleSubmitHumanInput = useCallback(
    async (stepName: string, data: Record<string, unknown>) => {
      if (!runId) return
      await client.submitHumanInput(runId, stepName, data)
      // Immediate refresh
      const updated = await client.getWorkflow(runId)
      setWorkflow(updated)
    },
    [runId, client, setWorkflow],
  )

  if (loading || !workflow) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">&larr; Back</Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">
              {workflow.workflowName}
              <span className="ml-2 text-xs font-normal text-gray-400">v{workflow.workflowVersion}</span>
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <StatusBadge status={workflow.status} />
              <DurationDisplay startedAt={workflow.startedAt} completedAt={workflow.completedAt} />
              <span className="text-xs text-gray-400 font-mono">{workflow.id}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={selectedStep ? 'flex-1' : 'w-full'}>
          <WorkflowDAG
            steps={workflow.steps}
            dependencies={dependencies}
            selectedStep={selectedStep ?? undefined}
            onStepSelect={setSelectedStep}
          />
        </div>
        {selectedStep && selectedStepData && (
          <div className="w-[400px] shrink-0">
            <StepDetailPanel
              step={selectedStepData}
              onClose={() => setSelectedStep(null)}
              onSubmitHumanInput={handleSubmitHumanInput}
            />
          </div>
        )}
      </div>
    </div>
  )
}
