import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { StepConfig, ExecutorType } from './useWorkflowEditor'

const executorIcons: Record<ExecutorType, string> = {
  function: '\u26A1',
  ai: '\uD83E\uDD16',
  sandbox: '\uD83D\uDC10',
  human: '\uD83D\uDC64',
}

const executorBadgeColors: Record<ExecutorType, string> = {
  function: 'bg-cyan-100 text-cyan-700',
  ai: 'bg-violet-100 text-violet-700',
  sandbox: 'bg-orange-100 text-orange-700',
  human: 'bg-purple-100 text-purple-700',
}

export function EditorStepNode({ data, selected }: NodeProps) {
  const config = (data as Record<string, unknown>).config as StepConfig | undefined

  if (!config) return null

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div
        className={cn(
          'rounded-lg border-2 bg-white px-4 py-3 shadow-sm transition-all min-w-[180px] max-w-[220px]',
          selected
            ? 'border-blue-500 shadow-md ring-2 ring-blue-100'
            : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm flex-shrink-0">
              {executorIcons[config.executorType] ?? '\uD83D\uDCE6'}
            </span>
            <span className="text-sm font-semibold text-gray-800 truncate">
              {config.name || 'Untitled'}
            </span>
          </div>
          <span
            className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
              executorBadgeColors[config.executorType] ?? 'bg-gray-100 text-gray-600',
            )}
          >
            {config.executorType}
          </span>
        </div>
        {config.retries > 0 && (
          <div className="mt-1.5 text-[11px] text-gray-400">
            retries: {config.retries} | timeout: {Math.round(config.timeoutMs / 1000)}s
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2.5 !h-2.5 !border-2 !border-white" />
    </>
  )
}
