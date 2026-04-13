import type { ExecutorType } from './useWorkflowEditor'

interface PaletteItem {
  type: ExecutorType
  label: string
  icon: string
  description: string
  borderColor: string
  bgColor: string
  category: 'core' | 'integration' | 'advanced'
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Core
  {
    type: 'function',
    label: 'Function',
    icon: '\u26A1',
    description: 'Execute a JS/TS handler',
    borderColor: '#22d3ee',
    bgColor: 'rgba(34,211,238,0.08)',
    category: 'core',
  },
  {
    type: 'ai',
    label: 'AI / LLM',
    icon: '\uD83E\uDD16',
    description: 'LLM inference with tool calls',
    borderColor: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.08)',
    category: 'core',
  },
  {
    type: 'task_runner',
    label: 'Task Runner',
    icon: '\uD83D\uDD04',
    description: 'Fan-out/fan-in parallel tasks',
    borderColor: '#34d399',
    bgColor: 'rgba(52,211,153,0.08)',
    category: 'core',
  },
  {
    type: 'human',
    label: 'Human Review',
    icon: '\uD83D\uDC64',
    description: 'Pause for human approval',
    borderColor: '#c084fc',
    bgColor: 'rgba(192,132,252,0.08)',
    category: 'core',
  },
  {
    type: 'sandbox',
    label: 'Docker Sandbox',
    icon: '\uD83D\uDC10',
    description: 'Isolated container execution',
    borderColor: '#fb923c',
    bgColor: 'rgba(251,146,60,0.08)',
    category: 'core',
  },
  // Integrations
  {
    type: 'function' as ExecutorType,
    label: 'GitHub',
    icon: '\uD83D\uDC19',
    description: 'PRs, issues, comments, merge',
    borderColor: '#e5e5e5',
    bgColor: 'rgba(229,229,229,0.06)',
    category: 'integration',
  },
  {
    type: 'function' as ExecutorType,
    label: 'Linear',
    icon: '\uD83D\uDCCB',
    description: 'Issues, updates, comments',
    borderColor: '#5E6AD2',
    bgColor: 'rgba(94,106,210,0.08)',
    category: 'integration',
  },
  {
    type: 'function' as ExecutorType,
    label: 'Slack',
    icon: '\uD83D\uDCAC',
    description: 'Send & update messages',
    borderColor: '#E01E5A',
    bgColor: 'rgba(224,30,90,0.08)',
    category: 'integration',
  },
  // Advanced
  {
    type: 'function' as ExecutorType,
    label: 'Web Search',
    icon: '\uD83D\uDD0D',
    description: 'AI skill: search the web',
    borderColor: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.08)',
    category: 'advanced',
  },
  {
    type: 'function' as ExecutorType,
    label: 'Code Exec',
    icon: '\uD83D\uDCBB',
    description: 'AI skill: run code snippets',
    borderColor: '#f472b6',
    bgColor: 'rgba(244,114,182,0.08)',
    category: 'advanced',
  },
]

// Map integration/skill labels to pre-filled executorConfig
const PREFILLED_CONFIG: Record<string, Record<string, unknown>> = {
  'GitHub': { handler: 'github_action', provider: 'github', actionType: 'create_pr' },
  'Linear': { handler: 'linear_action', provider: 'linear', actionType: 'create_issue' },
  'Slack': { handler: 'slack_action', provider: 'slack', actionType: 'send_message' },
  'Web Search': { handler: 'ai_with_skills', skills: ['webSearch'] },
  'Code Exec': { handler: 'ai_with_skills', skills: ['codeExecution'] },
}

interface StepPaletteProps {
  onAddStep?: (type: ExecutorType, config?: Record<string, unknown>) => void
}

export function StepPalette({ onAddStep }: StepPaletteProps) {
  function handleDragStart(
    event: React.DragEvent<HTMLDivElement>,
    item: PaletteItem,
  ) {
    event.dataTransfer.setData('application/workflow-step-type', item.type)
    if (PREFILLED_CONFIG[item.label]) {
      event.dataTransfer.setData('application/workflow-step-config', JSON.stringify(PREFILLED_CONFIG[item.label]))
    }
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleClick(item: PaletteItem) {
    onAddStep?.(item.type, PREFILLED_CONFIG[item.label])
  }

  const categories = [
    { key: 'core', label: 'Steps' },
    { key: 'integration', label: 'Integrations' },
    { key: 'advanced', label: 'Skills' },
  ]

  return (
    <div
      className="w-[200px] flex flex-col overflow-y-auto"
      style={{
        background: 'var(--color-surface-1, #12121a)',
        borderRight: '1px solid var(--color-border, rgba(255,255,255,0.08))',
      }}
    >
      {categories.map(({ key, label }) => {
        const items = PALETTE_ITEMS.filter(i => i.category === key)
        if (items.length === 0) return null
        return (
          <div key={key}>
            <div
              className="px-3 py-2"
              style={{ borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))' }}
            >
              <h3
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted, #55556a)' }}
              >
                {label}
              </h3>
            </div>
            <div className="flex flex-col gap-1.5 p-2">
              {items.map((item, idx) => (
                <div
                  key={`${item.type}-${idx}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleClick(item)}
                  className="cursor-grab active:cursor-grabbing rounded-lg p-2.5 transition-all hover:scale-[1.02] select-none"
                  style={{
                    background: item.bgColor,
                    border: `1.5px solid ${item.borderColor}40`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: 'var(--color-text-primary, #f0f0f5)' }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p
                    className="text-[10px] mt-0.5 leading-tight"
                    style={{ color: 'var(--color-text-secondary, #8888a0)' }}
                  >
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
