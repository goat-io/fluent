import type { ValidationError } from './useWorkflowEditor'

interface ValidationErrorListProps {
  errors: ValidationError[]
}

export function ValidationErrorList({ errors }: ValidationErrorListProps) {
  if (errors.length === 0) return null

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2">
      <div className="flex flex-wrap gap-2">
        {errors.map((err, i) => (
          <span
            key={i}
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              err.type === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {err.message}
          </span>
        ))}
      </div>
    </div>
  )
}
