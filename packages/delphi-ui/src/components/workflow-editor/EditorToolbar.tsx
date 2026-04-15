import { useRef, useCallback } from 'react'
import type { WorkflowEditorState, ValidationError } from './useWorkflowEditor'

interface EditorToolbarProps {
  editor: WorkflowEditorState
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const {
    workflowName,
    workflowVersion,
    validationErrors,
    setWorkflowName,
    setWorkflowVersion,
    validate,
    toWorkflowDefinition,
    fromWorkflowDefinition,
    autoLayout,
    clear,
  } = editor

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleValidate = useCallback(() => {
    const errors = validate()
    if (errors.length === 0) {
      alert('Workflow is valid!')
    }
  }, [validate])

  const handleExport = useCallback(() => {
    const def = toWorkflowDefinition()
    const json = JSON.stringify(def, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${def.name}-v${def.version}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [toWorkflowDefinition])

  const handleImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          fromWorkflowDefinition(json)
        } catch {
          alert('Invalid JSON file')
        }
      }
      reader.readAsText(file)

      // Reset so the same file can be re-imported
      event.target.value = ''
    },
    [fromWorkflowDefinition],
  )

  const handleClear = useCallback(() => {
    if (confirm('Clear the entire workflow? This cannot be undone.')) {
      clear()
    }
  }, [clear])

  const errorCount = validationErrors.filter((e: ValidationError) => e.type === 'error').length
  const warningCount = validationErrors.filter((e: ValidationError) => e.type === 'warning').length

  return (
    <div
      className="px-4 py-2 flex items-center gap-4 flex-wrap"
      style={{
        background: 'var(--color-surface-1, #12121a)',
        borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))',
      }}
    >
      {/* Workflow Name */}
      <div className="flex items-center gap-2">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--color-text-muted, #55556a)' }}
        >
          Name
        </label>
        <input
          type="text"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
          style={{
            background: 'var(--color-surface-3, #22222f)',
            border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
            color: 'var(--color-text-primary, #f0f0f5)',
          }}
          placeholder="workflow-name"
        />
      </div>

      {/* Version */}
      <div className="flex items-center gap-2">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--color-text-muted, #55556a)' }}
        >
          Version
        </label>
        <input
          type="text"
          value={workflowVersion}
          onChange={(e) => setWorkflowVersion(e.target.value)}
          className="rounded-md px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] focus:border-transparent"
          style={{
            background: 'var(--color-surface-3, #22222f)',
            border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
            color: 'var(--color-text-primary, #f0f0f5)',
          }}
          placeholder="1.0.0"
        />
      </div>

      <div
        className="h-6 w-px"
        style={{ background: 'var(--color-border, rgba(255,255,255,0.08))' }}
      />

      {/* Action Buttons */}
      <button
        onClick={handleValidate}
        className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
        style={{
          background: 'var(--color-accent, #6366f1)',
          color: '#ffffff',
        }}
      >
        Validate
      </button>

      <button
        onClick={handleExport}
        className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
        style={{
          background: 'var(--color-surface-3, #22222f)',
          border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          color: 'var(--color-text-secondary, #8888a0)',
        }}
      >
        Export JSON
      </button>

      <button
        onClick={handleImport}
        className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
        style={{
          background: 'var(--color-surface-3, #22222f)',
          border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          color: 'var(--color-text-secondary, #8888a0)',
        }}
      >
        Import JSON
      </button>

      <button
        onClick={autoLayout}
        className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
        style={{
          background: 'var(--color-surface-3, #22222f)',
          border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          color: 'var(--color-text-secondary, #8888a0)',
        }}
      >
        Auto Layout
      </button>

      <button
        onClick={() => editor.setShowSettings(true)}
        className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
        style={{
          background: 'var(--color-surface-3, #22222f)',
          border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          color: 'var(--color-text-secondary, #8888a0)',
        }}
      >
        Settings
      </button>

      <button
        onClick={handleClear}
        className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors text-red-400 hover:text-red-300 hover:bg-red-500/10"
      >
        Clear
      </button>

      {/* Validation Errors Summary */}
      {validationErrors.length > 0 && (
        <div className="ml-auto flex items-center gap-2 text-sm">
          {errorCount > 0 && (
            <span className="text-red-400 font-medium">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-amber-400 font-medium">
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
