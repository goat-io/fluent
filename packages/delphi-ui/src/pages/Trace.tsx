import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAgents } from '@/providers/AgentsProvider'
import { NavHeader } from '@/components/common/NavHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RelativeTime } from '@/components/common/RelativeTime'
import type { TraceLineage, WorkflowStatus } from '@/api/types'

export function Trace() {
  const { traceId } = useParams<{ traceId: string }>()
  const { client } = useAgents()
  const [trace, setTrace] = useState<TraceLineage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!traceId) return
    client.getTrace(traceId).then(setTrace).catch(() => {}).finally(() => setLoading(false))
  }, [client, traceId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-0)]">
        <NavHeader title="Trace" />
        <div className="flex items-center justify-center py-24 text-[var(--color-text-muted)]">Loading...</div>
      </div>
    )
  }

  if (!trace) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-0)]">
        <NavHeader title="Trace" />
        <div className="flex items-center justify-center py-24 text-[var(--color-text-muted)]">Trace not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)]">
      <NavHeader title="Trace Lineage" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Trace <span className="font-mono text-[var(--color-text-muted)]">{traceId}</span>
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {trace.runs.length} workflow run{trace.runs.length !== 1 ? 's' : ''} | {trace.events.length} event{trace.events.length !== 1 ? 's' : ''} | {trace.actions.length} action{trace.actions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Workflow Runs</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{trace.runs.length}</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Events</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{trace.events.length}</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">External Actions</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{trace.actions.length}</div>
          </div>
        </div>

        {/* Workflow Runs */}
        <section className="mb-8">
          <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Workflow Runs</h3>
          <div className="space-y-3">
            {trace.runs.map((run) => (
              <Link
                key={run.id}
                to={`/workflows/${run.id}`}
                className="block glass glass-hover rounded-2xl p-5 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{run.workflowName}</h4>
                      <span className="text-xs text-[var(--color-text-muted)]">v{run.workflowVersion}</span>
                      <StatusBadge status={run.status as WorkflowStatus} />
                    </div>
                    <p className="text-xs text-[var(--color-accent)] font-mono mt-0.5">{run.id.slice(0, 12)}...</p>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {run.startedAt ? <RelativeTime date={run.startedAt} /> : '-'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Events */}
        {trace.events.length > 0 && (
          <section className="mb-8">
            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Events</h3>
            <div className="space-y-3">
              {trace.events.map((event) => (
                <div key={event.id} className="glass glass-hover rounded-2xl p-5 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{event.eventType}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{event.source}</p>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      <RelativeTime date={event.createdAt} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* External Actions */}
        {trace.actions.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">External Actions</h3>
            <div className="space-y-3">
              {trace.actions.map((action) => (
                <div key={action.id} className="glass glass-hover rounded-2xl p-5 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{action.provider}</h4>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          action.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          action.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-gray-500/10 text-[var(--color-text-muted)] border-[var(--color-border)]'
                        }`}>
                          {action.status}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{action.actionType}</p>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      <RelativeTime date={action.createdAt} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
