import { cn } from '@/lib/utils'
import type { WorkflowStatus, StepStatus } from '@/api/types'

type Status = WorkflowStatus | StepStatus

const statusConfig: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  PENDING: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
  RUNNING: { label: 'Running', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500 animate-pulse' },
  QUEUED: { label: 'Queued', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  FAILED: { label: 'Failed', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  WAITING_HUMAN: { label: 'Waiting', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500 animate-pulse' },
  SKIPPED: { label: 'Skipped', bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-300' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-stone-50', text: 'text-stone-600', dot: 'bg-stone-400' },
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = statusConfig[status] ?? statusConfig.PENDING

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', config.bg, config.text, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
