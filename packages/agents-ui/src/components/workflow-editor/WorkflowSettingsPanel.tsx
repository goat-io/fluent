import type { WorkflowEditorState, TriggerConfig, BudgetConfig } from './useWorkflowEditor'

interface WorkflowSettingsPanelProps {
  editor: WorkflowEditorState
}

export function WorkflowSettingsPanel({ editor }: WorkflowSettingsPanelProps) {
  const {
    defaultRetries,
    defaultTimeoutMs,
    failFast,
    triggers,
    budget,
    setDefaultRetries,
    setDefaultTimeoutMs,
    setFailFast,
    setTriggers,
    setBudget,
    setShowSettings,
  } = editor

  function addTrigger() {
    setTriggers([...triggers, { type: 'event', eventType: '' }])
  }

  function removeTrigger(index: number) {
    setTriggers(triggers.filter((_, i) => i !== index))
  }

  function updateTrigger(index: number, partial: Partial<TriggerConfig>) {
    setTriggers(triggers.map((t, i) => (i === index ? { ...t, ...partial } : t)))
  }

  function updateBudget(partial: Partial<BudgetConfig>) {
    setBudget({ ...budget, ...partial })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowSettings(false)}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[520px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Workflow Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            x
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* ── Defaults ──────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Defaults</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default Retries</label>
                <input
                  type="number" min={0}
                  value={defaultRetries}
                  onChange={(e) => setDefaultRetries(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default Timeout (ms)</label>
                <input
                  type="number" min={0} step={1000}
                  value={defaultTimeoutMs}
                  onChange={(e) => setDefaultTimeoutMs(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Fail Fast</label>
              <button
                onClick={() => setFailFast(!failFast)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  failFast ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  failFast ? 'translate-x-4.5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">If enabled, workflow fails immediately when any step fails</p>
          </section>

          {/* ── Triggers ──────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Triggers</h3>
              <button
                onClick={addTrigger}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Trigger
              </button>
            </div>

            {triggers.length === 0 && (
              <p className="text-xs text-gray-400">No triggers configured. Workflow will only start manually.</p>
            )}

            {triggers.map((trigger, i) => (
              <div key={i} className="flex items-start gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 flex flex-col gap-2">
                  <select
                    value={trigger.type}
                    onChange={(e) => updateTrigger(i, { type: e.target.value as 'event' | 'manual' })}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="event">Event</option>
                    <option value="manual">Manual</option>
                  </select>
                  {trigger.type === 'event' && (
                    <input
                      type="text"
                      value={trigger.eventType ?? ''}
                      onChange={(e) => updateTrigger(i, { eventType: e.target.value })}
                      className="border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., github.pr.opened, cron.trigger"
                    />
                  )}
                </div>
                <button
                  onClick={() => removeTrigger(i)}
                  className="text-xs text-red-400 hover:text-red-600 mt-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          {/* ── Budget Guardrails ─────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Budget Guardrails</h3>
            <p className="text-[11px] text-gray-400 mb-3">Set limits to prevent runaway execution. Leave empty for no limit.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Tokens</label>
                <input
                  type="number" min={0}
                  value={budget.maxTokens ?? ''}
                  onChange={(e) => updateBudget({ maxTokens: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Cost (USD)</label>
                <input
                  type="number" min={0} step={0.01}
                  value={budget.maxCostUsd ?? ''}
                  onChange={(e) => updateBudget({ maxCostUsd: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Steps</label>
                <input
                  type="number" min={0}
                  value={budget.maxSteps ?? ''}
                  onChange={(e) => updateBudget({ maxSteps: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Task Executions</label>
                <input
                  type="number" min={0}
                  value={budget.maxTaskExecutions ?? ''}
                  onChange={(e) => updateBudget({ maxTaskExecutions: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="No limit"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
