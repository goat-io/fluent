import { StatusBadge } from '../common/StatusBadge'
import { DurationDisplay } from '../common/DurationDisplay'
import { RelativeTime } from '../common/RelativeTime'
import type { WorkflowRunSummary } from '@/api/types'

function formatName(name: string): string {
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function WorkflowList({
  workflows,
  onSelect,
}: {
  workflows: WorkflowRunSummary[]
  onSelect: (runId: string) => void
}) {
  if (workflows.length === 0) {
    return (
      <div className="glass rounded-2xl p-16 text-center">
        <p className="text-[var(--color-text-muted)]">No workflow runs found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {workflows.map(wf => (
        <div
          key={wf.id}
          className="glass glass-hover rounded-2xl p-5 cursor-pointer transition-all"
          onClick={() => onSelect(wf.id)}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {formatName(wf.workflowName)}
                </h3>
                <span className="text-xs text-[var(--color-text-muted)]">v{wf.workflowVersion}</span>
                <StatusBadge status={wf.status} />
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{wf.id.substring(0, 12)}...</p>
            </div>
            <div className="text-right text-xs text-[var(--color-text-muted)]">
              <RelativeTime date={wf.createdAt} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-[var(--color-surface-4)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${wf.stepCount > 0 ? (wf.completedStepCount / wf.stepCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                  {wf.completedStepCount}/{wf.stepCount}
                </span>
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              <DurationDisplay startedAt={wf.startedAt} completedAt={wf.completedAt} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
