import { useState, useEffect, useCallback } from 'react'
import type { StepConfig, ExecutorType, StepWeight, WorkflowEditorState } from './useWorkflowEditor'

interface StepConfigPanelProps {
  editor: WorkflowEditorState
}

const EXECUTOR_TYPES: { value: ExecutorType; label: string }[] = [
  { value: 'function', label: 'Function' },
  { value: 'ai', label: 'AI / LLM' },
  { value: 'claude_code', label: 'Claude Code' },
  { value: 'sandbox', label: 'Docker Sandbox' },
  { value: 'human', label: 'Human Review' },
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

const GITHUB_ACTIONS = ['create_pr', 'create_issue', 'add_comment', 'merge_pr']
const LINEAR_ACTIONS = ['create_issue', 'update_issue', 'add_comment']
const SLACK_ACTIONS = ['send_message', 'update_message']

const inputCls = "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface-3)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
}
const labelCls = "block text-[10px] font-medium uppercase tracking-wider mb-1.5"
const labelStyle: React.CSSProperties = { color: 'var(--color-text-muted)' }
const hintStyle: React.CSSProperties = { color: 'var(--color-text-muted)' }

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active
          ? 'bg-[var(--color-accent)] text-white'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
      }`}
    >
      {label}
    </button>
  )
}

export function StepConfigPanel({ editor }: StepConfigPanelProps) {
  const { selectedNodeId, getStepConfig, updateStep, removeStep, getStepConfigs } = editor
  const config = selectedNodeId ? getStepConfig(selectedNodeId) : undefined

  const [tab, setTab] = useState<'params' | 'settings' | 'advanced'>('params')
  const [localName, setLocalName] = useState('')
  const [localConfigJson, setLocalConfigJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setLocalName(config.name)
      setLocalConfigJson(JSON.stringify(config.executorConfig, null, 2))
      setJsonError(null)
      setTab('params')
    }
  }, [selectedNodeId])

  const handleNameChange = useCallback((value: string) => {
    setLocalName(value)
    if (selectedNodeId) updateStep(selectedNodeId, { name: value })
  }, [selectedNodeId, updateStep])

  const handleExecutorTypeChange = useCallback((value: string) => {
    if (selectedNodeId) {
      const updates: Partial<StepConfig> = { executorType: value as ExecutorType }
      if (value === 'task_runner') updates.executorConfig = { executor: 'function', maxConcurrentTasks: 5 }
      else if (value === 'human') updates.requiresHumanApproval = true
      updateStep(selectedNodeId, updates)
    }
  }, [selectedNodeId, updateStep])

  const handleConfigJsonChange = useCallback((value: string) => {
    setLocalConfigJson(value)
    try {
      const parsed = JSON.parse(value)
      setJsonError(null)
      if (selectedNodeId) updateStep(selectedNodeId, { executorConfig: parsed })
    } catch { setJsonError('Invalid JSON') }
  }, [selectedNodeId, updateStep])

  const setConfigField = useCallback((field: string, value: unknown) => {
    if (!selectedNodeId || !config) return
    const newConfig = { ...config.executorConfig, [field]: value }
    updateStep(selectedNodeId, { executorConfig: newConfig })
  }, [selectedNodeId, config, updateStep])

  const setField = useCallback((field: keyof StepConfig, value: unknown) => {
    if (selectedNodeId) updateStep(selectedNodeId, { [field]: value } as Partial<StepConfig>)
  }, [selectedNodeId, updateStep])

  const handleNextStepChange = useCallback((value: string) => {
    if (!selectedNodeId) return
    if (value === '') {
      const currentConfig = getStepConfig(selectedNodeId)
      if (currentConfig?.nextStep) editor.removeEdge(`next-${selectedNodeId}-${currentConfig.nextStep}`)
      updateStep(selectedNodeId, { nextStep: undefined })
    } else {
      const currentConfig = getStepConfig(selectedNodeId)
      if (currentConfig?.nextStep) editor.removeEdge(`next-${selectedNodeId}-${currentConfig.nextStep}`)
      editor.addNextStepEdge(selectedNodeId, value)
    }
  }, [selectedNodeId, getStepConfig, updateStep, editor])

  if (!selectedNodeId || !config) {
    return (
      <div className="w-[320px] flex items-center justify-center" style={{ background: 'var(--color-surface-1)', borderLeft: '1px solid var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Select a step to configure</p>
      </div>
    )
  }

  const otherSteps: { id: string; name: string }[] = []
  for (const [id, cfg] of getStepConfigs()) {
    if (id !== selectedNodeId) otherSteps.push({ id, name: cfg.name })
  }

  const provider = config.executorConfig.provider as string | undefined
  const isIntegration = provider === 'github' || provider === 'linear' || provider === 'slack'
  const isSkill = Array.isArray(config.executorConfig.skills)

  return (
    <div className="w-[320px] flex flex-col overflow-y-auto" style={{ background: 'var(--color-surface-1)', borderLeft: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="text"
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="text-sm font-semibold bg-transparent border-none outline-none text-[var(--color-text-primary)] w-full truncate"
            placeholder="step_name"
          />
        </div>
        <button onClick={() => removeStep(selectedNodeId)} className="text-xs text-red-400 hover:text-red-300 font-medium shrink-0 ml-2">
          Delete
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 flex gap-1" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <TabButton active={tab === 'params'} label="Parameters" onClick={() => setTab('params')} />
        <TabButton active={tab === 'settings'} label="Settings" onClick={() => setTab('settings')} />
        <TabButton active={tab === 'advanced'} label="Advanced" onClick={() => setTab('advanced')} />
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* ═══════════════ PARAMETERS TAB ═══════════════ */}
        {tab === 'params' && <>
          {/* Executor Type */}
          <div>
            <label className={labelCls} style={labelStyle}>Type</label>
            <select value={config.executorType} onChange={(e) => handleExecutorTypeChange(e.target.value)} className={inputCls} style={inputStyle}>
              {EXECUTOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* ── Task Runner Config ── */}
          {config.executorType === 'task_runner' && <>
            <div>
              <label className={labelCls} style={labelStyle}>Inner Executor</label>
              <select value={(config.executorConfig.executor as string) || 'function'} onChange={(e) => setConfigField('executor', e.target.value)} className={inputCls} style={inputStyle}>
                {INNER_EXECUTOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Max Concurrent Tasks</label>
              <input type="number" min={1} value={(config.executorConfig.maxConcurrentTasks as number) || 5} onChange={(e) => setConfigField('maxConcurrentTasks', Number(e.target.value))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Handler</label>
              <input type="text" value={(config.executorConfig.handler as string) || ''} onChange={(e) => setConfigField('handler', e.target.value)} className={inputCls} style={inputStyle} placeholder="handler_name" />
            </div>
          </>}

          {/* ── GitHub Integration ── */}
          {isIntegration && provider === 'github' && <>
            <div>
              <label className={labelCls} style={labelStyle}>GitHub Action</label>
              <select value={(config.executorConfig.actionType as string) || 'create_pr'} onChange={(e) => setConfigField('actionType', e.target.value)} className={inputCls} style={inputStyle}>
                {GITHUB_ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Repository</label>
              <input type="text" value={(config.executorConfig.repo as string) || ''} onChange={(e) => setConfigField('repo', e.target.value)} className={inputCls} style={inputStyle} placeholder="owner/repo" />
            </div>
          </>}

          {/* ── Linear Integration ── */}
          {isIntegration && provider === 'linear' && <>
            <div>
              <label className={labelCls} style={labelStyle}>Linear Action</label>
              <select value={(config.executorConfig.actionType as string) || 'create_issue'} onChange={(e) => setConfigField('actionType', e.target.value)} className={inputCls} style={inputStyle}>
                {LINEAR_ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Team ID</label>
              <input type="text" value={(config.executorConfig.teamId as string) || ''} onChange={(e) => setConfigField('teamId', e.target.value)} className={inputCls} style={inputStyle} placeholder="TEAM-123" />
            </div>
          </>}

          {/* ── Slack Integration ── */}
          {isIntegration && provider === 'slack' && <>
            <div>
              <label className={labelCls} style={labelStyle}>Slack Action</label>
              <select value={(config.executorConfig.actionType as string) || 'send_message'} onChange={(e) => setConfigField('actionType', e.target.value)} className={inputCls} style={inputStyle}>
                {SLACK_ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Channel</label>
              <input type="text" value={(config.executorConfig.channel as string) || ''} onChange={(e) => setConfigField('channel', e.target.value)} className={inputCls} style={inputStyle} placeholder="#general" />
            </div>
          </>}

          {/* ── AI / LLM Config ── */}
          {config.executorType === 'ai' && !isIntegration && !isSkill && <>
            <div>
              <label className={labelCls} style={labelStyle}>Model</label>
              <select value={(config.executorConfig.model as string) || ''} onChange={(e) => setConfigField('model', e.target.value)} className={inputCls} style={inputStyle}>
                <option value="">Default</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>System Prompt</label>
              <textarea value={(config.executorConfig.systemPrompt as string) || ''} onChange={(e) => setConfigField('systemPrompt', e.target.value)} rows={3} className={inputCls + ' font-mono resize-y'} style={inputStyle} placeholder="You are a helpful assistant..." />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Temperature</label>
              <input type="number" min={0} max={2} step={0.1} value={(config.executorConfig.temperature as number) ?? 0.7} onChange={(e) => setConfigField('temperature', Number(e.target.value))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Max Tokens</label>
              <input type="number" min={1} value={(config.executorConfig.maxTokens as number) || ''} onChange={(e) => setConfigField('maxTokens', e.target.value ? Number(e.target.value) : undefined)} className={inputCls} style={inputStyle} placeholder="Auto" />
            </div>
          </>}

          {/* ── Skills Config ── */}
          {isSkill && <>
            <div>
              <label className={labelCls} style={labelStyle}>Skills</label>
              <p className="text-[10px] mb-2" style={hintStyle}>AI tools available during execution</p>
              {['webSearch', 'codeExecution'].map(skill => {
                const skills = (config.executorConfig.skills as string[]) || []
                const active = skills.includes(skill)
                return (
                  <label key={skill} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                    <input
                      type="checkbox" checked={active}
                      onChange={() => {
                        const next = active ? skills.filter(s => s !== skill) : [...skills, skill]
                        setConfigField('skills', next)
                      }}
                      className="rounded"
                    />
                    <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
                      {skill === 'webSearch' ? 'Web Search' : 'Code Execution'}
                    </span>
                  </label>
                )
              })}
            </div>
          </>}

          {/* ── Claude Code Config ── */}
          {config.executorType === 'claude_code' && <>
            <div>
              <label className={labelCls} style={labelStyle}>Prompt</label>
              <textarea
                value={(config.executorConfig.prompt as string) || ''}
                onChange={(e) => setConfigField('prompt', e.target.value)}
                rows={4}
                className={inputCls + ' font-mono resize-y'}
                style={inputStyle}
                placeholder="Analyze this code and suggest improvements..."
              />
              <p className="text-[10px] mt-1" style={hintStyle}>Use {'{{input.fieldName}}'} for template variables</p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>System Prompt</label>
              <textarea
                value={(config.executorConfig.appendSystemPrompt as string) || ''}
                onChange={(e) => setConfigField('appendSystemPrompt', e.target.value)}
                rows={2}
                className={inputCls + ' font-mono resize-y'}
                style={inputStyle}
                placeholder="You are a senior engineer..."
              />
              <p className="text-[10px] mt-1" style={hintStyle}>Appended to Claude Code defaults</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Model</label>
                <select value={(config.executorConfig.model as string) || ''} onChange={(e) => setConfigField('model', e.target.value || undefined)} className={inputCls} style={inputStyle}>
                  <option value="">Default</option>
                  <option value="sonnet">Sonnet (latest)</option>
                  <option value="opus">Opus (latest)</option>
                  <option value="haiku">Haiku (latest)</option>
                  <option value="claude-sonnet-4-20250514">Sonnet 4</option>
                  <option value="claude-opus-4-20250514">Opus 4</option>
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Effort</label>
                <select value={(config.executorConfig.effort as string) || ''} onChange={(e) => setConfigField('effort', e.target.value || undefined)} className={inputCls} style={inputStyle}>
                  <option value="">Default</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="max">Max</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Output Format</label>
                <select value={(config.executorConfig.outputFormat as string) || 'text'} onChange={(e) => setConfigField('outputFormat', e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="stream-json">Stream JSON</option>
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Max Turns</label>
                <input type="number" min={1} value={(config.executorConfig.maxTurns as number) || 1} onChange={(e) => setConfigField('maxTurns', Number(e.target.value))} className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Budget (USD)</label>
                <input type="number" min={0} step={0.01} value={(config.executorConfig.maxBudgetUsd as number) || ''} onChange={(e) => setConfigField('maxBudgetUsd', e.target.value ? Number(e.target.value) : undefined)} className={inputCls} style={inputStyle} placeholder="No limit" />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Timeout (ms)</label>
                <input type="number" min={0} step={1000} value={(config.executorConfig.timeoutMs as number) || ''} onChange={(e) => setConfigField('timeoutMs', e.target.value ? Number(e.target.value) : undefined)} className={inputCls} style={inputStyle} placeholder="300000" />
              </div>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Permissions</label>
              <select value={(config.executorConfig.permissionMode as string) || 'default'} onChange={(e) => setConfigField('permissionMode', e.target.value)} className={inputCls} style={inputStyle}>
                <option value="default">Default (ask)</option>
                <option value="acceptEdits">Accept Edits</option>
                <option value="plan">Plan Only</option>
                <option value="bypassPermissions">Bypass All (sandbox only)</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Allowed Tools</label>
              <input
                type="text"
                value={(config.executorConfig.allowedTools as string[] || []).join(', ')}
                onChange={(e) => setConfigField('allowedTools', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className={inputCls}
                style={inputStyle}
                placeholder="Bash, Read, Edit, Glob, Grep"
              />
              <p className="text-[10px] mt-1" style={hintStyle}>Comma-separated. Leave empty for all tools.</p>
            </div>
            <details className="mt-1">
              <summary className="text-[10px] cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>More options</summary>
              <div className="flex flex-col gap-3 mt-2">
                <div>
                  <label className={labelCls} style={labelStyle}>Fallback Model</label>
                  <input type="text" value={(config.executorConfig.fallbackModel as string) || ''} onChange={(e) => setConfigField('fallbackModel', e.target.value || undefined)} className={inputCls} style={inputStyle} placeholder="sonnet" />
                  <p className="text-[10px] mt-1" style={hintStyle}>Used when primary model is overloaded</p>
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Working Directory</label>
                  <input type="text" value={(config.executorConfig.cwd as string) || ''} onChange={(e) => setConfigField('cwd', e.target.value || undefined)} className={inputCls} style={inputStyle} placeholder="/path/to/project" />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>JSON Schema</label>
                  <textarea value={(config.executorConfig.jsonSchema as string) || ''} onChange={(e) => setConfigField('jsonSchema', e.target.value || undefined)} rows={2} className={inputCls + ' font-mono resize-y text-xs'} style={inputStyle} placeholder='{"type":"object","properties":{"name":{"type":"string"}}}' />
                  <p className="text-[10px] mt-1" style={hintStyle}>Validates structured output</p>
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>MCP Config</label>
                  <input type="text" value={(config.executorConfig.mcpConfig as string) || ''} onChange={(e) => setConfigField('mcpConfig', e.target.value || undefined)} className={inputCls} style={inputStyle} placeholder="path/to/mcp.json" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={labelStyle}>Streaming Events</label>
                  <button
                    onClick={() => setConfigField('streaming', !(config.executorConfig.streaming as boolean))}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                    style={{ background: config.executorConfig.streaming ? 'var(--color-accent)' : 'var(--color-surface-4)' }}
                  >
                    <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform" style={{ transform: config.executorConfig.streaming ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                </div>
              </div>
            </details>
            <div className="rounded-xl p-3 mt-1" style={{ background: 'var(--color-surface-3)' }}>
              <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                Runs via <code className="text-[var(--color-accent)]">claude -p</code>. Uses Max/Pro subscription. Worker needs Claude Code installed.
              </p>
            </div>
          </>}

          {/* ── Human Review ── */}
          {config.executorType === 'human' && (
            <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-3)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                This step will pause the workflow until a human approves or provides input via the UI.
              </p>
            </div>
          )}

          {/* ── Generic function / sandbox ── */}
          {config.executorType !== 'task_runner' && config.executorType !== 'human' && !isIntegration && !isSkill && config.executorType !== 'ai' && (
            <div>
              <label className={labelCls} style={labelStyle}>Handler</label>
              <input type="text" value={(config.executorConfig.handler as string) || ''} onChange={(e) => setConfigField('handler', e.target.value)} className={inputCls} style={inputStyle} placeholder="handler_name" />
            </div>
          )}

          {/* ── Raw JSON (collapsible) ── */}
          {config.executorType !== 'human' && (
            <details className="mt-2">
              <summary className="text-[10px] cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>Raw JSON Config</summary>
              <textarea
                value={localConfigJson}
                onChange={(e) => handleConfigJsonChange(e.target.value)}
                rows={4}
                className={inputCls + ' mt-2 font-mono resize-y text-xs'}
                style={{ ...inputStyle, ...(jsonError ? { borderColor: 'rgba(239,68,68,0.5)' } : {}) }}
                placeholder="{}"
              />
              {jsonError && <p className="text-[10px] text-red-400 mt-1">{jsonError}</p>}
            </details>
          )}
        </>}

        {/* ═══════════════ SETTINGS TAB ═══════════════ */}
        {tab === 'settings' && <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Retries</label>
              <input type="number" min={0} value={config.retries} onChange={(e) => setField('retries', Number(e.target.value))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Timeout (ms)</label>
              <input type="number" min={0} step={1000} value={config.timeoutMs} onChange={(e) => setField('timeoutMs', Number(e.target.value))} className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Queue Weight</label>
              <select value={config.weight} onChange={(e) => setField('weight', e.target.value)} className={inputCls} style={inputStyle}>
                {STEP_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Max Iterations</label>
              <input type="number" min={1} value={config.maxIterations} onChange={(e) => setField('maxIterations', Number(e.target.value))} className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Next Step */}
          <div>
            <label className={labelCls} style={labelStyle}>Loop Back To</label>
            <select value={config.nextStep ?? ''} onChange={(e) => handleNextStepChange(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">None</option>
              {otherSteps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-[10px] mt-1" style={hintStyle}>Creates a dashed loop-back edge</p>
          </div>

          {/* Human Approval Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={labelStyle}>Requires Human Approval</label>
            <button
              onClick={() => setField('requiresHumanApproval', !config.requiresHumanApproval)}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{ background: config.requiresHumanApproval ? 'var(--color-accent)' : 'var(--color-surface-4)' }}
            >
              <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform" style={{ transform: config.requiresHumanApproval ? 'translateX(18px)' : 'translateX(2px)' }} />
            </button>
          </div>
        </>}

        {/* ═══════════════ ADVANCED TAB ═══════════════ */}
        {tab === 'advanced' && <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Heartbeat Timeout</label>
              <input type="number" min={0} step={1000} value={config.heartbeatTimeoutMs ?? ''} onChange={(e) => setField('heartbeatTimeoutMs', e.target.value ? Number(e.target.value) : undefined)} className={inputCls} style={inputStyle} placeholder="ms" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Schedule-to-Start</label>
              <input type="number" min={0} step={1000} value={config.scheduleToStartTimeoutMs ?? ''} onChange={(e) => setField('scheduleToStartTimeoutMs', e.target.value ? Number(e.target.value) : undefined)} className={inputCls} style={inputStyle} placeholder="ms" />
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Condition</label>
            <textarea
              value={config.conditionExpression ?? ''} onChange={(e) => setField('conditionExpression', e.target.value || undefined)}
              rows={2} className={inputCls + ' font-mono resize-y text-xs'} style={inputStyle}
              placeholder="ctx.completedOutputs.step_a.score > 0.8"
            />
            <p className="text-[10px] mt-1" style={hintStyle}>JS expression — step runs only if truthy</p>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Map Input</label>
            <textarea
              value={config.mapInputExpression ?? ''} onChange={(e) => setField('mapInputExpression', e.target.value || undefined)}
              rows={2} className={inputCls + ' font-mono resize-y text-xs'} style={inputStyle}
              placeholder="{ fromA: upstream.step_a.result }"
            />
            <p className="text-[10px] mt-1" style={hintStyle}>Transform upstream outputs into this step's input</p>
          </div>
        </>}
      </div>
    </div>
  )
}
