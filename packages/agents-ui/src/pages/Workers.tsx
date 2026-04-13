import { useEffect, useState } from 'react'
import { useAgents } from '@/providers/AgentsProvider'
import { RelativeTime } from '@/components/common/RelativeTime'
import { NavHeader } from '@/components/common/NavHeader'
import type { WorkerNodeInfo } from '@/api/types'

const QUEUE_META: Record<string, { label: string; color: string; dot: string }> = {
  workflow_step_light: { label: 'Functions', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', dot: 'bg-cyan-400' },
  workflow_step_heavy: { label: 'Compute', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', dot: 'bg-orange-400' },
  workflow_step_ai: { label: 'AI', color: 'text-violet-400 bg-violet-400/10 border-violet-400/20', dot: 'bg-violet-400' },
  workflow_step_sandbox: { label: 'Containers', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
}

function QueueChip({ name, active, onClick }: { name: string; active: boolean; onClick?: () => void }) {
  const meta = QUEUE_META[name]
  if (!meta) return null
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
        active ? meta.color : 'text-[var(--color-text-muted)] bg-transparent border-[var(--color-border)] opacity-40 line-through'
      } ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? meta.dot : 'bg-[var(--color-text-muted)]'}`} />
      {meta.label}
    </button>
  )
}

function formatMemory(mb: number | undefined): string {
  if (mb == null) return '-'
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

export function Workers() {
  const { client } = useAgents()
  const [workers, setWorkers] = useState<WorkerNodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [tokenData, setTokenData] = useState<{ token: string; startCommand: string; lanCommand?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [networkTab, setNetworkTab] = useState<'tailscale' | 'lan'>('tailscale')
  const [waitingForWorker, setWaitingForWorker] = useState(false)
  const [workerCountAtOpen, setWorkerCountAtOpen] = useState(0)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)

  useEffect(() => {
    if (waitingForWorker && showAddModal && workers.length > workerCountAtOpen) {
      setShowAddModal(false)
      setWaitingForWorker(false)
      setTokenData(null)
    }
  }, [workers.length, waitingForWorker, showAddModal, workerCountAtOpen])

  useEffect(() => {
    client.listWorkers()
      .then((data) => { setWorkers(data); setError(null) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    const es = client.subscribeWorkers()
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'workersUpdate' && Array.isArray(data.workers)) {
          setWorkers(data.workers)
          setError(null)
          setLoading(false)
        }
      } catch {}
    }
    es.onerror = () => {
      client.listWorkers()
        .then((data) => { setWorkers(data); setError(null) })
        .catch((err) => setError(err.message))
    }
    return () => es.close()
  }, [client])

  const activeCount = workers.filter((w) => w.status === 'active').length
  const totalCores = workers.reduce((s, w) => s + (w.capabilities?.cpuCount ?? 0), 0)
  const totalMemory = workers.reduce((s, w) => s + (w.capabilities?.memoryMB ?? 0), 0)
  const selectedWorker = workers.find(w => w.id === selectedWorkerId) ?? null

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)]">
      <NavHeader
        title="Workers"
        actions={
          <button
            onClick={async () => {
              const data = await client.generateWorkerToken()
              setTokenData(data)
              setShowAddModal(true)
              setCopied(false)
              setWaitingForWorker(true)
              setWorkerCountAtOpen(workers.length)
            }}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + Add Worker
          </button>
        }
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Bento Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-2xl p-5 col-span-1">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Active Workers</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{activeCount}</div>
          </div>
          <div className="glass rounded-2xl p-5 col-span-1">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Total Cores</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{totalCores}</div>
          </div>
          <div className="glass rounded-2xl p-5 col-span-1">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Total Memory</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{formatMemory(totalMemory)}</div>
          </div>
          <div className="glass rounded-2xl p-5 col-span-1">
            <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Queue Types</div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">4</div>
          </div>
        </div>

        {error && (
          <div className="mb-6 glass rounded-2xl p-4 text-sm text-red-400 border-red-500/20">
            Failed to load workers: {error}
          </div>
        )}

        {loading && <div className="text-center py-20 text-[var(--color-text-muted)]">Loading workers...</div>}

        {!loading && !error && workers.length === 0 && (
          <div className="glass rounded-2xl p-16 text-center">
            <div className="text-4xl mb-4">{"🤖"}</div>
            <p className="text-[var(--color-text-secondary)] mb-4">No workers connected yet</p>
            <button
              onClick={async () => {
                const data = await client.generateWorkerToken()
                setTokenData(data)
                setShowAddModal(true)
                setCopied(false)
                setWaitingForWorker(true)
                setWorkerCountAtOpen(0)
              }}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-5 py-2.5 text-sm font-medium"
            >
              Add your first worker
            </button>
          </div>
        )}

        {/* Workers + Detail */}
        {!loading && workers.length > 0 && (
          <div className="flex gap-6">
            {/* Worker Cards */}
            <div className={`flex-1 space-y-3 ${selectedWorker ? '' : 'max-w-full'}`}>
              {workers.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWorkerId(selectedWorkerId === w.id ? null : w.id)}
                  className={`glass glass-hover rounded-2xl p-5 cursor-pointer transition-all ${
                    selectedWorkerId === w.id ? 'ring-1 ring-[var(--color-accent)] border-[var(--color-accent)]/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{w.name}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          w.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {w.status === 'active' && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                            </span>
                          )}
                          {w.status}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{w.hostname}</p>
                    </div>
                    <div className="text-right text-xs text-[var(--color-text-muted)]">
                      {w.lastHeartbeatAt ? <RelativeTime date={w.lastHeartbeatAt} /> : '-'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {(w.capabilities?.queues ?? []).map(q => (
                        <QueueChip key={q} name={q} active={true} />
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                      <span>{w.capabilities?.cpuCount ?? '-'} cores</span>
                      <span>{formatMemory(w.capabilities?.memoryMB)}</span>
                      {w.capabilities?.dockerAvailable && <span className="text-emerald-400">Docker</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail Panel */}
            {selectedWorker && (
              <div className="w-[340px] shrink-0 glass rounded-2xl p-6 self-start sticky top-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Worker Details</h3>
                  <button onClick={() => setSelectedWorkerId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-sm">x</button>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Name</label>
                    <div className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedWorker.name}</div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Resources</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[var(--color-surface-3)] p-3">
                        <div className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">{selectedWorker.capabilities?.cpuCount ?? '-'}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">CPU Cores</div>
                      </div>
                      <div className="rounded-xl bg-[var(--color-surface-3)] p-3">
                        <div className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">{formatMemory(selectedWorker.capabilities?.memoryMB)}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Memory</div>
                      </div>
                      <div className="rounded-xl bg-[var(--color-surface-3)] p-3">
                        <div className="text-lg font-bold text-[var(--color-text-primary)]">{selectedWorker.capabilities?.dockerAvailable ? 'Yes' : 'No'}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Docker</div>
                      </div>
                      <div className="rounded-xl bg-[var(--color-surface-3)] p-3">
                        <div className="text-lg font-bold text-[var(--color-text-primary)]">{selectedWorker.capabilities?.gpuAvailable ? 'Yes' : 'No'}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">GPU</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Queue Subscriptions</label>
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-2">Click to toggle. Applied on next heartbeat.</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(QUEUE_META).map(q => {
                        const active = selectedWorker.capabilities?.queues?.includes(q) ?? false
                        return <QueueChip key={q} name={q} active={active} onClick={async () => {
                          const currentQueues = selectedWorker.capabilities?.queues ?? []
                          const newQueues = active ? currentQueues.filter(x => x !== q) : [...currentQueues, q]
                          if (newQueues.length === 0) return
                          try {
                            await client.updateWorkerQueues(selectedWorker.id, newQueues)
                            setWorkers(prev => prev.map(w =>
                              w.id === selectedWorker.id ? { ...w, capabilities: { ...w.capabilities, queues: newQueues } } : w
                            ))
                          } catch {}
                        }} />
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--color-border)] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Registered</span>
                      <span className="text-[var(--color-text-secondary)]"><RelativeTime date={selectedWorker.registeredAt} /></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Last heartbeat</span>
                      <span className="text-[var(--color-text-secondary)]">{selectedWorker.lastHeartbeatAt ? <RelativeTime date={selectedWorker.lastHeartbeatAt} /> : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">ID</span>
                      <span className="text-[var(--color-text-muted)] font-mono text-[10px]">{selectedWorker.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="glass rounded-2xl max-w-2xl w-full mx-4 p-8 border-[var(--color-border-hover)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Add Worker</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-xl">&times;</button>
            </div>

            {tokenData && <>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                Run this on any machine. Only needs Node.js 18+.
              </p>

              {tokenData.lanCommand && (
                <div className="flex gap-1 mb-4 bg-[var(--color-surface-3)] rounded-lg p-1">
                  <button
                    onClick={() => { setNetworkTab('tailscale'); setCopied(false) }}
                    className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
                      networkTab === 'tailscale' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    Tailscale
                  </button>
                  <button
                    onClick={() => { setNetworkTab('lan'); setCopied(false) }}
                    className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
                      networkTab === 'lan' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    Local Network
                  </button>
                </div>
              )}

              <div className="mb-5">
                <div className="relative">
                  <pre className="bg-[var(--color-surface-0)] border border-[var(--color-border)] text-green-400 rounded-xl p-5 text-sm overflow-x-auto whitespace-pre-wrap break-all font-mono">
                    {networkTab === 'lan' && tokenData.lanCommand ? tokenData.lanCommand : tokenData.startCommand}
                  </pre>
                  <button
                    onClick={() => {
                      const cmd = networkTab === 'lan' && tokenData.lanCommand ? tokenData.lanCommand : tokenData.startCommand
                      navigator.clipboard.writeText(cmd)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="absolute top-3 right-3 bg-[var(--color-surface-4)] hover:bg-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {copied && waitingForWorker ? (
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400 flex items-center gap-3">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                  </span>
                  <span>Waiting for worker to connect...</span>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Single-use token. Expires in 24 hours.
                </p>
              )}
            </>}
          </div>
        </div>
      )}
    </div>
  )
}
