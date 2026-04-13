import { useState, useEffect, useCallback } from 'react'
import type { StepConfig, ExecutorType, StepWeight, WorkflowEditorState } from './useWorkflowEditor'

interface StepConfigPanelProps {
  editor: WorkflowEditorState
}

const EXECUTOR_TYPES: { value: ExecutorType; label: string }[] = [
  { value: 'function', label: 'Function' },
  { value: 'ai', label: 'AI' },
  { value: 'sandbox', label: 'Sandbox' },
  { value: 'human', label: 'Human Approval' },
  { value: 'task_runner', label: 'Task Runner' },
]

const INNER_EXECUTOR_TYPES: { value: string; label: string }[] = [
  { value: 'function', label: 'Function' },
  { value: 'ai', label: 'AI' },
  { value: 'sandbox', label: 'Sandbox' },
]

const STEP_WEIGHTS: { value: StepWeight; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'ai', label: 'AI' },
  { value: 'sandbox', label: 'Sandbox' },
]

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

/* ── Collapsible section ─────────────────────────────────────── */

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--color-border, rgba(255,255,255,0.08))' }} className="pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider mb-2"
        style={sectionHeaderStyle}
      >
        {title}
        <span style={{ color: 'var(--color-text-muted, #55556a)' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export function StepConfigPanel({ editor }: StepConfigPanelProps) {
  const { selectedNodeId, getStepConfig, updateStep, removeStep, getStepConfigs } = editor
  const config = selectedNodeId ? getStepConfig(selectedNodeId) : undefined

  const [localName, setLocalName] = useState('')
  const [localConfigJson, setLocalConfigJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setLocalName(config.name)
      if (config.executorType !== 'task_runner') {
        setLocalConfigJson(JSON.stringify(config.executorConfig, null, 2))
      }
      setJsonError(null)
    }
  }, [selectedNodeId, config])

  const handleNameChange = useCallback(
    (value: string) => {
      setLocalName(value)
      if (selectedNodeId) updateStep(selectedNodeId, { name: value })
    },
    [selectedNodeId, updateStep],
  )

  const handleExecutorTypeChange = useCallback(
    (value: string) => {
      if (selectedNodeId) {
        const updates: Partial<StepConfig> = { executorType: value as ExecutorType }
        if (value === 'task_runner') {
          updates.executorConfig = { executor: 'function', maxConcurrentTasks: 5 }
        } else if (value === 'human') {
          updates.requiresHumanApproval = true
        }
        updateStep(selectedNodeId, updates)
      }
    },
    [selectedNodeId, updateStep],
  )

  const handleConfigJsonChange = useCallback(
    (value: string) => {
      setLocalConfigJson(value)
      try {
        const parsed = JSON.parse(value)
        setJsonError(null)
        if (selectedNodeId) updateStep(selectedNodeId, { executorConfig: parsed })
      } catch {
        setJsonError('Invalid JSON')
      }
    },
    [selectedNodeId, updateStep],
  )

  const handleNumberChange = useCallback(
    (field: keyof StepConfig, value: number) => {
      if (selectedNodeId) updateStep(selectedNodeId, { [field]: value } as Partial<StepConfig>)
    },
    [selectedNodeId, updateStep],
  )

  const handleWeightChange = useCallback(
    (value: string) => {
      if (selectedNodeId) updateStep(selectedNodeId, { weight: value as StepWeight })
    },
    [selectedNodeId, updateStep],
  )

  const handleNextStepChange = useCallback(
    (value: string) => {
      if (!selectedNodeId) return
      if (value === '') {
        const currentConfig = getStepConfig(selectedNodeId)
        if (currentConfig?.nextStep) {
          editor.removeEdge(`next-${selectedNodeId}-${currentConfig.nextStep}`)
        }
        updateStep(selectedNodeId, { nextStep: undefined })
      } else {
        const currentConfig = getStepConfig(selectedNodeId)
        if (currentConfig?.nextStep) {
          editor.removeEdge(`next-${selectedNodeId}-${currentConfig.nextStep}`)
        }
        editor.addNextStepEdge(selectedNodeId, value)
      }
    },
    [selectedNodeId, getStepConfig, updateStep, editor],
  )

  const handleTaskRunnerConfigChange = useCallback(
    (field: string, value: string | number) => {
      if (!selectedNodeId || !config) return
      const newConfig = { ...config.executorConfig, [field]: value }
      updateStep(selectedNodeId, { executorConfig: newConfig })
    },
    [selectedNodeId, config, updateStep],
  )

  const handleStringFieldChange = useCallback(
    (field: keyof StepConfig, value: string) => {
      if (selectedNodeId) updateStep(selectedNodeId, { [field]: value || undefined } as Partial<StepConfig>)
    },
    [selectedNodeId, updateStep],
  )

  const handleBooleanFieldChange = useCallback(
    (field: keyof StepConfig, value: boolean) => {
      if (selectedNodeId) updateStep(selectedNodeId, { [field]: value } as Partial<StepConfig>)
    },
    [selectedNodeId, updateStep],
  )

  if (!selectedNodeId || !config) {
    return (
      <div
        className="w-[350px] flex items-center justify-center"
        style={{
          background: 'var(--color-surface-1, #12121a)',
          borderLeft: '1px solid var(--color-border, rgba(255,255,255,0.08))',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-muted, #55556a)' }}>Select a step to configure</p>
      </div>
    )
  }

  // Build list of other steps for nextStep dropdown
  const otherSteps: { id: string; name: string }[] = []
  for (const [id, cfg] of getStepConfigs()) {
    if (id !== selectedNodeId) {
      otherSteps.push({ id, name: cfg.name })
    }
  }

  return (
    <div
      className="w-[350px] flex flex-col overflow-y-auto"
      style={{
        background: 'var(--color-surface-1, #12121a)',
        borderLeft: '1px solid var(--color-border, rgba(255,255,255,0.08))',
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))' }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary, #f0f0f5)' }}
        >
          Step Configuration
        </h3>
        <button
          onClick={() => removeStep(selectedNodeId)}
          className="text-xs text-red-400 hover:text-red-300 font-medium"
        >
          Delete Step
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* ── Basic Section ────────────────────────────────── */}
        <Section title="Basic" defaultOpen={true}>
          {/* Step Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Step Name</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
              style={inputStyle}
              placeholder="step_name"
            />
          </div>

          {/* Executor Type */}
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Executor Type</label>
            <select
              value={config.executorType}
              onChange={(e) => handleExecutorTypeChange(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
              style={inputStyle}
            >
              {EXECUTOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Task Runner structured config */}
          {config.executorType === 'task_runner' ? (
            <>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Inner Executor</label>
                <select
                  value={(config.executorConfig.executor as string) || 'function'}
                  onChange={(e) => handleTaskRunnerConfigChange('executor', e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                >
                  {INNER_EXECUTOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-[11px] mt-1" style={hintStyle}>Executor used for each individual task</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Max Concurrent Tasks</label>
                <input
                  type="number"
                  min={1}
                  value={(config.executorConfig.maxConcurrentTasks as number) || 5}
                  onChange={(e) => handleTaskRunnerConfigChange('maxConcurrentTasks', Number(e.target.value))}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Handler Name</label>
                <input
                  type="text"
                  value={(config.executorConfig.handler as string) || ''}
                  onChange={(e) => handleTaskRunnerConfigChange('handler', e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                  style={inputStyle}
                  placeholder="handler_name"
                />
              </div>
            </>
          ) : (
            /* Executor Config (JSON) for non-task_runner */
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Executor Config (JSON)</label>
              <textarea
                value={localConfigJson}
                onChange={(e) => handleConfigJsonChange(e.target.value)}
                rows={4}
                className="w-full rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:border-transparent resize-y"
                style={{
                  ...inputStyle,
                  borderColor: jsonError ? '#f87171' : undefined,
                }}
                placeholder="{}"
              />
              {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
            </div>
          )}

          {/* Human Approval Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={labelStyle}>Requires Human Approval</label>
            <button
              onClick={() => handleBooleanFieldChange('requiresHumanApproval', !config.requiresHumanApproval)}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                background: config.requiresHumanApproval
                  ? 'var(--color-accent, #6366f1)'
                  : 'var(--color-surface-4, #2a2a38)',
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                style={{
                  transform: config.requiresHumanApproval ? 'translateX(18px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </Section>

        {/* ── Execution Section ────────────────────────────── */}
        <Section title="Execution" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Retries</label>
              <input
                type="number" min={0} value={config.retries}
                onChange={(e) => handleNumberChange('retries', Number(e.target.value))}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Timeout (ms)</label>
              <input
                type="number" min={0} step={1000} value={config.timeoutMs}
                onChange={(e) => handleNumberChange('timeoutMs', Number(e.target.value))}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Step Weight</label>
              <select
                value={config.weight}
                onChange={(e) => handleWeightChange(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                style={inputStyle}
              >
                {STEP_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Max Iterations</label>
              <input
                type="number" min={1} value={config.maxIterations}
                onChange={(e) => handleNumberChange('maxIterations', Number(e.target.value))}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Next Step */}
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Next Step (loop-back)</label>
            <select
              value={config.nextStep ?? ''}
              onChange={(e) => handleNextStepChange(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
              style={inputStyle}
            >
              <option value="">None</option>
              {otherSteps.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-[11px] mt-1" style={hintStyle}>Dashed edge for iterative transitions</p>
          </div>
        </Section>

        {/* ── Advanced Section ─────────────────────────────── */}
        <Section title="Advanced" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Heartbeat Timeout</label>
              <input
                type="number" min={0} step={1000}
                value={config.heartbeatTimeoutMs ?? ''}
                onChange={(e) => handleNumberChange('heartbeatTimeoutMs', e.target.value ? Number(e.target.value) : 0)}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                style={inputStyle}
                placeholder="ms"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>Schedule-to-Start</label>
              <input
                type="number" min={0} step={1000}
                value={config.scheduleToStartTimeoutMs ?? ''}
                onChange={(e) => handleNumberChange('scheduleToStartTimeoutMs', e.target.value ? Number(e.target.value) : 0)}
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
                style={inputStyle}
                placeholder="ms"
              />
            </div>
          </div>

          {/* Condition Expression */}
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Condition</label>
            <textarea
              value={config.conditionExpression ?? ''}
              onChange={(e) => handleStringFieldChange('conditionExpression', e.target.value)}
              rows={2}
              className="w-full rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent resize-y"
              style={inputStyle}
              placeholder="ctx.completedOutputs.step_a.score > 0.8"
            />
            <p className="text-[11px] mt-1" style={hintStyle}>JS expression with ctx in scope. Step runs only if truthy.</p>
          </div>

          {/* Map Input Expression */}
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>Map Input</label>
            <textarea
              value={config.mapInputExpression ?? ''}
              onChange={(e) => handleStringFieldChange('mapInputExpression', e.target.value)}
              rows={2}
              className="w-full rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent resize-y"
              style={inputStyle}
              placeholder="{ fromA: upstream.step_a.result }"
            />
            <p className="text-[11px] mt-1" style={hintStyle}>Transform upstream outputs into this step's input.</p>
          </div>
        </Section>
      </div>
    </div>
  )
}
