import { useState, useCallback } from 'react'
import { useAgents } from '@/providers/AgentsProvider'
import { NavHeader } from '@/components/common/NavHeader'

export function Events() {
  const { client } = useAgents()
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [payloadJson, setPayloadJson] = useState('{}')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [result, setResult] = useState<{ eventId: string; duplicate: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!eventType.trim() || !source.trim()) return
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(payloadJson)
      setJsonError(null)
    } catch {
      setJsonError('Invalid JSON')
      return
    }

    setSubmitting(true)
    try {
      const res = await client.ingestEvent(
        eventType.trim(),
        source.trim(),
        payload,
        idempotencyKey.trim() || undefined,
      )
      setResult(res)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }, [client, eventType, source, payloadJson, idempotencyKey])

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)]">
      <NavHeader title="Events" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">Ingest Event</h2>

        <div className="glass rounded-2xl p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Event Type</label>
              <input
                type="text" value={eventType} onChange={(e) => setEventType(e.target.value)}
                className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
                placeholder="github.pr.opened"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Source</label>
              <input
                type="text" value={source} onChange={(e) => setSource(e.target.value)}
                className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
                placeholder="github"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Payload (JSON)</label>
            <textarea
              value={payloadJson} onChange={(e) => { setPayloadJson(e.target.value); setJsonError(null) }}
              rows={6}
              className={`w-full bg-[var(--color-surface-3)] border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 resize-y text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] ${
                jsonError ? 'border-red-500/50 focus:ring-red-500' : 'border-[var(--color-border)] focus:ring-[var(--color-accent)]'
              }`}
              placeholder='{ "pr": 42, "repo": "goat-io/fluent" }'
            />
            {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
          </div>

          <div className="mb-6">
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Idempotency Key (optional)</label>
            <input
              type="text" value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
              placeholder="github:pr:42:opened"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSubmit} disabled={submitting || !eventType.trim() || !source.trim()}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Ingesting...' : 'Ingest Event'}
            </button>

            {result && (
              <div className={`text-sm ${result.duplicate ? 'text-amber-400' : 'text-green-400'}`}>
                {result.duplicate ? 'Duplicate event' : 'Event ingested'}: <span className="font-mono">{result.eventId}</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
