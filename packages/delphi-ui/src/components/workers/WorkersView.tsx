import { useEffect, useRef, useState } from 'react'
import { RelativeTime } from '@/components/common/RelativeTime'
import type { AgentsClient } from '@/api/client'
import type { WorkerNodeInfo } from '@/api/types'

export interface WorkersViewProps {
  client: AgentsClient
}

export function WorkersView({ client }: WorkersViewProps) {
  const [workers, setWorkers] = useState<WorkerNodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const fetch = () => {
      client
        .listWorkers()
        .then(data => {
          if (mountedRef.current) {
            setWorkers(data)
            setLoading(false)
          }
        })
        .catch(() => {
          if (mountedRef.current) setLoading(false)
        })
    }

    fetch()
    const timer = setInterval(fetch, 10_000)

    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [client])

  const active = workers.filter(w => w.status === 'active')
  const offline = workers.filter(w => w.status !== 'active')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Active Workers</p>
          <p className="text-2xl font-bold text-green-400 tabular-nums">{active.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Cores</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {workers.reduce((s, w) => s + (w.capabilities?.cpuCount ?? 0), 0)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Memory</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {Math.round(workers.reduce((s, w) => s + (w.capabilities?.memoryMB ?? 0), 0) / 1024)}GB
          </p>
        </div>
      </div>

      {/* Worker list */}
      {workers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No workers registered
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div
            className="grid items-center px-6 py-3.5 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider"
            style={{ gridTemplateColumns: '1fr 140px 100px 100px 120px' }}>
            <span>Worker</span>
            <span>Status</span>
            <span>CPU</span>
            <span>Memory</span>
            <span className="text-right">Last Heartbeat</span>
          </div>

          {[...active, ...offline].map(w => (
            <div
              key={w.id}
              className="grid items-center px-6 py-4 border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: '1fr 140px 100px 100px 120px' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                {w.hostname && (
                  <p className="text-xs text-muted-foreground font-mono truncate">{w.hostname}</p>
                )}
              </div>
              <span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                  w.status === 'active'
                    ? 'bg-green-500/10 text-green-400'
                    : w.status === 'draining'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    w.status === 'active' ? 'bg-green-400 animate-pulse' : w.status === 'draining' ? 'bg-amber-400' : 'bg-muted-foreground'
                  }`} />
                  {w.status}
                </span>
              </span>
              <span className="text-sm text-foreground tabular-nums">
                {w.capabilities?.cpuCount ?? '-'}
              </span>
              <span className="text-sm text-foreground tabular-nums">
                {w.capabilities?.memoryMB ? `${Math.round(w.capabilities.memoryMB / 1024)}GB` : '-'}
              </span>
              <span className="text-xs text-muted-foreground text-right">
                {w.lastHeartbeatAt ? <RelativeTime date={w.lastHeartbeatAt} /> : '-'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
