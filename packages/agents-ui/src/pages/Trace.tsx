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
      <div className="min-h-screen bg-gray-50">
        <NavHeader title="Trace" />
        <div className="flex items-center justify-center py-24 text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!trace) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavHeader title="Trace" />
        <div className="flex items-center justify-center py-24 text-gray-400">Trace not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavHeader title="Trace Lineage" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Trace <span className="font-mono text-gray-500">{traceId}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {trace.runs.length} workflow run{trace.runs.length !== 1 ? 's' : ''} | {trace.events.length} event{trace.events.length !== 1 ? 's' : ''} | {trace.actions.length} action{trace.actions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Workflow Runs */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Workflow Runs</h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Run ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Workflow</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trace.runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/workflows/${run.id}`} className="text-blue-600 hover:text-blue-800 font-mono text-xs">
                        {run.id.slice(0, 12)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {run.workflowName} <span className="text-xs text-gray-400">v{run.workflowVersion}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={run.status as WorkflowStatus} /></td>
                    <td className="px-4 py-3 text-gray-600">
                      {run.startedAt ? <RelativeTime date={run.startedAt} /> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Events */}
        {trace.events.length > 0 && (
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Events</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trace.events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{event.eventType}</td>
                      <td className="px-4 py-3 text-gray-600">{event.source}</td>
                      <td className="px-4 py-3 text-gray-600"><RelativeTime date={event.createdAt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* External Actions */}
        {trace.actions.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">External Actions</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Provider</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trace.actions.map((action) => (
                    <tr key={action.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{action.provider}</td>
                      <td className="px-4 py-3 text-gray-600">{action.actionType}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          action.status === 'completed' ? 'bg-green-100 text-green-700' :
                          action.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {action.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600"><RelativeTime date={action.createdAt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
