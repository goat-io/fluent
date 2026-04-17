import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RelativeTime } from '@/components/common/RelativeTime'
import type { AgentsClient } from '@/api/client'
import type { WorkflowRunSummary } from '@/api/types'

interface WorkflowGroup {
  name: string
  version: string
  runs: WorkflowRunSummary[]
  lastRun: string
  statusCounts: Record<string, number>
}

export interface WorkflowOverviewProps {
  client: AgentsClient
  onSelectWorkflow: (workflowName: string) => void
}

/** Convert snake_case/kebab-case to Title Case */
function formatName(name: string): string {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const STATUS_DOT_COLORS: Record<string, string> = {
  RUNNING: 'bg-blue-400',
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
  WAITING_HUMAN: 'bg-purple-500',
  PENDING: 'bg-gray-400',
  CANCELLED: 'bg-stone-400',
}

function groupRuns(
  runs: WorkflowRunSummary[],
  definitions: Array<{ name: string; version: string }>,
): { active: WorkflowGroup[]; inactive: WorkflowGroup[] } {
  const byName = new Map<string, WorkflowRunSummary[]>()

  for (const run of runs) {
    const existing = byName.get(run.workflowName)
    if (existing) {
      existing.push(run)
    } else {
      byName.set(run.workflowName, [run])
    }
  }

  // Build groups from runs
  const groups = new Map<string, WorkflowGroup>()
  for (const [name, wfRuns] of byName) {
    const statusCounts: Record<string, number> = {}
    let latestDate = ''
    let version = ''
    for (const r of wfRuns) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
      const d = r.startedAt ?? r.createdAt
      if (!latestDate || d > latestDate) {
        latestDate = d
        version = r.workflowVersion
      }
    }
    groups.set(name, { name, version, runs: wfRuns, lastRun: latestDate, statusCounts })
  }

  // Merge definitions that have no runs
  for (const def of definitions) {
    if (!groups.has(def.name)) {
      groups.set(def.name, {
        name: def.name,
        version: def.version,
        runs: [],
        lastRun: '',
        statusCounts: {},
      })
    }
  }

  const active: WorkflowGroup[] = []
  const inactive: WorkflowGroup[] = []

  for (const group of groups.values()) {
    if (group.runs.length > 0) {
      active.push(group)
    } else {
      inactive.push(group)
    }
  }

  // Sort active by most recent run first
  active.sort((a, b) => (b.lastRun > a.lastRun ? 1 : -1))
  // Sort inactive alphabetically
  inactive.sort((a, b) => a.name.localeCompare(b.name))

  return { active, inactive }
}

export function WorkflowOverview({ client, onSelectWorkflow }: WorkflowOverviewProps) {
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([])
  const [definitions, setDefinitions] = useState<Array<{ name: string; version: string }>>([])
  const [search, setSearch] = useState('')
  const [inactiveOpen, setInactiveOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  // Fetch definitions once
  useEffect(() => {
    let cancelled = false
    client.listDefinitions().then(defs => {
      if (!cancelled) setDefinitions(defs)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [client])

  // Poll runs every 5s
  useEffect(() => {
    mountedRef.current = true
    let timer: ReturnType<typeof setTimeout>

    const fetchRuns = () => {
      client.listWorkflows({ limit: 200 }).then(data => {
        if (mountedRef.current) {
          setRuns(data)
          setLoading(false)
        }
      }).catch(() => {
        if (mountedRef.current) setLoading(false)
      })
    }

    fetchRuns()
    timer = setInterval(fetchRuns, 5000)

    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [client])

  const { active, inactive } = useMemo(() => groupRuns(runs, definitions), [runs, definitions])

  const filteredActive = useMemo(() => {
    if (!search) return active
    const q = search.toLowerCase()
    return active.filter(g => g.name.toLowerCase().includes(q))
  }, [active, search])

  const filteredInactive = useMemo(() => {
    if (!search) return inactive
    const q = search.toLowerCase()
    return inactive.filter(g => g.name.toLowerCase().includes(q))
  }, [inactive, search])

  const handleCardClick = useCallback(
    (name: string) => onSelectWorkflow(name),
    [onSelectWorkflow],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Search */}
      <input
        type="text"
        placeholder="Search workflows..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-muted border border-border text-foreground rounded-xl px-4 py-2.5 text-sm mb-6 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
      />

      {/* Active Workflows */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Active Workflows {filteredActive.length}
        </h3>
        {filteredActive.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground text-sm"
            style={{ gridColumn: 'span 3' }}
          >
            No active workflows found
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {filteredActive.map(group => (
              <WorkflowCard key={group.name} group={group} onClick={handleCardClick} />
            ))}
          </div>
        )}
      </div>

      {/* Inactive Workflows */}
      {filteredInactive.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setInactiveOpen(prev => !prev)}
            className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2 hover:text-foreground transition-colors"
          >
            <span
              className="inline-block transition-transform"
              style={{ transform: inactiveOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              {'\u25B6'}
            </span>
            Inactive Workflows {filteredInactive.length}
          </button>
          {inactiveOpen && (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {filteredInactive.map(group => (
                <WorkflowCard key={group.name} group={group} onClick={handleCardClick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WorkflowCard({
  group,
  onClick,
}: {
  group: WorkflowGroup
  onClick: (name: string) => void
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => onClick(group.name)}
    >
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground min-w-0 break-words">
            {formatName(group.name)}
          </h4>
          {group.lastRun && (
            <span className="text-xs text-muted-foreground shrink-0">
              <RelativeTime date={group.lastRun} />
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">v{group.version}</p>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-muted-foreground">
          {group.runs.length > 0
            ? `${group.runs.length} run${group.runs.length !== 1 ? 's' : ''}`
            : 'No runs yet'}
        </span>
      </div>

      {/* Status dots */}
      {Object.keys(group.statusCounts).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(group.statusCounts).map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[status] ?? 'bg-gray-400'}`} />
              {count}
            </span>
          ))}
        </div>
      )}

    </div>
  )
}
