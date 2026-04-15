import { useState } from 'react'
import type { ExecutorType } from './useWorkflowEditor'

interface PaletteItem {
  type: ExecutorType
  label: string
  icon: string
  description: string
  borderColor: string
  bgColor: string
  prefilledConfig?: Record<string, unknown>
}

const STEPS: PaletteItem[] = [
  { type: 'function', label: 'Function', icon: '\u26A1', description: 'Execute a JS/TS handler', borderColor: '#22d3ee', bgColor: 'rgba(34,211,238,0.08)' },
  { type: 'ai', label: 'AI / LLM', icon: '\uD83E\uDD16', description: 'LLM inference with tool calls', borderColor: '#a78bfa', bgColor: 'rgba(167,139,250,0.08)' },
  { type: 'task_runner', label: 'Task Runner', icon: '\uD83D\uDD04', description: 'Fan-out/fan-in parallel tasks', borderColor: '#34d399', bgColor: 'rgba(52,211,153,0.08)' },
  { type: 'human', label: 'Human Review', icon: '\uD83D\uDC64', description: 'Pause for human approval', borderColor: '#c084fc', bgColor: 'rgba(192,132,252,0.08)' },
  { type: 'sandbox', label: 'Docker Sandbox', icon: '\uD83D\uDC10', description: 'Isolated container execution', borderColor: '#fb923c', bgColor: 'rgba(251,146,60,0.08)' },
  { type: 'claude_code' as any, label: 'Claude Code', icon: '\u2728', description: 'Claude via CLI — uses Max subscription', borderColor: '#d4a574', bgColor: 'rgba(212,165,116,0.08)' },
]

const INTEGRATIONS: PaletteItem[] = [
  { type: 'function' as ExecutorType, label: 'GitHub', icon: '\uD83D\uDC19', description: 'PRs, issues, comments, merge', borderColor: '#e5e5e5', bgColor: 'rgba(229,229,229,0.06)', prefilledConfig: { handler: 'github_action', provider: 'github', actionType: 'create_pr' } },
  { type: 'function' as ExecutorType, label: 'Linear', icon: '\uD83D\uDCCB', description: 'Issues, updates, comments', borderColor: '#5E6AD2', bgColor: 'rgba(94,106,210,0.08)', prefilledConfig: { handler: 'linear_action', provider: 'linear', actionType: 'create_issue' } },
  { type: 'function' as ExecutorType, label: 'Slack', icon: '\uD83D\uDCAC', description: 'Send & update messages', borderColor: '#E01E5A', bgColor: 'rgba(224,30,90,0.08)', prefilledConfig: { handler: 'slack_action', provider: 'slack', actionType: 'send_message' } },
  { type: 'function' as ExecutorType, label: 'Web Search', icon: '\uD83D\uDD0D', description: 'AI skill: search the web', borderColor: '#60a5fa', bgColor: 'rgba(96,165,250,0.08)', prefilledConfig: { handler: 'ai_with_skills', skills: ['webSearch'] } },
  { type: 'function' as ExecutorType, label: 'Code Exec', icon: '\uD83D\uDCBB', description: 'AI skill: run code snippets', borderColor: '#f472b6', bgColor: 'rgba(244,114,182,0.08)', prefilledConfig: { handler: 'ai_with_skills', skills: ['codeExecution'] } },
]

interface StepPaletteProps {
  onAddStep?: (type: ExecutorType, config?: Record<string, unknown>) => void
}

function PaletteCard({ item, onAddStep }: { item: PaletteItem; onAddStep?: StepPaletteProps['onAddStep'] }) {
  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData('application/workflow-step-type', item.type)
    if (item.prefilledConfig) {
      event.dataTransfer.setData('application/workflow-step-config', JSON.stringify(item.prefilledConfig))
    }
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onAddStep?.(item.type, item.prefilledConfig)}
      className="cursor-grab active:cursor-grabbing rounded-xl p-3.5 transition-all hover:scale-[1.02] hover:shadow-lg select-none"
      style={{ background: item.bgColor, border: `1.5px solid ${item.borderColor}50` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xl">{item.icon}</span>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.label}</div>
          <div className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{item.description}</div>
        </div>
      </div>
    </div>
  )
}

export function StepPalette({ onAddStep }: StepPaletteProps) {
  const [tab, setTab] = useState<'steps' | 'integrations'>('steps')

  const items = tab === 'steps' ? STEPS : INTEGRATIONS

  return (
    <div
      className="w-[220px] flex flex-col overflow-hidden"
      style={{ background: 'var(--color-surface-1)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Tabs */}
      <div className="px-3 py-2.5 flex gap-1" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setTab('steps')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
            tab === 'steps'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
          }`}
        >
          Steps
        </button>
        <button
          onClick={() => setTab('integrations')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
            tab === 'integrations'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
          }`}
        >
          Integrations
        </button>
      </div>

      <p className="px-3 pt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        Drag to canvas or click to add
      </p>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-3 overflow-y-auto">
        {items.map((item, idx) => (
          <PaletteCard key={`${item.label}-${idx}`} item={item} onAddStep={onAddStep} />
        ))}
      </div>
    </div>
  )
}
