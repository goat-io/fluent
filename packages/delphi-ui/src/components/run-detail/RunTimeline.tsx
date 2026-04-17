import { useEffect, useMemo, useState } from 'react'
import type { WorkflowRunDetail } from '@/api/types'

interface RunTimelineProps {
  run: WorkflowRunDetail
  onStepSelect?: (stepName: string) => void
  selectedStep?: string
}

interface Phase {
  key: string
  label: string
  startMs: number
  durationMs: number
  color: string
  clickable?: boolean
}

function formatMs(ms: number): string {
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) {
    const s = ms / 1000
    return `${s.toFixed(s < 10 ? 1 : 0)}s`
  }
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

function formatName(name: string): string {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const STEP_STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#22c55e',
  RUNNING: '#3b82f6',
  FAILED: '#ef4444',
  WAITING_HUMAN: '#a855f7',
  PENDING: '#9ca3af',
  QUEUED: '#f59e0b',
  SKIPPED: '#d1d5db',
  CANCELLED: '#78716c',
}

export function RunTimeline({ run, onStepSelect, selectedStep }: RunTimelineProps) {
  // Live tick for running workflows
  const isRunning = !run.completedAt
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(timer)
  }, [isRunning])

  const { phases, totalMs } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick // dependency to re-compute on tick
    const runStart = run.startedAt ? new Date(run.startedAt).getTime() : 0
    const runEnd = run.completedAt ? new Date(run.completedAt).getTime() : Date.now()

    if (!runStart) return { phases: [], totalMs: 0 }

    const total = runEnd - runStart
    const result: Phase[] = []

    // Build step phases with timezone drift correction
    const stepPhases: Array<Phase & { rawStart: number; rawEnd: number }> = []
    for (const s of run.steps) {
      if (!s.startedAt) continue
      const start = new Date(s.startedAt).getTime()
      const end = s.completedAt ? new Date(s.completedAt).getTime() : Date.now()
      let offset = start - runStart

      // Fix timezone drift (pg driver inconsistency)
      if (offset < -60_000 || offset > total + 60_000) {
        const drift = Math.round(offset / 3_600_000) * 3_600_000
        offset = offset - drift
      }

      stepPhases.push({
        key: s.stepName,
        label: formatName(s.stepName),
        startMs: Math.max(offset, 0),
        durationMs: end - start,
        color: STEP_STATUS_COLORS[s.status] ?? '#9ca3af',
        clickable: true,
        rawStart: start,
        rawEnd: end,
      })
    }
    stepPhases.sort((a, b) => a.startMs - b.startMs)

    // No steps started yet — show a single "Waiting" phase
    if (stepPhases.length === 0) {
      result.push({
        key: '_waiting',
        label: 'Waiting for step to start',
        startMs: 0,
        durationMs: total,
        color: '#f59e0b',
      })
      return { phases: result, totalMs: total }
    }

    // Scheduling phase (run start → first step start)
    const firstStepStart = stepPhases[0].startMs
    if (firstStepStart > 0) {
      result.push({
        key: '_scheduling',
        label: 'Scheduling',
        startMs: 0,
        durationMs: firstStepStart,
        color: '#f59e0b',
      })
    }

    // Step phases
    result.push(...stepPhases)

    // Finalization phase (last step end → run end) — only for completed runs
    const lastStepEnd = Math.max(...stepPhases.map(s => s.startMs + s.durationMs))
    const finMs = total - lastStepEnd
    if (finMs > 0 && run.completedAt) {
      result.push({
        key: '_finalization',
        label: 'Finalization',
        startMs: lastStepEnd,
        durationMs: finMs,
        color: '#6366f1',
      })
    }

    return { phases: result, totalMs: total }
  }, [run])

  if (totalMs === 0 || phases.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          Total: {formatMs(totalMs)}
        </span>
      </div>

      {/* Gantt chart */}
      <div className="space-y-1">
        {phases.map(phase => {
          const leftPct = (phase.startMs / totalMs) * 100
          const widthPct = Math.max((phase.durationMs / totalMs) * 100, 0.5)
          const isSelected = selectedStep === phase.key

          return (
            <div
              key={phase.key}
              className="flex items-center gap-3 group"
              style={{ height: '32px' }}>
              {/* Label column */}
              <div className="w-28 sm:w-44 shrink-0 text-right pr-2">
                <span className="text-xs text-muted-foreground truncate block">
                  {phase.label}
                </span>
              </div>

              {/* Bar column */}
              <div
                className={`relative flex-1 h-full rounded overflow-hidden ${
                  phase.clickable ? 'cursor-pointer' : ''
                } ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''}`}
                onClick={() => phase.clickable && onStepSelect?.(phase.key)}>
                {/* Background track */}
                <div className="absolute inset-0 rounded bg-muted/50" />

                {/* Bar */}
                <div
                  className="absolute top-1 bottom-1 rounded"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.min(widthPct, 100 - leftPct)}%`,
                    backgroundColor: phase.color,
                    opacity: 0.85,
                  }}
                />

                {/* Duration label (next to bar) */}
                <div
                  className="absolute top-0 h-full flex items-center"
                  style={{
                    left: `${Math.min(leftPct + widthPct + 0.5, 90)}%`,
                  }}>
                  <span className="text-[10px] text-muted-foreground tabular-nums ml-1.5 whitespace-nowrap">
                    {formatMs(phase.durationMs)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Time axis */}
      <div className="flex items-center gap-3 mt-1.5">
        <div className="w-28 sm:w-44 shrink-0" />
        <div className="flex-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>{formatMs(totalMs * 0.25)}</span>
          <span>{formatMs(totalMs * 0.5)}</span>
          <span>{formatMs(totalMs * 0.75)}</span>
          <span>{formatMs(totalMs)}</span>
        </div>
      </div>
    </div>
  )
}
