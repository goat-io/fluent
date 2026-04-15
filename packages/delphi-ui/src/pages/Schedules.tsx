import { useEffect, useState, useCallback } from 'react'
import { useAgents } from '@/providers/AgentsProvider'
import { NavHeader } from '@/components/common/NavHeader'
import { RelativeTime } from '@/components/common/RelativeTime'
import type { WorkflowSchedule } from '@/api/types'

export function Schedules() {
  const { client } = useAgents()
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCron, setNewCron] = useState('')

  const fetchSchedules = useCallback(() => {
    client.listSchedules().then(setSchedules).catch(() => {}).finally(() => setLoading(false))
  }, [client])

  useEffect(() => {
    fetchSchedules()
    const interval = setInterval(fetchSchedules, 10_000)
    return () => clearInterval(interval)
  }, [fetchSchedules])

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newCron.trim()) return
    try {
      await client.createSchedule(newName.trim(), newCron.trim())
      setShowCreate(false)
      setNewName('')
      setNewCron('')
      fetchSchedules()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }, [client, newName, newCron, fetchSchedules])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    await client.deleteSchedule(id)
    fetchSchedules()
  }, [client, fetchSchedules])

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)]">
      <NavHeader
        title="Schedules"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Create Schedule
          </button>
        }
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Total Schedules</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{schedules.length}</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Active</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{schedules.length}</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Workflows</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{new Set(schedules.map(s => s.workflowName)).size}</div>
          </div>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
            <div className="glass rounded-2xl w-[420px] p-8 border-[var(--color-border-hover)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Create Schedule</h3>
                <button onClick={() => setShowCreate(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-xl">&times;</button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Workflow Name</label>
                  <input
                    type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
                    placeholder="my-workflow"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Cron Expression</label>
                  <input
                    type="text" value={newCron} onChange={(e) => setNewCron(e.target.value)}
                    className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
                    placeholder="*/5 * * * *"
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Standard 5-field cron: min hour dom month dow</p>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowCreate(false)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] px-3 py-1.5 transition-colors">Cancel</button>
                  <button onClick={handleCreate} className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors">Create</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Cards */}
        {loading ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <p className="text-[var(--color-text-secondary)] mb-4">No schedules configured</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
            >
              Create your first schedule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="glass glass-hover rounded-2xl p-5 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{s.workflowName}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 text-[10px] font-medium">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                        </span>
                        active
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{s.cronExpression}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>

                <div className="flex items-center gap-6 text-xs text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--color-text-muted)]">Next run:</span>
                    <RelativeTime date={s.nextRunAt} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--color-text-muted)]">Last run:</span>
                    {s.lastRunAt ? <RelativeTime date={s.lastRunAt} /> : <span className="text-[var(--color-text-muted)]">Never</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
