import { useState } from 'react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '../common/StatusBadge'
import { DurationDisplay } from '../common/DurationDisplay'
import { JsonViewer } from '../common/JsonViewer'
import type { StepDetail } from '@/api/types'

type Tab = 'I/O' | 'Logs' | 'Retries' | 'Container'

function formatName(name: string): string {
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const executorIcons: Record<string, string> = {
  function: '\u26A1',
  sandbox: '\uD83D\uDC33',
  ai: '\uD83E\uDD16',
  langgraph: '\uD83E\uDDE0',
  agreement: '\uD83E\uDD1D',
}

export function StepDetailPanel({
  step,
  onClose,
  onSubmitHumanInput,
}: {
  step: StepDetail | null
  onClose: () => void
  onSubmitHumanInput?: (stepName: string, data: Record<string, unknown>) => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>('I/O')

  if (!step) return null

  // Only show tabs that have content
  const tabs: Tab[] = ['I/O']
  if (step.attempt > 1) tabs.push('Retries')
  if (step.executorType === 'sandbox') tabs.push('Container')

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span>{executorIcons[step.executorType] ?? '\uD83D\uDCE6'}</span>
            <h3 className="font-semibold text-foreground">{formatName(step.stepName)}</h3>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <StatusBadge status={step.status} />
            <DurationDisplay startedAt={step.startedAt} completedAt={step.completedAt} />
            {step.attempt > 0 && (
              <span className="text-xs text-muted-foreground">
                Attempt {step.attempt}/{step.maxRetries}
              </span>
            )}
            {step.executedBy && (
              <span className="text-xs text-muted-foreground font-mono">
                Worker: {step.executedBy}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-2 rounded hover:bg-muted text-lg leading-none">
          {'\u00D7'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2',
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {activeTab === 'I/O' && (
          <>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Input</h4>
              <JsonViewer data={step.input} />
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Output</h4>
              <JsonViewer data={step.output} />
            </div>
            {step.error && step.status !== 'COMPLETED' && (
              <div>
                <h4 className="text-xs font-medium text-destructive uppercase mb-2">Error</h4>
                <pre className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
                  {step.error}
                </pre>
              </div>
            )}
            {step.status === 'WAITING_HUMAN' && step.humanPrompt && (
              <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/10 p-4">
                <h4 className="text-sm font-medium text-purple-400 mb-2">Human Input Required</h4>
                <p className="text-sm text-purple-300 mb-3">
                  {(step.humanPrompt as any)?.prompt ?? 'Please provide input'}
                </p>
                <button
                  type="button"
                  onClick={() => onSubmitHumanInput?.(step.stepName, { approved: true })}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Approve
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'Container' && step.executorType === 'sandbox' && (
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Image</h4>
              <p className="text-sm font-mono text-foreground">
                {(step.output as any)?._artifacts?.image ?? (step.input as any)?.image ?? '\u2014'}
              </p>
            </div>
            {(step.output as any)?._artifacts?.git && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Git</h4>
                <JsonViewer data={(step.output as any)._artifacts.git} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
