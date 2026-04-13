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
    <div className="min-h-screen bg-gray-50">
      <NavHeader title="Schedules" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Cron Schedules</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            + Create Schedule
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowCreate(false)}>
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-gray-800 mb-4">Create Schedule</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Workflow Name</label>
                  <input
                    type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="my-workflow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cron Expression</label>
                  <input
                    type="text" value={newCron} onChange={(e) => setNewCron(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="*/5 * * * *"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Standard 5-field cron: min hour dom month dow</p>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowCreate(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                  <button onClick={handleCreate} className="bg-blue-600 text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-blue-700">Create</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No schedules configured</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Workflow</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cron</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Next Run</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Last Run</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.workflowName}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{s.cronExpression}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <RelativeTime date={s.nextRunAt} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.lastRunAt ? <RelativeTime date={s.lastRunAt} /> : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
