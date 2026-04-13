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
  const [cancelling, setCancelling] = useState(false)

  // Signals panel
  const [showSignals, setShowSignals] = useState(false)
  const [signalName, setSignalName] = useState('')
  const [signalData, setSignalData] = useState('{}')
  const [queryName, setQueryName] = useState('')
  const [queryResult, setQueryResult] = useState<string | null>(null)

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
      const updated = await client.getWorkflow(runId)
      setWorkflow(updated)
    },
    [runId, client, setWorkflow],
  )

  const handleCancel = useCallback(async () => {
    if (!runId || cancelling) return
    if (!confirm('Cancel this workflow? Running steps will be aborted.')) return
    setCancelling(true)
    try {
      await client.cancelWorkflow(runId)
      const updated = await client.getWorkflow(runId)
      setWorkflow(updated)
    } finally {
      setCancelling(false)
    }
  }, [runId, client, setWorkflow, cancelling])

  const handleSendSignal = useCallback(async () => {
    if (!runId || !signalName.trim()) return
    try {
      const data = JSON.parse(signalData)
      await client.sendSignal(runId, signalName, data)
      setSignalName('')
      setSignalData('{}')
    } catch (err: any) {
      alert(`Signal error: ${err.message}`)
    }
  }, [runId, client, signalName, signalData])

  const handleQuery = useCallback(async () => {
    if (!runId || !queryName.trim()) return
    try {
      const result = await client.query(runId, queryName)
      setQueryResult(JSON.stringify(result, null, 2))
    } catch (err: any) {
      setQueryResult(`Error: ${err.message}`)
    }
  }, [runId, client, queryName])

  if (loading || !workflow) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  }

  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(workflow.status)

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">&larr; Back</Link>
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {workflow.workflowName}
                <span className="ml-2 text-xs font-normal text-gray-400">v{workflow.workflowVersion}</span>
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <StatusBadge status={workflow.status} />
                <DurationDisplay startedAt={workflow.startedAt} completedAt={workflow.completedAt} />
                <span className="text-xs text-gray-400 font-mono">{workflow.id}</span>
                {workflow.traceId && (
                  <Link to={`/trace/${workflow.traceId}`} className="text-xs text-blue-500 hover:text-blue-700 font-mono">
                    trace: {workflow.traceId.slice(0, 12)}...
                  </Link>
                )}
                {workflow.parentRunId && (
                  <Link to={`/workflows/${workflow.parentRunId}`} className="text-xs text-gray-400 hover:text-gray-600">
                    parent: {workflow.parentRunId.slice(0, 8)}...
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSignals(!showSignals)}
              className="text-xs bg-gray-100 text-gray-700 rounded-md px-3 py-1.5 hover:bg-gray-200 border border-gray-300"
            >
              Signals & Queries
            </button>
            {!isTerminal && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-xs bg-red-50 text-red-600 rounded-md px-3 py-1.5 hover:bg-red-100 border border-red-200 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
          </div>
        </div>

        {/* Budget Usage */}
        {workflow.budget && workflow.budgetUsed && (
          <div className="mt-2 flex items-center gap-4 text-xs">
            {workflow.budget.maxSteps && (
              <BudgetMeter
                label="Steps"
                used={workflow.budgetUsed.steps}
                max={workflow.budget.maxSteps}
              />
            )}
            {workflow.budget.maxTokens && (
              <BudgetMeter
                label="Tokens"
                used={workflow.budgetUsed.tokens}
                max={workflow.budget.maxTokens}
              />
            )}
            {workflow.budget.maxCostUsd && (
              <BudgetMeter
                label="Cost"
                used={workflow.budgetUsed.costUsd}
                max={workflow.budget.maxCostUsd}
                prefix="$"
              />
            )}
          </div>
        )}

        {/* Signals & Queries Panel */}
        {showSignals && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">Send Signal</h4>
              <div className="flex flex-col gap-2">
                <input
                  type="text" value={signalName} onChange={(e) => setSignalName(e.target.value)}
                  placeholder="Signal name" className="border border-gray-300 rounded px-2 py-1 text-xs"
                />
                <textarea
                  value={signalData} onChange={(e) => setSignalData(e.target.value)}
                  rows={2} className="border border-gray-300 rounded px-2 py-1 text-xs font-mono" placeholder='{"key": "value"}'
                />
                <button onClick={handleSendSignal} className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 self-start">
                  Send
                </button>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">Execute Query</h4>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text" value={queryName} onChange={(e) => setQueryName(e.target.value)}
                    placeholder="Query name" className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
                  />
                  <button onClick={handleQuery} className="text-xs bg-gray-700 text-white rounded px-3 py-1 hover:bg-gray-800">
                    Run
                  </button>
                </div>
                {queryResult && (
                  <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 font-mono max-h-24 overflow-auto">
                    {queryResult}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
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

function BudgetMeter({ label, used, max, prefix = '' }: { label: string; used: number; max: number; prefix?: string }) {
  const pct = Math.min((used / max) * 100, 100)
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500">{label}:</span>
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-600 tabular-nums">{prefix}{Math.round(used * 100) / 100}/{prefix}{max}</span>
    </div>
  )
}
