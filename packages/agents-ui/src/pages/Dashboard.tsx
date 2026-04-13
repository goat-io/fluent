import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgents } from '@/providers/AgentsProvider'
import { WorkflowList } from '@/components/workflow-list/WorkflowList'
import { StatusBadge } from '@/components/common/StatusBadge'
import { MetricsPanel } from '@/components/metrics/MetricsPanel'
import { NavHeader } from '@/components/common/NavHeader'
import type { WorkflowRunSummary, WorkflowStatus, WorkflowFilters } from '@/api/types'

const ALL_STATUSES: WorkflowStatus[] = ['RUNNING', 'COMPLETED', 'FAILED', 'WAITING_HUMAN', 'CANCELLED']

export function Dashboard() {
  const { client } = useAgents()
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowRunSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [limit, setLimit] = useState(50)

  const fetchWorkflows = useCallback(() => {
    const filters: WorkflowFilters = { limit }
    if (statusFilter.length > 0) filters.status = statusFilter
    if (nameFilter.trim()) filters.workflowName = nameFilter.trim()
    client.listWorkflows(filters).then(setWorkflows).catch(() => {})
  }, [client, statusFilter, nameFilter, limit])

  useEffect(() => {
    fetchWorkflows()
    setLoading(false)
    const interval = setInterval(fetchWorkflows, 5000)
    return () => clearInterval(interval)
  }, [fetchWorkflows])

  const toggleStatus = (status: WorkflowStatus) => {
    setStatusFilter(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status],
    )
  }

  const counts = {
    RUNNING: workflows.filter(w => w.status === 'RUNNING').length,
    COMPLETED: workflows.filter(w => w.status === 'COMPLETED').length,
    FAILED: workflows.filter(w => w.status === 'FAILED').length,
    WAITING_HUMAN: workflows.filter(w => w.status === 'WAITING_HUMAN').length,
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)]">
      <NavHeader
        title="Goat Agents Dashboard"
        actions={
          <a href="/designer" className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            + Create Workflow
          </a>
        }
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Bento Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(Object.entries(counts) as [WorkflowStatus, number][]).map(([status, count]) => (
            <div key={status} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="glass rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Status:</span>
              {ALL_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    statusFilter.includes(status)
                      ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-accent-hover)]'
                      : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)]'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-[var(--color-border)]" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Name:</span>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Filter by workflow name..."
                className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>

            <div className="h-5 w-px bg-[var(--color-border)]" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Limit:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            {(statusFilter.length > 0 || nameFilter) && (
              <button
                onClick={() => { setStatusFilter([]); setNameFilter('') }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Workflow List */}
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Recent Runs</h2>
        {loading ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">Loading...</div>
        ) : (
          <WorkflowList
            workflows={workflows}
            onSelect={(runId) => navigate(`/workflows/${runId}`)}
          />
        )}
      </main>
    </div>
  )
}
