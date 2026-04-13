import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { StepConfig, ExecutorType } from './useWorkflowEditor'

const executorIcons: Record<ExecutorType, string> = {
  function: '\u26A1',
  ai: '\uD83E\uDD16',
  sandbox: '\uD83D\uDC10',
  human: '\uD83D\uDC64',
  task_runner: '\uD83D\uDD04',
  claude_code: '\u2728',
}

const executorBadgeColors: Record<ExecutorType, string> = {
  function: 'bg-cyan-900/60 text-cyan-300',
  ai: 'bg-violet-900/60 text-violet-300',
  sandbox: 'bg-orange-900/60 text-orange-300',
  human: 'bg-purple-900/60 text-purple-300',
  task_runner: 'bg-emerald-900/60 text-emerald-300',
  claude_code: 'bg-amber-900/60 text-amber-300',
}

export function EditorStepNode({ data, selected }: NodeProps) {
  const config = (data as Record<string, unknown>).config as StepConfig | undefined

  if (!config) return null

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: 'var(--color-text-muted, #55556a)',
          width: 10,
          height: 10,
          border: '2px solid var(--color-surface-2, #1a1a26)',
        }}
      />
      <div
        className={cn(
          'rounded-lg px-4 py-3 transition-all min-w-[180px] max-w-[220px]',
          selected
            ? 'shadow-lg ring-2'
            : 'hover:border-[rgba(255,255,255,0.15)]',
        )}
        style={{
          background: 'var(--color-surface-2, #1a1a26)',
          border: selected
            ? '2px solid var(--color-accent, #6366f1)'
            : '2px solid var(--color-border, rgba(255,255,255,0.08))',
          boxShadow: selected
            ? '0 0 0 3px rgba(99,102,241,0.2)'
            : '0 2px 8px rgba(0,0,0,0.3)',
          ...(selected ? { ringColor: 'var(--color-accent, #6366f1)' } : {}),
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm flex-shrink-0">
              {executorIcons[config.executorType] ?? '\uD83D\uDCE6'}
            </span>
            <span
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--color-text-primary, #f0f0f5)' }}
            >
              {config.name || 'Untitled'}
            </span>
          </div>
          <span
            className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
              executorBadgeColors[config.executorType] ?? 'bg-gray-700 text-gray-300',
            )}
          >
            {config.executorType === 'task_runner' ? 'tasks' : config.executorType}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {config.retries > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted, #55556a)' }}>
              retries: {config.retries} | timeout: {Math.round(config.timeoutMs / 1000)}s
            </span>
          )}
        </div>
        {/* Feature badges */}
        {(config.requiresHumanApproval || config.conditionExpression || config.executorType === 'task_runner') && (
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            {config.requiresHumanApproval && (
              <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1 py-0.5 rounded" title="Requires human approval">
                approval
              </span>
            )}
            {config.conditionExpression && (
              <span className="text-[10px] bg-amber-900/50 text-amber-300 px-1 py-0.5 rounded" title="Conditional step">
                conditional
              </span>
            )}
            {config.mapInputExpression && (
              <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1 py-0.5 rounded" title="Input mapping">
                mapInput
              </span>
            )}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: 'var(--color-text-muted, #55556a)',
          width: 10,
          height: 10,
          border: '2px solid var(--color-surface-2, #1a1a26)',
        }}
      />
    </>
  )
}
