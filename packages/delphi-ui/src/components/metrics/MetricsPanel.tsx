import { useEffect, useState } from 'react'
import { useAgents } from '@/providers/AgentsProvider'
import type { AggregateMetrics } from '@/api/types'

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function BarChart({ data, label }: { data: Record<string, number>; label: string }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <div className="text-gray-400 text-sm">No data</div>
  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-2">{label}</div>
      <div className="space-y-1.5">
        {entries.map(([name, value]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-24 truncate" title={name}>{name}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
              />
            </div>
            <span className="text-xs text-gray-700 tabular-nums w-16 text-right">
              {formatMs(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MetricsPanel() {
  const { client } = useAgents()
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.getAggregateMetrics().then(setMetrics).finally(() => setLoading(false))
    const interval = setInterval(() => {
      client.getAggregateMetrics().then(setMetrics)
    }, 10_000)
    return () => clearInterval(interval)
  }, [client])

  if (loading) return <div className="text-gray-400 text-sm">Loading metrics...</div>
  if (!metrics) return null

  const p = metrics.stepExecutionPercentiles

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Percentiles Card */}
      {p && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Step Latency Percentiles</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900 tabular-nums">{formatMs(p.p50)}</div>
              <div className="text-xs text-gray-500">p50</div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-600 tabular-nums">{formatMs(p.p95)}</div>
              <div className="text-xs text-gray-500">p95</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600 tabular-nums">{formatMs(p.p99)}</div>
              <div className="text-xs text-gray-500">p99</div>
            </div>
          </div>
        </div>
      )}

      {/* Avg Execution by Executor */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Avg Step Execution</h3>
        <BarChart data={metrics.avgExecutionMsByExecutor} label="by executor type" />
      </div>

      {/* External Action Latency */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Avg Action Latency</h3>
        <BarChart data={metrics.avgActionLatencyByProvider} label="by provider" />
        {Object.keys(metrics.actionCountByProvider).length > 0 && (
          <div className="mt-3 text-xs text-gray-400">
            Total: {Object.values(metrics.actionCountByProvider).reduce((a, b) => a + b, 0)} actions
          </div>
        )}
      </div>
    </div>
  )
}
