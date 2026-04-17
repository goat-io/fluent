import { useState } from 'react'
import { cn } from '@/lib/utils'

export function JsonViewer({ data, defaultExpanded = true }: { data: unknown; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic">null</span>
  }

  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? 'Collapse' : 'Expand'}
      </button>
      <pre
        className={cn(
          'overflow-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground border border-border',
          !expanded && 'max-h-24',
        )}
      >
        {json}
      </pre>
    </div>
  )
}
