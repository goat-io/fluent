import type { ExecutorType } from './useWorkflowEditor'

interface PaletteItem {
  type: ExecutorType
  label: string
  icon: string
  description: string
  borderColor: string
  bgColor: string
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'function',
    label: 'Function',
    icon: '\u26A1',
    description: 'Execute a JavaScript/TypeScript function',
    borderColor: '#22d3ee',
    bgColor: 'rgba(34,211,238,0.08)',
  },
  {
    type: 'ai',
    label: 'AI',
    icon: '\uD83E\uDD16',
    description: 'Run an AI/LLM inference step',
    borderColor: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.08)',
  },
  {
    type: 'sandbox',
    label: 'Sandbox',
    icon: '\uD83D\uDC10',
    description: 'Execute in a Docker sandbox',
    borderColor: '#fb923c',
    bgColor: 'rgba(251,146,60,0.08)',
  },
  {
    type: 'human',
    label: 'Human Approval',
    icon: '\uD83D\uDC64',
    description: 'Pause for human review and input',
    borderColor: '#c084fc',
    bgColor: 'rgba(192,132,252,0.08)',
  },
  {
    type: 'task_runner',
    label: 'Task Runner',
    icon: '\uD83D\uDD04',
    description: 'Fan-out/fan-in task processing',
    borderColor: '#34d399',
    bgColor: 'rgba(52,211,153,0.08)',
  },
]

interface StepPaletteProps {
  onAddStep?: (type: ExecutorType) => void
}

export function StepPalette({ onAddStep }: StepPaletteProps) {
  function handleDragStart(
    event: React.DragEvent<HTMLDivElement>,
    type: ExecutorType,
  ) {
    event.dataTransfer.setData('application/workflow-step-type', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className="w-[200px] flex flex-col overflow-y-auto"
      style={{
        background: 'var(--color-surface-1, #12121a)',
        borderRight: '1px solid var(--color-border, rgba(255,255,255,0.08))',
      }}
    >
      <div
        className="px-3 py-3"
        style={{ borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))' }}
      >
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted, #55556a)' }}
        >
          Step Palette
        </h3>
        <p
          className="text-[11px] mt-0.5"
          style={{ color: 'var(--color-text-muted, #55556a)' }}
        >
          Drag to canvas or click to add
        </p>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => handleDragStart(e, item.type)}
            onClick={() => onAddStep?.(item.type)}
            className="cursor-grab active:cursor-grabbing rounded-lg p-3 transition-all hover:scale-[1.02] select-none"
            style={{
              background: item.bgColor,
              border: `2px solid ${item.borderColor}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{item.icon}</span>
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--color-text-primary, #f0f0f5)' }}
              >
                {item.label}
              </span>
            </div>
            <p
              className="text-[11px] mt-1 leading-tight"
              style={{ color: 'var(--color-text-secondary, #8888a0)' }}
            >
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
