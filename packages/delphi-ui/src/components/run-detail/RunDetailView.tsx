import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DurationDisplay } from '@/components/common/DurationDisplay'
import { RelativeTime } from '@/components/common/RelativeTime'
import { JsonViewer } from '@/components/common/JsonViewer'
import { WorkflowDAG } from '@/components/workflow-dag/WorkflowDAG'
import { RunTimeline } from './RunTimeline'
import { StepDetailPanel } from '@/components/step-detail/StepDetailPanel'
import type { AgentsClient } from '@/api/client'
import type { WorkflowRunDetail, WorkflowStatus } from '@/api/types'

export interface RunDetailViewProps {
  client: AgentsClient
  runId: string
  onBack: () => void
  onNavigateToRun?: (runId: string) => void
}

const TERMINAL_STATUSES: WorkflowStatus[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]

function formatName(name: string): string {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

type Tab = 'overview' | 'input' | 'output'

export function RunDetailView({ client, runId, onBack, onNavigateToRun }: RunDetailViewProps) {
  const [run, setRun] = useState<WorkflowRunDetail | null>(null)
  const [selectedStep, setSelectedStep] = useState<string | undefined>()
  const [autoSelectedOnce, setAutoSelectedOnce] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [confirmRerun, setConfirmRerun] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let es: EventSource | null = null

    // Initial fetch
    client
      .getWorkflow(runId)
      .then(data => {
        if (mountedRef.current) {
          setRun(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false)
      })

    // Connect SSE for real-time updates
    try {
      es = client.subscribe(runId)

      es.onmessage = event => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'workflowUpdate' && data.workflow) {
            setRun(prev => {
              if (!prev) return prev
              const u = data.workflow
              return {
                ...prev,
                status: u.status ?? prev.status,
                output: u.output ?? prev.output,
                completedAt: u.completedAt ?? prev.completedAt,
                steps: prev.steps.map(step => {
                  const us = u.steps?.find(
                    (s: any) => s.stepName === step.stepName,
                  )
                  if (!us) return step
                  return {
                    ...step,
                    status: us.status ?? step.status,
                    attempt: us.attempt ?? step.attempt,
                    output: us.output ?? step.output,
                    error: us.error ?? step.error,
                    startedAt: us.startedAt ?? step.startedAt,
                    completedAt: us.completedAt ?? step.completedAt,
                    humanPrompt: us.humanPrompt ?? step.humanPrompt,
                  }
                }),
              }
            })
          }
        } catch {
          // Ignore parse errors
        }
      }

      es.onerror = () => {
        // SSE failed — fall back to polling
        es?.close()
        es = null
        if (!pollTimer) {
          pollTimer = setInterval(() => {
            client.getWorkflow(runId).then(data => {
              if (mountedRef.current) setRun(data)
            }).catch(() => {})
          }, 3000)
        }
      }
    } catch {
      // SSE not supported — poll
      pollTimer = setInterval(() => {
        client.getWorkflow(runId).then(data => {
          if (mountedRef.current) setRun(data)
        }).catch(() => {})
      }, 3000)
    }

    return () => {
      mountedRef.current = false
      es?.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [client, runId])

  const dependencies = useMemo(() => {
    if (!run) return {}
    const deps: Record<string, string[]> = {}
    for (const step of run.steps) {
      if (step.dependsOn && step.dependsOn.length > 0) {
        deps[step.stepName] = step.dependsOn
      }
    }
    return deps
  }, [run])

  const selectedStepDetail = useMemo(() => {
    if (!run || !selectedStep) return null
    return run.steps.find(s => s.stepName === selectedStep) ?? null
  }, [run, selectedStep])

  // Auto-select the first step when there's only one (or few)
  useEffect(() => {
    if (run && !autoSelectedOnce && !selectedStep && run.steps.length > 0) {
      setSelectedStep(run.steps[0].stepName)
      setAutoSelectedOnce(true)
    }
  }, [run, autoSelectedOnce, selectedStep])

  const isTerminal = run
    ? TERMINAL_STATUSES.includes(run.status)
    : false

  const handleCancel = useCallback(async () => {
    if (!run || cancelling) return
    setCancelling(true)
    try {
      await client.cancelWorkflow(run.id)
    } finally {
      setCancelling(false)
    }
  }, [client, run, cancelling])

  const handleRerun = useCallback(async () => {
    if (!run || rerunning) return
    setRerunning(true)
    try {
      const input = run.triggerInput ?? {}
      const { runId: newRunId } = await client.startWorkflow(
        run.workflowName,
        input as Record<string, unknown>,
      )
      setConfirmRerun(false)
      if (onNavigateToRun) {
        onNavigateToRun(newRunId)
      } else {
        onBack()
      }
    } finally {
      setRerunning(false)
    }
  }, [client, run, rerunning, onBack, onNavigateToRun])

  const toggleStep = useCallback(
    (stepName: string) => {
      setSelectedStep(prev => (prev === stepName ? undefined : stepName))
    },
    [],
  )

  const handleSubmitHumanInput = useCallback(
    (stepName: string, data: Record<string, unknown>) => {
      client.submitHumanInput(runId, stepName, data).catch(() => {})
    },
    [client, runId],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Run not found</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 text-sm text-primary hover:underline">
          Go back
        </button>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'input', label: 'Input' },
    { key: 'output', label: 'Output' },
  ]

  return (
    <div className="p-6">
      {/* ── Header ── */}
      <div className="mb-6">
        {/* Row 1: Back + Name + Actions */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
              aria-label="Go back">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {formatName(run.workflowName)}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono">
                  {run.id}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(run.id)}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  title="Copy run ID">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isTerminal && !confirmRerun && (
              <button
                type="button"
                onClick={() => setConfirmRerun(true)}
                disabled={rerunning}
                className="bg-muted text-foreground rounded-lg hover:bg-primary/10 border border-border hover:border-primary/30 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-run
              </button>
            )}
            {isTerminal && confirmRerun && (
              <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Start new run with same input?</span>
                <button
                  type="button"
                  onClick={handleRerun}
                  disabled={rerunning}
                  className="bg-primary text-primary-foreground rounded-md px-3 py-1 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {rerunning ? 'Starting...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRerun(false)}
                  className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 transition-colors">
                  Cancel
                </button>
              </div>
            )}
            {!isTerminal && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 border border-destructive/20 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Status info cards */}
        <div className="flex items-stretch gap-4 flex-wrap">
          <InfoCard label="Status">
            <StatusBadge status={run.status} />
          </InfoCard>
          <div className="w-px bg-border hidden sm:block" />
          <InfoCard label="Started">
            <span className="text-sm font-medium text-foreground">
              {run.startedAt ? (
                <RelativeTime date={run.startedAt} />
              ) : (
                '—'
              )}
            </span>
          </InfoCard>
          <div className="w-px bg-border hidden sm:block" />
          <InfoCard
            label={
              run.status === 'COMPLETED'
                ? 'Succeeded'
                : run.status === 'FAILED'
                  ? 'Failed'
                  : 'Ended'
            }>
            <span className="text-sm font-medium text-foreground">
              {run.completedAt ? (
                <RelativeTime date={run.completedAt} />
              ) : (
                '—'
              )}
            </span>
          </InfoCard>
          <div className="w-px bg-border hidden sm:block" />
          <InfoCard label="Duration">
            <span className="text-sm font-medium text-foreground">
              <DurationDisplay
                startedAt={run.startedAt}
                completedAt={run.completedAt}
              />
            </span>
          </InfoCard>
          <div className="w-px bg-border hidden sm:block" />
          <InfoCard label="Version">
            <span className="text-sm font-medium text-foreground">
              v{run.workflowVersion}
            </span>
          </InfoCard>
          <div className="w-px bg-border hidden sm:block" />
          <InfoCard label="Steps">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {run.steps.filter(s => s.status === 'COMPLETED').length}/
              {run.steps.length}
            </span>
          </InfoCard>
          {run.traceId && (
            <>
              <div className="w-px bg-border hidden sm:block" />
              <InfoCard label="Trace">
                <span className="flex items-center gap-1">
                  <span className="text-xs font-medium text-foreground font-mono truncate max-w-[200px]">
                    {run.traceId}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(run.traceId!)}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors shrink-0"
                    title="Copy trace ID">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </span>
              </InfoCard>
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {run.error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl text-destructive px-4 py-3 text-sm mb-6 font-mono">
          {run.error}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'overview' && (
        <div>
          {/* Timeline breakdown */}
          <RunTimeline
            run={run}
            onStepSelect={toggleStep}
            selectedStep={selectedStep}
          />

          {/* DAG */}
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6" style={{ height: `${Math.min(Math.max(run.steps.length * 120 + 80, 200), 500)}px` }}>
            <WorkflowDAG
              steps={run.steps}
              dependencies={dependencies}
              selectedStep={selectedStep}
              onStepSelect={toggleStep}
            />
          </div>
        </div>
      )}

      {activeTab === 'input' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Trigger Input
          </h3>
          <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground border border-border max-h-96">
            {run.triggerInput
              ? JSON.stringify(run.triggerInput, null, 2)
              : 'No input data'}
          </pre>
        </div>
      )}

      {activeTab === 'output' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Output
          </h3>
          <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground border border-border max-h-96">
            {run.output
              ? JSON.stringify(run.output, null, 2)
              : run.error || 'No output data'}
          </pre>
        </div>
      )}

      {/* Step detail — persists across all tabs */}
      {selectedStepDetail && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mt-6">
          <StepDetailPanel
            step={selectedStepDetail}
            onClose={() => setSelectedStep(undefined)}
            onSubmitHumanInput={handleSubmitHumanInput}
          />
        </div>
      )}
    </div>
  )
}

function InfoCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  )
}
