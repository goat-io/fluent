import type { ExecutorType } from './useWorkflowEditor'

interface PaletteItem {
  type: ExecutorType
  label: string
  icon: string
  description: string
  color: string
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'function',
    label: 'Function',
    icon: '\u26A1',
    description: 'Execute a JavaScript/TypeScript function',
    color: 'border-cyan-300 bg-cyan-50',
  },
  {
    type: 'ai',
    label: 'AI',
    icon: '\uD83E\uDD16',
    description: 'Run an AI/LLM inference step',
    color: 'border-violet-300 bg-violet-50',
  },
  {
    type: 'sandbox',
    label: 'Sandbox',
    icon: '\uD83D\uDC10',
    description: 'Execute in a Docker sandbox',
    color: 'border-orange-300 bg-orange-50',
  },
  {
    type: 'human',
    label: 'Human Approval',
    icon: '\uD83D\uDC64',
    description: 'Pause for human review and input',
    color: 'border-purple-300 bg-purple-50',
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
    <div className="w-[200px] border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
      <div className="px-3 py-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Step Palette
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
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
            className={`
              cursor-grab active:cursor-grabbing
              border-2 rounded-lg p-3 transition-all
              hover:shadow-md hover:scale-[1.02]
              select-none
              ${item.color}
            `}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-semibold text-gray-800">
                {item.label}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-tight">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
