import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAgents } from '@/providers/AgentsProvider'
import { WorkflowDAG } from '@/components/workflow-dag/WorkflowDAG'
import { StepDetailPanel } from '@/components/step-detail/StepDetailPanel'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DurationDisplay } from '@/components/common/DurationDisplay'
import { RelativeTime } from '@/components/common/RelativeTime'
import { NavHeader } from '@/components/common/NavHeader'
import type { WorkflowRunSummary, WorkflowRunDetail } from '@/api/types'

export function WorkflowView() {
  const { workflowName } = useParams<{ workflowName: string }>()
  const [searchParams] = useSearchParams()
  const { client } = useAgents()

  const [runs, setRuns] = useState<WorkflowRunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(searchParams.get('run'))
  const [runDetail, setRunDetail] = useState<WorkflowRunDetail | null>(null)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTrigger, setShowTrigger] = useState(false)
  const [triggerInput, setTriggerInput] = useState('{}')
  const [inputFields, setInputFields] = useState<Array<{ name: string; source: string }>>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  // Fetch workflow definition (for input fields)
  useEffect(() => {
    if (!workflowName) return
    client.getDefinition(workflowName).then(def => {
      setInputFields(def.inputFields)
      const defaults: Record<string, string> = {}
      for (const f of def.inputFields) defaults[f.name] = ''
      setFieldValues(defaults)
    }).catch(() => {})
  }, [client, workflowName])

  // Fetch runs for this workflow
  const fetchRuns = useCallback(() => {
    if (!workflowName) return
    client.listWorkflows({ workflowName, limit: 50 })
      .then(data => {
        setRuns(data)
        // Auto-select most recent run if none selected
        if (!selectedRunId && data.length > 0) {
          setSelectedRunId(data[0].id)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [client, workflowName, selectedRunId])

  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, 3000)
    return () => clearInterval(interval)
  }, [fetchRuns])

  // Fetch full detail when selected run changes
  useEffect(() => {
    if (!selectedRunId) { setRunDetail(null); return }
    client.getWorkflow(selectedRunId).then(setRunDetail).catch(() => {})
    const interval = setInterval(() => {
      client.getWorkflow(selectedRunId).then(setRunDetail).catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [selectedRunId, client])

  const dependencies = useMemo(() => {
    if (!runDetail) return {}
    const deps: Record<string, string[]> = {}
    for (const step of runDetail.steps) {
      deps[step.stepName] = step.dependsOn ?? []
    }
    return deps
  }, [runDetail])

  const selectedStepData = useMemo(() => {
    if (!runDetail || !selectedStep) return null
    return runDetail.steps.find(s => s.stepName === selectedStep) ?? null
  }, [runDetail, selectedStep])

  const handleSubmitHumanInput = useCallback(
    async (stepName: string, data: Record<string, unknown>) => {
      if (!selectedRunId) return
      await client.submitHumanInput(selectedRunId, stepName, data)
      const updated = await client.getWorkflow(selectedRunId)
      setRunDetail(updated)
    },
    [selectedRunId, client],
  )

  const handleTrigger = useCallback(async () => {
    if (!workflowName) return
    try {
      let input: Record<string, unknown>
      if (inputFields.length > 0) {
        // Build input from structured fields
        input = {}
        for (const f of inputFields) {
          if (fieldValues[f.name]) input[f.name] = fieldValues[f.name]
        }
      } else {
        // Fallback to raw JSON
        input = JSON.parse(triggerInput)
      }
      await client.startWorkflow(workflowName, input)
      setShowTrigger(false)
      setFieldValues(prev => Object.fromEntries(Object.keys(prev).map(k => [k, ''])))
      setTriggerInput('{}')
      fetchRuns()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }, [workflowName, triggerInput, inputFields, fieldValues, client, fetchRuns])

  const version = runs[0]?.workflowVersion ?? '1.0.0'

  return (
    <div className="h-screen flex flex-col bg-[var(--color-surface-0)]">
      {/* Header */}
      <div className="bg-[var(--color-surface-1)] border-b border-[var(--color-border)] px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-sm">&larr; Dashboard</Link>
            <div>
              <h1 className="text-base font-bold text-[var(--color-text-primary)]">
                {workflowName}
                <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">v{version}</span>
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {runs.length} run{runs.length !== 1 ? 's' : ''}
                {runs.filter(r => r.status === 'RUNNING').length > 0 && (
                  <span className="text-green-400 ml-2">{runs.filter(r => r.status === 'RUNNING').length} running</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/designer?workflow=${encodeURIComponent(workflowName ?? '')}`}
              className="text-xs bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] rounded-lg px-3 py-1.5 hover:bg-[var(--color-surface-4)] border border-[var(--color-border)] transition-colors"
            >
              Edit Definition
            </Link>
            <button
              onClick={() => setShowTrigger(!showTrigger)}
              className="text-xs bg-[var(--color-accent)] text-white rounded-lg px-3 py-1.5 hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              + Trigger Run
            </button>
          </div>
        </div>

        {/* Trigger Modal */}
        {showTrigger && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            {inputFields.length > 0 ? (
              <div className="flex gap-3 items-end">
                <div className="flex-1 flex gap-3 flex-wrap">
                  {inputFields.map(f => (
                    <div key={f.name} className="flex-1 min-w-[200px]">
                      <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                        {f.name}
                      </label>
                      <input
                        type="text"
                        value={fieldValues[f.name] ?? ''}
                        onChange={(e) => setFieldValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                        placeholder={`Enter ${f.name}...`}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleTrigger() }}
                      />
                    </div>
                  ))}
                </div>
                <button onClick={handleTrigger} className="text-xs bg-[var(--color-accent)] text-white rounded-lg px-4 py-2 hover:bg-[var(--color-accent-hover)] shrink-0">
                  Start
                </button>
              </div>
            ) : (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Input JSON</label>
                  <textarea
                    value={triggerInput}
                    onChange={(e) => setTriggerInput(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                    placeholder='{"key": "value"}'
                  />
                </div>
                <button onClick={handleTrigger} className="text-xs bg-[var(--color-accent)] text-white rounded-lg px-4 py-2 hover:bg-[var(--color-accent-hover)] shrink-0">
                  Start
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Run List */}
        <div
          className="w-[250px] shrink-0 flex flex-col overflow-y-auto"
          style={{ background: 'var(--color-surface-1)', borderRight: '1px solid var(--color-border)' }}
        >
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h3 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Recent Runs
            </h3>
          </div>

          {loading && <div className="p-4 text-xs text-[var(--color-text-muted)]">Loading...</div>}

          {!loading && runs.length === 0 && (
            <div className="p-4 text-xs text-[var(--color-text-muted)]">No runs yet. Click "Trigger Run" to start one.</div>
          )}

          <div className="flex flex-col">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => { setSelectedRunId(run.id); setSelectedStep(null) }}
                className={`text-left px-3 py-3 transition-colors ${
                  selectedRunId === run.id
                    ? 'bg-[var(--color-accent)]/10 border-l-2 border-l-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-surface-2)] border-l-2 border-l-transparent'
                }`}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge status={run.status} />
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    <RelativeTime date={run.startedAt ?? run.createdAt} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{run.id.slice(0, 10)}...</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {run.completedStepCount}/{run.stepCount}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: DAG + Step Detail */}
        {runDetail ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Run header bar */}
            <div className="px-4 py-2 flex items-center gap-3 shrink-0" style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
              <StatusBadge status={runDetail.status} />
              <DurationDisplay startedAt={runDetail.startedAt} completedAt={runDetail.completedAt} />
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{runDetail.id}</span>
              {runDetail.traceId && (
                <Link to={`/trace/${runDetail.traceId}`} className="text-[10px] text-[var(--color-accent)] font-mono">
                  trace: {runDetail.traceId.slice(0, 10)}...
                </Link>
              )}
            </div>

            {/* DAG + Step Detail */}
            <div className="flex-1 flex overflow-hidden">
              <div className={selectedStep ? 'flex-1' : 'w-full'}>
                <WorkflowDAG
                  steps={runDetail.steps}
                  dependencies={dependencies}
                  selectedStep={selectedStep ?? undefined}
                  onStepSelect={setSelectedStep}
                />
              </div>
              {selectedStep && selectedStepData && (
                <div className="w-[350px] shrink-0">
                  <StepDetailPanel
                    step={selectedStepData}
                    onClose={() => setSelectedStep(null)}
                    onSubmitHumanInput={handleSubmitHumanInput}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
            {loading ? 'Loading...' : 'Select a run from the left panel'}
          </div>
        )}
      </div>
    </div>
  )
}
