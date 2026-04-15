import type { WorkflowEditorState, TriggerConfig, BudgetConfig } from './useWorkflowEditor'

interface WorkflowSettingsPanelProps {
  editor: WorkflowEditorState
}

/* ── Shared inline style objects ─────────────────────────────── */

const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface-3, #22222f)',
  border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
  color: 'var(--color-text-primary, #f0f0f5)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #55556a)',
}

const hintStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #55556a)',
}

const sectionHeaderStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #55556a)',
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }}
      onClick={() => setShowSettings(false)}
    >
      <div
        className="glass rounded-2xl w-[520px] max-h-[80vh] overflow-y-auto"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))' }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--color-text-primary, #f0f0f5)' }}
          >
            Workflow Settings
          </h2>
          <button
            onClick={() => setShowSettings(false)}
            className="text-lg leading-none transition-colors"
            style={{ color: 'var(--color-text-muted, #55556a)' }}
          >
            x
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* ── Defaults ──────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={sectionHeaderStyle}>Defaults</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Default Retries</label>
                <input
                  type="number" min={0}
                  value={defaultRetries}
                  onChange={(e) => setDefaultRetries(Number(e.target.value))}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Default Timeout (ms)</label>
                <input
                  type="number" min={0} step={1000}
                  value={defaultTimeoutMs}
                  onChange={(e) => setDefaultTimeoutMs(Number(e.target.value))}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <label className="text-xs font-medium" style={labelStyle}>Fail Fast</label>
              <button
                onClick={() => setFailFast(!failFast)}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                style={{
                  background: failFast
                    ? 'var(--color-accent, #6366f1)'
                    : 'var(--color-surface-4, #2a2a38)',
                }}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                  style={{
                    transform: failFast ? 'translateX(18px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
            <p className="text-[11px] mt-1" style={hintStyle}>If enabled, workflow fails immediately when any step fails</p>
          </section>

          {/* ── Triggers ──────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={sectionHeaderStyle}>Triggers</h3>
              <button
                onClick={addTrigger}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--color-accent, #6366f1)' }}
              >
                + Add Trigger
              </button>
            </div>

            {triggers.length === 0 && (
              <p className="text-xs" style={hintStyle}>No triggers configured. Workflow will only start manually.</p>
            )}

            {triggers.map((trigger, i) => (
              <div
                key={i}
                className="flex items-start gap-2 mb-2 p-3 rounded-lg"
                style={{ background: 'var(--color-surface-3, #22222f)' }}
              >
                <div className="flex-1 flex flex-col gap-2">
                  <select
                    value={trigger.type}
                    onChange={(e) => updateTrigger(i, { type: e.target.value as 'event' | 'manual' | 'schedule' })}
                    className="rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)]"
                    style={inputStyle}
                  >
                    <option value="event">Event</option>
                    <option value="schedule">Schedule (Cron)</option>
                    <option value="manual">Manual</option>
                  </select>
                  {trigger.type === 'event' && (
                    <input
                      type="text"
                      value={trigger.eventType ?? ''}
                      onChange={(e) => updateTrigger(i, { eventType: e.target.value })}
                      className="rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)]"
                      style={inputStyle}
                      placeholder="e.g., github.pr.opened"
                    />
                  )}
                  {trigger.type === 'schedule' && (
                    <>
                      <input
                        type="text"
                        value={trigger.cronExpression ?? ''}
                        onChange={(e) => updateTrigger(i, { cronExpression: e.target.value })}
                        className="rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)]"
                        style={inputStyle}
                        placeholder="*/5 * * * *"
                      />
                      <p className="text-[10px]" style={hintStyle}>Cron: min hour dom month dow (e.g., "0 9 * * *" = daily at 9am)</p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => removeTrigger(i)}
                  className="text-xs text-red-400 hover:text-red-300 mt-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          {/* ── Budget Guardrails ─────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={sectionHeaderStyle}>Budget Guardrails</h3>
            <p className="text-[11px] mb-3" style={hintStyle}>Set limits to prevent runaway execution. Leave empty for no limit.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Max Tokens</label>
                <input
                  type="number" min={0}
                  value={budget.maxTokens ?? ''}
                  onChange={(e) => updateBudget({ maxTokens: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Max Cost (USD)</label>
                <input
                  type="number" min={0} step={0.01}
                  value={budget.maxCostUsd ?? ''}
                  onChange={(e) => updateBudget({ maxCostUsd: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Max Steps</label>
                <input
                  type="number" min={0}
                  value={budget.maxSteps ?? ''}
                  onChange={(e) => updateBudget({ maxSteps: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Max Task Executions</label>
                <input
                  type="number" min={0}
                  value={budget.maxTaskExecutions ?? ''}
                  onChange={(e) => updateBudget({ maxTaskExecutions: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
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
