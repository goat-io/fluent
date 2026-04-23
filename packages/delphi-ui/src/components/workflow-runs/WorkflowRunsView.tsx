import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DurationDisplay } from '@/components/common/DurationDisplay'
import { RelativeTime } from '@/components/common/RelativeTime'
import type { AgentsClient } from '@/api/client'
import type { WorkflowRunSummary, WorkflowStatus } from '@/api/types'

export interface WorkflowRunsViewProps {
  client: AgentsClient
  workflowName: string
  workflowVersion?: string
  onBack: () => void
  onSelectRun: (runId: string) => void
}

const STATUS_CARDS: Array<{
  label: string
  status: WorkflowStatus
  color: string
}> = [
  { label: 'Running', status: 'RUNNING', color: 'text-blue-400' },
  { label: 'Completed', status: 'COMPLETED', color: 'text-green-400' },
  { label: 'Failed', status: 'FAILED', color: 'text-red-400' },
  { label: 'Waiting', status: 'WAITING_HUMAN', color: 'text-purple-400' },
  { label: 'Cancelled', status: 'CANCELLED', color: 'text-stone-400' },
]

const PAGE_SIZE = 25

function formatName(name: string): string {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function WorkflowRunsView({
  client,
  workflowName,
  workflowVersion,
  onBack,
  onSelectRun,
}: WorkflowRunsViewProps) {
  const [allRuns, setAllRuns] = useState<WorkflowRunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | null>(null)
  const [searchId, setSearchId] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showTrigger, setShowTrigger] = useState(false)
  const [triggerInput, setTriggerInput] = useState('{}')
  const [triggering, setTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [inputFields, setInputFields] = useState<Array<{ name: string; source: string }>>([])
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Fetch definition for input field declarations
  useEffect(() => {
    client.getDefinition(workflowName).then(def => {
      if (!mountedRef.current || !def.inputFields?.length) return
      setInputFields(def.inputFields)
      const template: Record<string, string> = {}
      for (const f of def.inputFields) {
        template[f.name] = ''
      }
      setTriggerInput(JSON.stringify(template, null, 2))
    }).catch(() => {
      // Fallback: infer from last run's input
      if (allRuns.length > 0) {
        client.getWorkflow(allRuns[0].id).then(detail => {
          if (!mountedRef.current || !detail.triggerInput) return
          const input = detail.triggerInput as Record<string, unknown>
          const fields = Object.keys(input).map(name => ({ name, source: 'triggerInput' }))
          if (fields.length > 0) {
            setInputFields(fields)
            const template: Record<string, string> = {}
            for (const key of Object.keys(input)) template[key] = ''
            setTriggerInput(JSON.stringify(template, null, 2))
          }
        }).catch(() => {})
      }
    })
  }, [client, workflowName, allRuns])

  const fetchRuns = useCallback(() => {
    client
      .listWorkflows({ limit: 500 })
      .then(data => {
        if (mountedRef.current) {
          setAllRuns(data.filter(r => r.workflowName === workflowName))
          setLoading(false)
        }
      })
      .catch(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [client, workflowName])

  useEffect(() => {
    mountedRef.current = true
    fetchRuns()
    const timer = setInterval(fetchRuns, 5000)
    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [fetchRuns])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [statusFilter, searchId])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const run of allRuns) {
      counts[run.status] = (counts[run.status] ?? 0) + 1
    }
    return counts
  }, [allRuns])

  const filteredRuns = useMemo(() => {
    let result = allRuns
    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter)
    }
    if (searchId.trim()) {
      const q = searchId.trim().toLowerCase()
      result = result.filter(r => r.id.toLowerCase().includes(q))
    }
    return result
  }, [allRuns, statusFilter, searchId])

  const visibleRuns = useMemo(
    () => filteredRuns.slice(0, visibleCount),
    [filteredRuns, visibleCount],
  )

  const hasMore = visibleCount < filteredRuns.length

  const handleCancelRun = useCallback(async (runId: string) => {
    setActionLoading(prev => ({ ...prev, [runId]: true }))
    try {
      await client.cancelWorkflow(runId)
      fetchRuns()
    } catch {
      // silently fail, next poll will show real state
    } finally {
      setActionLoading(prev => ({ ...prev, [runId]: false }))
    }
  }, [client, fetchRuns])

  const handleRetryRun = useCallback(async (runId: string) => {
    setActionLoading(prev => ({ ...prev, [runId]: true }))
    try {
      await client.retryWorkflow(runId)
      fetchRuns()
    } catch {
      // silently fail
    } finally {
      setActionLoading(prev => ({ ...prev, [runId]: false }))
    }
  }, [client, fetchRuns])

  const [confirmAction, setConfirmAction] = useState<'cancel-all' | 'retry-all' | null>(null)

  const executeBulkAction = useCallback(async (action: 'cancel-all' | 'retry-all') => {
    setBulkLoading(action)
    setConfirmAction(null)
    try {
      if (action === 'cancel-all') {
        await client.cancelAllWorkflows(workflowName, ['RUNNING'])
      } else {
        await client.retryAllWorkflows(workflowName, ['CANCELLED'])
      }
      fetchRuns()
    } catch {
      // silently fail
    } finally {
      setBulkLoading(null)
    }
  }, [client, workflowName, fetchRuns])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + PAGE_SIZE)
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
            <h2 className="text-lg font-semibold text-foreground">
              {formatName(workflowName)}
            </h2>
            {workflowVersion && (
              <p className="text-xs text-muted-foreground">v{workflowVersion}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(statusCounts['RUNNING'] ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setConfirmAction('cancel-all')}
              disabled={!!bulkLoading}
              className="border border-border text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {bulkLoading === 'cancel-all' ? 'Cancelling...' : `Cancel All Running (${statusCounts['RUNNING']})`}
            </button>
          )}
          {(statusCounts['CANCELLED'] ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setConfirmAction('retry-all')}
              disabled={!!bulkLoading}
              className="border border-border text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {bulkLoading === 'retry-all' ? 'Retrying...' : `Retry All Cancelled (${statusCounts['CANCELLED']})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowTrigger(!showTrigger)}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Trigger Run
          </button>
        </div>
      </div>

      {/* Inline confirmation banner */}
      {confirmAction && (
        <div className="mb-4 flex items-center justify-between bg-muted/50 border border-border rounded-xl px-5 py-3">
          <span className="text-sm text-foreground">
            {confirmAction === 'cancel-all'
              ? `Cancel all ${statusCounts['RUNNING'] ?? 0} running workflows?`
              : `Retry all ${statusCounts['CANCELLED'] ?? 0} cancelled workflows?`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => executeBulkAction(confirmAction)}
              className={`text-sm font-medium text-white px-3 py-1.5 rounded-lg transition-colors ${
                confirmAction === 'cancel-all'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}>
              {confirmAction === 'cancel-all' ? 'Yes, cancel all' : 'Yes, retry all'}
            </button>
          </div>
        </div>
      )}

      {/* Trigger Run Panel */}
      {showTrigger && (
        <TriggerRunPanel
          inputFields={inputFields}
          triggerInput={triggerInput}
          setTriggerInput={setTriggerInput}
          triggering={triggering}
          triggerError={triggerError}
          onTrigger={async () => {
            setTriggering(true)
            setTriggerError(null)
            try {
              const input = JSON.parse(triggerInput)
              const { runId } = await client.startWorkflow(workflowName, input)
              setShowTrigger(false)
              onSelectRun(runId)
            } catch (err: any) {
              setTriggerError(err.message)
            } finally {
              setTriggering(false)
            }
          }}
          onCancel={() => setShowTrigger(false)}
        />
      )}

      {/* Status count cards (clickable filter) */}
      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {STATUS_CARDS.map(card => (
          <div
            key={card.status}
            onClick={() =>
              setStatusFilter(prev =>
                prev === card.status ? null : card.status,
              )
            }
            className={`bg-card border rounded-xl p-4 cursor-pointer transition-colors ${
              statusFilter === card.status
                ? 'border-primary ring-1 ring-primary'
                : 'border-border hover:border-primary/30'
            }`}>
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${card.color}`}>
              {statusCounts[card.status] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Search + active filter */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          value={searchId}
          onChange={e => setSearchId(e.target.value)}
          placeholder="Search by run ID..."
          className="flex-1 bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
        {(statusFilter || searchId) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter(null)
              setSearchId('')
            }}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg border border-border hover:border-primary/30 transition-colors">
            Clear filters
          </button>
        )}
      </div>

      {/* Runs table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : visibleRuns.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {statusFilter || searchId ? 'No matching runs' : 'No runs found'}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div
            className="grid items-center px-6 py-3.5 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider"
            style={{
              gridTemplateColumns: '1fr 140px 120px 100px 120px 80px',
            }}>
            <span>Run ID</span>
            <span>Status</span>
            <span>Steps</span>
            <span>Duration</span>
            <span className="text-right">Started</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          {visibleRuns.map(run => (
            <div
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className="grid items-center px-6 py-4 border-b border-border last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
              style={{
                gridTemplateColumns: '1fr 140px 120px 100px 120px 80px',
              }}>
              <span className="flex items-center gap-1.5 min-w-0 pr-4">
                <span className="text-sm text-foreground font-mono truncate">
                  {run.id}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(run.id)
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  title="Copy run ID">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}>
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              </span>
              <span>
                <StatusBadge status={run.status} />
              </span>
              <span className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{
                      width: `${run.stepCount > 0 ? (run.completedStepCount / run.stepCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {run.completedStepCount}/{run.stepCount}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                <DurationDisplay
                  startedAt={run.startedAt}
                  completedAt={run.completedAt}
                />
              </span>
              <span className="text-xs text-muted-foreground text-right">
                <RelativeTime date={run.startedAt ?? run.createdAt} />
              </span>
              <span className="flex items-center justify-end gap-1">
                {(run.status === 'RUNNING' || run.status === 'FAILED') && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleCancelRun(run.id) }}
                    disabled={!!actionLoading[run.id]}
                    className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors disabled:opacity-50"
                    title="Cancel run">
                    {actionLoading[run.id] ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                )}
                {(run.status === 'CANCELLED' || run.status === 'FAILED') && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleRetryRun(run.id) }}
                    disabled={!!actionLoading[run.id]}
                    className="text-muted-foreground hover:text-blue-400 p-1 rounded transition-colors disabled:opacity-50"
                    title="Retry run">
                    {actionLoading[run.id] ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                )}
              </span>
            </div>
          ))}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="px-6 py-4 text-center">
              <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
      )}

      {/* Count */}
      {!loading && filteredRuns.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground text-center">
          {visibleRuns.length} of {filteredRuns.length} runs
        </div>
      )}
    </div>
  )
}

// ── Trigger Run Panel ──

function TriggerRunPanel({
  inputFields,
  triggerInput,
  setTriggerInput,
  triggering,
  triggerError,
  onTrigger,
  onCancel,
}: {
  inputFields: Array<{ name: string; source: string }>
  triggerInput: string
  setTriggerInput: (v: string) => void
  triggering: boolean
  triggerError: string | null
  onTrigger: () => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'form' | 'json'>('form')

  // Parse current JSON for form mode
  const formValues = useMemo(() => {
    try {
      return JSON.parse(triggerInput) as Record<string, string>
    } catch {
      return {} as Record<string, string>
    }
  }, [triggerInput])

  const updateField = useCallback(
    (name: string, value: string) => {
      const current = { ...formValues, [name]: value }
      setTriggerInput(JSON.stringify(current, null, 2))
    },
    [formValues, setTriggerInput],
  )

  // If no input fields detected, default to JSON mode
  const effectiveMode = inputFields.length === 0 ? 'json' : mode

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Trigger New Run</h3>
        <div className="flex items-center gap-2">
          {inputFields.length > 0 && (
            <div className="flex items-center bg-muted rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode('form')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  mode === 'form' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}>
                Form
              </button>
              <button
                type="button"
                onClick={() => setMode('json')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  mode === 'json' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}>
                JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {effectiveMode === 'form' ? (
        <div className="space-y-3 mb-4">
          {inputFields.map(field => (
            <div key={field.name}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {formatName(field.name)}
              </label>
              <input
                type="text"
                value={formValues[field.name] ?? ''}
                onChange={e => updateField(field.name, e.target.value)}
                placeholder={field.name}
                className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          ))}
        </div>
      ) : (
        <textarea
          value={triggerInput}
          onChange={e => setTriggerInput(e.target.value)}
          rows={6}
          spellCheck={false}
          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm font-mono mb-4 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-y"
          placeholder='{ "key": "value" }'
        />
      )}

      {triggerError && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-4">
          {triggerError}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTrigger}
          disabled={triggering}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {triggering ? 'Starting...' : 'Start Run'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground text-sm px-3 py-2 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
