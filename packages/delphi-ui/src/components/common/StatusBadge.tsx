import { cn } from '@/lib/utils'
import type { WorkflowStatus, StepStatus } from '@/api/types'

type Status = WorkflowStatus | StepStatus

const statusConfig: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' },
  RUNNING: { label: 'Running', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' },
  QUEUED: { label: 'Queued', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  FAILED: { label: 'Failed', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  WAITING_HUMAN: { label: 'Waiting', bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400 animate-pulse' },
  SKIPPED: { label: 'Skipped', bg: 'bg-gray-500/10', text: 'text-[var(--color-text-muted)]', dot: 'bg-gray-500' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-stone-500/10', text: 'text-stone-400', dot: 'bg-stone-400' },
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = statusConfig[status] ?? statusConfig.PENDING

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', config.bg, config.text, `border-current/20`, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
