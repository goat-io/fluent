import type { StepLatencyMetrics } from '@/api/types'

function formatMs(ms: number | null): string {
  if (ms === null) return '-'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function MetricRow({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 tabular-nums">
        {value ?? '-'}{unit && value !== null ? unit : ''}
      </span>
    </div>
  )
}

export function StepMetricsTab({ metrics }: { metrics: StepLatencyMetrics }) {
  return (
    <div className="p-4 space-y-4">
      {/* Timing */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Timing</h4>
        <MetricRow label="Queue wait" value={formatMs(metrics.queueLatencyMs)} />
        <MetricRow label="Schedule to start" value={formatMs(metrics.scheduleToStartMs)} />
        <MetricRow label="Execution" value={formatMs(metrics.executionMs)} />
        <MetricRow label="Total" value={formatMs(metrics.totalMs)} />
        <MetricRow label="Attempt" value={metrics.attempt} />
      </div>

      {/* Cost */}
      {(metrics.tokensUsed || metrics.costUsd || metrics.modelUsed) && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cost</h4>
          <MetricRow label="Model" value={metrics.modelUsed} />
          <MetricRow label="Tokens" value={metrics.tokensUsed?.toLocaleString() ?? null} />
          <MetricRow
            label="Cost"
            value={metrics.costUsd !== null ? `$${metrics.costUsd.toFixed(4)}` : null}
          />
        </div>
      )}
    </div>
  )
}
