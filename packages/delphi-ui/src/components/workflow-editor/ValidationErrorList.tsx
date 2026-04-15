import type { ValidationError } from './useWorkflowEditor'

interface ValidationErrorListProps {
  errors: ValidationError[]
}

export function ValidationErrorList({ errors }: ValidationErrorListProps) {
  if (errors.length === 0) return null

  return (
    <div
      className="px-4 py-2"
      style={{
        background: 'rgba(239,68,68,0.08)',
        borderBottom: '1px solid rgba(239,68,68,0.2)',
      }}
    >
      <div className="flex flex-wrap gap-2">
        {errors.map((err, i) => (
          <span
            key={i}
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={
              err.type === 'error'
                ? { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
                : { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
            }
          >
            {err.message}
          </span>
        ))}
      </div>
    </div>
  )
}
