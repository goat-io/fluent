import { useState } from 'react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '../common/StatusBadge'
import { DurationDisplay } from '../common/DurationDisplay'
import { JsonViewer } from '../common/JsonViewer'
import type { StepDetail } from '@/api/types'

const tabs = ['I/O', 'Logs', 'Retries', 'Container'] as const
type Tab = (typeof tabs)[number]

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

  return (
    <div className="h-full flex flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span>{executorIcons[step.executorType] ?? '\uD83D\uDCE6'}</span>
            <h3 className="font-semibold text-gray-900">{step.stepName}</h3>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <StatusBadge status={step.status} />
            <DurationDisplay startedAt={step.startedAt} completedAt={step.completedAt} />
            {step.attempt > 0 && (
              <span className="text-xs text-gray-400">
                Attempt {step.attempt}/{step.maxRetries}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded hover:bg-gray-100 text-lg leading-none">
          {'\u00D7'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2',
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
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
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Input</h4>
              <JsonViewer data={step.input} />
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Output</h4>
              <JsonViewer data={step.output} />
            </div>
            {step.error && (
              <div>
                <h4 className="text-xs font-medium text-red-500 uppercase mb-2">Error</h4>
                <pre className="rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {step.error}
                </pre>
              </div>
            )}
            {step.status === 'WAITING_HUMAN' && step.humanPrompt && (
              <div className="mt-4 rounded-md border border-purple-200 bg-purple-50 p-4">
                <h4 className="text-sm font-medium text-purple-800 mb-2">Human Input Required</h4>
                <p className="text-sm text-purple-700 mb-3">
                  {(step.humanPrompt as any)?.prompt ?? 'Please provide input'}
                </p>
                <button
                  type="button"
                  onClick={() => onSubmitHumanInput?.(step.stepName, { approved: true })}
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
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
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Image</h4>
              <p className="text-sm font-mono text-gray-700">
                {(step.output as any)?._artifacts?.image ?? (step.input as any)?.image ?? '\u2014'}
              </p>
            </div>
            {(step.output as any)?._artifacts?.git && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Git</h4>
                <JsonViewer data={(step.output as any)._artifacts.git} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
