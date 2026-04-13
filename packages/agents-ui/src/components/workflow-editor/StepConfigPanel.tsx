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
]

const STEP_WEIGHTS: { value: StepWeight; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'ai', label: 'AI' },
  { value: 'sandbox', label: 'Sandbox' },
]

export function StepConfigPanel({ editor }: StepConfigPanelProps) {
  const { selectedNodeId, getStepConfig, updateStep, removeStep, getStepConfigs } = editor
  const config = selectedNodeId ? getStepConfig(selectedNodeId) : undefined

  const [localName, setLocalName] = useState('')
  const [localConfigJson, setLocalConfigJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setLocalName(config.name)
      setLocalConfigJson(JSON.stringify(config.executorConfig, null, 2))
      setJsonError(null)
    }
  }, [selectedNodeId, config])

  const handleNameChange = useCallback(
    (value: string) => {
      setLocalName(value)
      if (selectedNodeId) {
        updateStep(selectedNodeId, { name: value })
      }
    },
    [selectedNodeId, updateStep],
  )

  const handleExecutorTypeChange = useCallback(
    (value: string) => {
      if (selectedNodeId) {
        updateStep(selectedNodeId, { executorType: value as ExecutorType })
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
        if (selectedNodeId) {
          updateStep(selectedNodeId, { executorConfig: parsed })
        }
      } catch {
        setJsonError('Invalid JSON')
      }
    },
    [selectedNodeId, updateStep],
  )

  const handleRetriesChange = useCallback(
    (value: number) => {
      if (selectedNodeId) updateStep(selectedNodeId, { retries: value })
    },
    [selectedNodeId, updateStep],
  )

  const handleTimeoutChange = useCallback(
    (value: number) => {
      if (selectedNodeId) updateStep(selectedNodeId, { timeoutMs: value })
    },
    [selectedNodeId, updateStep],
  )

  const handleWeightChange = useCallback(
    (value: string) => {
      if (selectedNodeId) updateStep(selectedNodeId, { weight: value as StepWeight })
    },
    [selectedNodeId, updateStep],
  )

  const handleMaxIterationsChange = useCallback(
    (value: number) => {
      if (selectedNodeId) updateStep(selectedNodeId, { maxIterations: value })
    },
    [selectedNodeId, updateStep],
  )

  const handleNextStepChange = useCallback(
    (value: string) => {
      if (!selectedNodeId) return
      if (value === '') {
        // Remove existing nextStep edge
        const currentConfig = getStepConfig(selectedNodeId)
        if (currentConfig?.nextStep) {
          editor.removeEdge(`next-${selectedNodeId}-${currentConfig.nextStep}`)
        }
        updateStep(selectedNodeId, { nextStep: undefined })
      } else {
        // Remove old nextStep edge if any
        const currentConfig = getStepConfig(selectedNodeId)
        if (currentConfig?.nextStep) {
          editor.removeEdge(`next-${selectedNodeId}-${currentConfig.nextStep}`)
        }
        editor.addNextStepEdge(selectedNodeId, value)
      }
    },
    [selectedNodeId, getStepConfig, updateStep, editor],
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

      <div className="flex flex-col gap-4 p-4">
        {/* Step Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Step Name
          </label>
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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Executor Type
          </label>
          <select
            value={config.executorType}
            onChange={(e) => handleExecutorTypeChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {EXECUTOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Executor Config (JSON) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Executor Config (JSON)
          </label>
          <textarea
            value={localConfigJson}
            onChange={(e) => handleConfigJsonChange(e.target.value)}
            rows={5}
            className={`w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:border-transparent resize-y ${
              jsonError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            placeholder="{}"
          />
          {jsonError && (
            <p className="text-xs text-red-500 mt-1">{jsonError}</p>
          )}
        </div>

        {/* Retries */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Retries
          </label>
          <input
            type="number"
            min={0}
            value={config.retries}
            onChange={(e) => handleRetriesChange(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Timeout */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Timeout (ms)
          </label>
          <input
            type="number"
            min={0}
            step={1000}
            value={config.timeoutMs}
            onChange={(e) => handleTimeoutChange(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Step Weight */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Step Weight
          </label>
          <select
            value={config.weight}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {STEP_WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        {/* Max Iterations */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Max Iterations
          </label>
          <input
            type="number"
            min={1}
            value={config.maxIterations}
            onChange={(e) => handleMaxIterationsChange(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            For nextStep loop-back transitions
          </p>
        </div>

        {/* Next Step */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Next Step (loop-back)
          </label>
          <select
            value={config.nextStep ?? ''}
            onChange={(e) => handleNextStepChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">None</option>
            {otherSteps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            Dashed edge for iterative transitions
          </p>
        </div>
      </div>
    </div>
  )
}
