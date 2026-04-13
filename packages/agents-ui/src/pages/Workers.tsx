import { useEffect, useState, useCallback } from 'react'
import { useAgents } from '@/providers/AgentsProvider'
import { RelativeTime } from '@/components/common/RelativeTime'
import { NavHeader } from '@/components/common/NavHeader'
import type { WorkerNodeInfo } from '@/api/types'

const REFRESH_INTERVAL = 10_000

function StatusBadge({ status }: { status: WorkerNodeInfo['status'] }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    draining: 'bg-yellow-100 text-yellow-800',
    offline: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.offline}`}>
      {status === 'active' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {status === 'draining' && <span className="inline-flex h-2 w-2 rounded-full bg-yellow-500" />}
      {status === 'offline' && <span className="inline-flex h-2 w-2 rounded-full bg-gray-400" />}
      {status}
    </span>
  )
}

function QueuePills({ queues }: { queues: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {queues.map((q) => (
        <span
          key={q}
          className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
        >
          {q}
        </span>
      ))}
    </div>
  )
}

function formatMemory(mb: number | undefined): string {
  if (mb == null) return '-'
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function formatCpu(count: number | undefined): string {
  if (count == null) return '-'
  return `${count} core${count !== 1 ? 's' : ''}`
}

function BoolCell({ value }: { value: boolean | undefined }) {
  if (value === true) {
    return <span className="text-green-600" title="Yes">&#10003;</span>
  }
  return <span className="text-gray-300">&mdash;</span>
}

export function Workers() {
  const { client } = useAgents()
  const [workers, setWorkers] = useState<WorkerNodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [tokenData, setTokenData] = useState<{ token: string; installCommand: string; startCommand: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const fetch = useCallback(() => {
    client
      .listWorkers()
      .then((data) => {
        setWorkers(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [client])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetch])

  const activeCount = workers.filter((w) => w.status === 'active').length
  const drainingCount = workers.filter((w) => w.status === 'draining').length
  const offlineCount = workers.filter((w) => w.status === 'offline').length

  return (
    <div className="min-h-screen bg-gray-50">
      <NavHeader
        title="Worker Nodes"
        actions={
          <button
            onClick={async () => {
              const data = await client.generateWorkerToken()
              setTokenData(data)
              setShowAddModal(true)
              setCopied(false)
            }}
            className="ml-2 bg-blue-600 text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Worker
          </button>
        }
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Active</span>
              <span className="text-2xl font-bold text-green-600 tabular-nums">{activeCount}</span>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Draining</span>
              <span className="text-2xl font-bold text-yellow-600 tabular-nums">{drainingCount}</span>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Offline</span>
              <span className="text-2xl font-bold text-gray-400 tabular-nums">{offlineCount}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load workers: {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-gray-400">Loading workers...</div>
        )}

        {/* Empty state */}
        {!loading && !error && workers.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500">No workers registered. Run the install script to add workers.</p>
          </div>
        )}

        {/* Table */}
        {!loading && workers.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hostname</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Queues</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memory</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Docker</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GPU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Heartbeat</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {workers.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{w.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{w.hostname ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={w.status} />
                      </td>
                      <td className="px-4 py-3">
                        {w.capabilities?.queues?.length ? (
                          <QueuePills queues={w.capabilities.queues} />
                        ) : (
                          <span className="text-sm text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap tabular-nums">
                        {formatCpu(w.capabilities?.cpuCount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap tabular-nums">
                        {formatMemory(w.capabilities?.memoryMB)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BoolCell value={w.capabilities?.dockerAvailable} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BoolCell value={w.capabilities?.gpuAvailable} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {w.lastHeartbeatAt ? (
                          <RelativeTime date={w.lastHeartbeatAt} />
                        ) : (
                          <span className="text-sm text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RelativeTime date={w.registeredAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Worker Modal */}
      {showAddModal && tokenData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Worker Node</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Run this command on any machine to connect a worker to your engine.
              The worker will auto-detect CPU, memory, Docker, and GPU capabilities.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Run this command</label>
              <div className="relative">
                <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {tokenData.startCommand}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tokenData.startCommand)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-1 text-xs"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Worker Token</label>
              <code className="block bg-gray-100 rounded-lg p-3 text-xs text-gray-700 font-mono break-all">{tokenData.token}</code>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Requirements:</strong> Node.js 18+ installed on the target machine.
              The worker will connect to <code className="bg-blue-100 px-1 rounded">{tokenData.startCommand.match(/AGENTS_ENGINE_URL=(\S+)/)?.[1]}</code> and start processing jobs automatically.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
