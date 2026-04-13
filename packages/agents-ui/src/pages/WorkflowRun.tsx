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
    return <div className="flex items-center justify-center h-screen bg-[var(--color-surface-0)] text-[var(--color-text-muted)]">Loading...</div>
  }

  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(workflow.status)

  return (
    <div className="h-screen flex flex-col bg-[var(--color-surface-0)]">
      <header className="bg-[var(--color-surface-1)] border-b border-[var(--color-border)] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-sm transition-colors">&larr; Back</Link>
            <div>
              <h1 className="text-base font-bold text-[var(--color-text-primary)]">
                {workflow.workflowName}
                <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">v{workflow.workflowVersion}</span>
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <StatusBadge status={workflow.status} />
                <DurationDisplay startedAt={workflow.startedAt} completedAt={workflow.completedAt} />
                <span className="text-xs text-[var(--color-text-muted)] font-mono">{workflow.id}</span>
                {workflow.traceId && (
                  <Link to={`/trace/${workflow.traceId}`} className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-mono transition-colors">
                    trace: {workflow.traceId.slice(0, 12)}...
                  </Link>
                )}
                {workflow.parentRunId && (
                  <Link to={`/workflows/${workflow.parentRunId}`} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
                    parent: {workflow.parentRunId.slice(0, 8)}...
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/designer?workflow=${encodeURIComponent(workflow.workflowName)}`}
              className="text-xs bg-[var(--color-accent)] text-white rounded-lg px-3 py-1.5 hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Edit Definition
            </Link>
            <button
              onClick={() => setShowSignals(!showSignals)}
              className="text-xs bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] rounded-lg px-3 py-1.5 hover:bg-[var(--color-surface-4)] border border-[var(--color-border)] transition-colors"
            >
              Signals & Queries
            </button>
            {!isTerminal && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-xs bg-red-500/10 text-red-400 rounded-lg px-3 py-1.5 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50 transition-colors"
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
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Send Signal</h4>
              <div className="flex flex-col gap-2">
                <input
                  type="text" value={signalName} onChange={(e) => setSignalName(e.target.value)}
                  placeholder="Signal name"
                  className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
                />
                <textarea
                  value={signalData} onChange={(e) => setSignalData(e.target.value)}
                  rows={2}
                  className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
                  placeholder='{"key": "value"}'
                />
                <button onClick={handleSendSignal} className="text-xs bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-3 py-1.5 self-start transition-colors">
                  Send
                </button>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Execute Query</h4>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text" value={queryName} onChange={(e) => setQueryName(e.target.value)}
                    placeholder="Query name"
                    className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
                  />
                  <button onClick={handleQuery} className="text-xs bg-[var(--color-surface-4)] hover:bg-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-white rounded-lg px-3 py-1.5 transition-colors">
                    Run
                  </button>
                </div>
                {queryResult && (
                  <pre className="text-xs bg-[var(--color-surface-0)] border border-[var(--color-border)] text-green-400 rounded-xl p-3 font-mono max-h-24 overflow-auto">
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
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-[var(--color-accent)]'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--color-text-muted)]">{label}:</span>
      <div className="w-20 h-1.5 bg-[var(--color-surface-4)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[var(--color-text-secondary)] tabular-nums">{prefix}{Math.round(used * 100) / 100}/{prefix}{max}</span>
    </div>
  )
}
