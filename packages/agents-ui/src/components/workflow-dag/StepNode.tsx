import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '../common/StatusBadge'
import { DurationDisplay } from '../common/DurationDisplay'
import type { StepDetail } from '@/api/types'

const executorIcons: Record<string, string> = {
  function: '\u26A1',
  sandbox: '\uD83D\uDC33',
  ai: '\uD83E\uDD16',
  langgraph: '\uD83E\uDDE0',
  agreement: '\uD83E\uDD1D',
}

export function StepNode({ data, selected }: NodeProps) {
  const step = data as unknown as StepDetail

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />
      <div
        className={cn(
          'rounded-lg border-2 bg-white px-4 py-3 shadow-sm transition-all min-w-[180px]',
          selected ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300',
          step.status === 'RUNNING' && 'border-blue-300',
          step.status === 'FAILED' && 'border-red-200 bg-red-50/30',
          step.status === 'WAITING_HUMAN' && 'border-purple-300 bg-purple-50/30',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{executorIcons[step.executorType] ?? '\uD83D\uDCE6'}</span>
            <span className="text-sm font-semibold text-gray-800 truncate max-w-[120px]">
              {step.stepName}
            </span>
          </div>
          <StatusBadge status={step.status} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
          <span>{step.executorType}</span>
          <DurationDisplay startedAt={step.startedAt} completedAt={step.completedAt} />
        </div>
        {step.attempt > 1 && (
          <div className="mt-1 text-xs text-amber-600">
            Attempt {step.attempt}/{step.maxRetries}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </>
  )
}
