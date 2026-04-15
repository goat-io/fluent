import { useState } from 'react'
import { cn } from '@/lib/utils'

export function JsonViewer({ data, defaultExpanded = true }: { data: unknown; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">null</span>
  }

  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600"
      >
        {expanded ? 'Collapse' : 'Expand'}
      </button>
      <pre
        className={cn(
          'overflow-auto rounded-md bg-gray-50 p-3 text-xs font-mono text-gray-800 border border-gray-200',
          !expanded && 'max-h-24',
        )}
      >
        {json}
      </pre>
    </div>
  )
}
