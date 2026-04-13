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

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-gray-100 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
      >
        {title}
        <span className="text-gray-400">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  )
}

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
      <div className="w-[350px] border-l border-gray-200 bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Select a step to configure</p>
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
    <div className="w-[350px] border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Step Configuration</h3>
        <button
          onClick={() => removeStep(selectedNodeId)}
          className="text-xs text-red-500 hover:text-red-700 font-medium"
        >
          Delete Step
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* ── Basic Section ────────────────────────────────── */}
        <Section title="Basic" defaultOpen={true}>
          {/* Step Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Step Name</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="step_name"
            />
          </div>

          {/* Executor Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Executor Type</label>
            <select
              value={config.executorType}
              onChange={(e) => handleExecutorTypeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Inner Executor</label>
                <select
                  value={(config.executorConfig.executor as string) || 'function'}
                  onChange={(e) => handleTaskRunnerConfigChange('executor', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {INNER_EXECUTOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Executor used for each individual task</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Concurrent Tasks</label>
                <input
                  type="number"
                  min={1}
                  value={(config.executorConfig.maxConcurrentTasks as number) || 5}
                  onChange={(e) => handleTaskRunnerConfigChange('maxConcurrentTasks', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Handler Name</label>
                <input
                  type="text"
                  value={(config.executorConfig.handler as string) || ''}
                  onChange={(e) => handleTaskRunnerConfigChange('handler', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="handler_name"
                />
              </div>
            </>
          ) : (
            /* Executor Config (JSON) for non-task_runner */
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Executor Config (JSON)</label>
              <textarea
                value={localConfigJson}
                onChange={(e) => handleConfigJsonChange(e.target.value)}
                rows={4}
                className={`w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:border-transparent resize-y ${
                  jsonError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="{}"
              />
              {jsonError && <p className="text-xs text-red-500 mt-1">{jsonError}</p>}
            </div>
          )}

          {/* Human Approval Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">Requires Human Approval</label>
            <button
              onClick={() => handleBooleanFieldChange('requiresHumanApproval', !config.requiresHumanApproval)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                config.requiresHumanApproval ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                config.requiresHumanApproval ? 'translate-x-4.5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </Section>

        {/* ── Execution Section ────────────────────────────── */}
        <Section title="Execution" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Retries</label>
              <input
                type="number" min={0} value={config.retries}
                onChange={(e) => handleNumberChange('retries', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Timeout (ms)</label>
              <input
                type="number" min={0} step={1000} value={config.timeoutMs}
                onChange={(e) => handleNumberChange('timeoutMs', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Step Weight</label>
              <select
                value={config.weight}
                onChange={(e) => handleWeightChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {STEP_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Iterations</label>
              <input
                type="number" min={1} value={config.maxIterations}
                onChange={(e) => handleNumberChange('maxIterations', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Next Step */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Next Step (loop-back)</label>
            <select
              value={config.nextStep ?? ''}
              onChange={(e) => handleNextStepChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">None</option>
              {otherSteps.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Dashed edge for iterative transitions</p>
          </div>
        </Section>

        {/* ── Advanced Section ─────────────────────────────── */}
        <Section title="Advanced" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heartbeat Timeout</label>
              <input
                type="number" min={0} step={1000}
                value={config.heartbeatTimeoutMs ?? ''}
                onChange={(e) => handleNumberChange('heartbeatTimeoutMs', e.target.value ? Number(e.target.value) : 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ms"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Schedule-to-Start</label>
              <input
                type="number" min={0} step={1000}
                value={config.scheduleToStartTimeoutMs ?? ''}
                onChange={(e) => handleNumberChange('scheduleToStartTimeoutMs', e.target.value ? Number(e.target.value) : 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ms"
              />
            </div>
          </div>

          {/* Condition Expression */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
            <textarea
              value={config.conditionExpression ?? ''}
              onChange={(e) => handleStringFieldChange('conditionExpression', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              placeholder="ctx.completedOutputs.step_a.score > 0.8"
            />
            <p className="text-[11px] text-gray-400 mt-1">JS expression with ctx in scope. Step runs only if truthy.</p>
          </div>

          {/* Map Input Expression */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Map Input</label>
            <textarea
              value={config.mapInputExpression ?? ''}
              onChange={(e) => handleStringFieldChange('mapInputExpression', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              placeholder="{ fromA: upstream.step_a.result }"
            />
            <p className="text-[11px] text-gray-400 mt-1">Transform upstream outputs into this step's input.</p>
          </div>
        </Section>
      </div>
    </div>
  )
}
