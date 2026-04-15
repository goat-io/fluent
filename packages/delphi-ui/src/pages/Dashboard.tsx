import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgents } from '@/providers/AgentsProvider'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RelativeTime } from '@/components/common/RelativeTime'
import { NavHeader } from '@/components/common/NavHeader'
import type { WorkflowRunSummary, WorkflowStatus, WorkflowFilters, WorkerNodeInfo } from '@/api/types'

const ALL_STATUSES: WorkflowStatus[] = ['RUNNING', 'COMPLETED', 'FAILED', 'WAITING_HUMAN', 'CANCELLED']

interface WorkflowGroup {
  name: string
  version: string
  runs: WorkflowRunSummary[]
  lastRun: string
  statusCounts: Record<string, number>
}

export function Dashboard() {
  const { client } = useAgents()
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowRunSummary[]>([])
  const [workers, setWorkers] = useState<WorkerNodeInfo[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<WorkflowStatus[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [limit, setLimit] = useState(100)

  const fetchWorkflows = useCallback(() => {
    const filters: WorkflowFilters = { limit }
    if (statusFilter.length > 0) filters.status = statusFilter
    if (nameFilter.trim()) filters.workflowName = nameFilter.trim()
    client.listWorkflows(filters).then(setWorkflows).catch(() => {})
  }, [client, statusFilter, nameFilter, limit])

  const [definitions, setDefinitions] = useState<Array<{ name: string; version: string; stepCount: number }>>([])

  useEffect(() => {
    fetchWorkflows()
    client.listWorkers().then(setWorkers).catch(() => {})
    client.listDefinitions().then(setDefinitions).catch(() => {})
    setLoading(false)
    const interval = setInterval(() => {
      fetchWorkflows()
      client.listWorkers().then(setWorkers).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchWorkflows, client])

  const toggleStatus = (status: WorkflowStatus) => {
    setStatusFilter(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status],
    )
  }

  // Group runs by workflow name — include all definitions even without runs
  const grouped = useMemo((): WorkflowGroup[] => {
    const map = new Map<string, WorkflowGroup>()

    // Start with all registered definitions
    for (const def of definitions) {
      map.set(def.name, {
        name: def.name,
        version: def.version,
        runs: [],
        lastRun: '',
        statusCounts: {},
      })
    }

    // Add runs to their groups
    for (const run of workflows) {
      if (!map.has(run.workflowName)) {
        map.set(run.workflowName, {
          name: run.workflowName,
          version: run.workflowVersion,
          runs: [],
          lastRun: '',
          statusCounts: {},
        })
      }
      const group = map.get(run.workflowName)!
      group.runs.push(run)
      group.statusCounts[run.status] = (group.statusCounts[run.status] ?? 0) + 1
      const runTime = run.startedAt ?? run.createdAt
      if (!group.lastRun || runTime > group.lastRun) group.lastRun = runTime
    }

    // Sort: most recently run first, then workflows with no runs at the bottom
    return Array.from(map.values()).sort((a, b) => {
      if (!a.lastRun && !b.lastRun) return a.name.localeCompare(b.name)
      if (!a.lastRun) return 1
      if (!b.lastRun) return -1
      return b.lastRun.localeCompare(a.lastRun)
    })
  }, [workflows, definitions])

  const totalCounts = {
    RUNNING: workflows.filter(w => w.status === 'RUNNING').length,
    COMPLETED: workflows.filter(w => w.status === 'COMPLETED').length,
    FAILED: workflows.filter(w => w.status === 'FAILED').length,
    WAITING_HUMAN: workflows.filter(w => w.status === 'WAITING_HUMAN').length,
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)]">
      <NavHeader
        title="Goat Agents"
        actions={
          <a href="/designer" className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            + Create Workflow
          </a>
        }
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Bento Stats Grid */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {(Object.entries(totalCounts) as [WorkflowStatus, number][]).map(([status, count]) => (
            <div key={status} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{count}</span>
              </div>
            </div>
          ))}
          <a href="/workers" className="glass glass-hover rounded-2xl p-5 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Workers</span>
              <span className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{workers.length}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>{workers.reduce((s, w) => s + (w.capabilities?.cpuCount ?? 0), 0)} cores</span>
              <span className="text-[var(--color-text-muted)]">|</span>
              <span>{workers.length > 0 ? `${Math.round(workers.reduce((s, w) => s + (w.capabilities?.memoryMB ?? 0), 0) / 1024)}GB` : '0GB'}</span>
            </div>
          </a>
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
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Search:</span>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Workflow name..."
                className="bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>
            {(statusFilter.length > 0 || nameFilter) && (
              <button onClick={() => { setStatusFilter([]); setNameFilter('') }} className="text-xs text-red-400 hover:text-red-300">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Workflow Cards */}
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Workflows</h2>
        {loading ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">Loading...</div>
        ) : grouped.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <p className="text-[var(--color-text-secondary)] mb-4">No workflows found</p>
            <a href="/designer" className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] text-sm font-medium">
              Create your first workflow
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.map((wf) => (
              <div
                key={wf.name}
                onClick={() => navigate(`/workflows/def/${encodeURIComponent(wf.name)}`)}
                className="glass glass-hover rounded-2xl p-5 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{wf.name}</h3>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">v{wf.version}</p>
                  </div>
                  {wf.lastRun ? (
                    <span className="text-xs text-[var(--color-text-muted)]"><RelativeTime date={wf.lastRun} /></span>
                  ) : (
                    <span className="text-[10px] text-[var(--color-text-muted)]">No runs</span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {wf.runs.length > 0 ? `${wf.runs.length} run${wf.runs.length !== 1 ? 's' : ''}` : 'Ready to run'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {wf.statusCounts.RUNNING > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      {wf.statusCounts.RUNNING} running
                    </span>
                  )}
                  {wf.statusCounts.COMPLETED > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {wf.statusCounts.COMPLETED} completed
                    </span>
                  )}
                  {wf.statusCounts.FAILED > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {wf.statusCounts.FAILED} failed
                    </span>
                  )}
                  {wf.statusCounts.WAITING_HUMAN > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-purple-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      {wf.statusCounts.WAITING_HUMAN} waiting
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
