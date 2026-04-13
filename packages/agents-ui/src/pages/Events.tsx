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
    <div className="min-h-screen bg-gray-50">
      <NavHeader title="Events" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Ingest Event</h2>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
              <input
                type="text" value={eventType} onChange={(e) => setEventType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="github.pr.opened"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
              <input
                type="text" value={source} onChange={(e) => setSource(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="github"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Payload (JSON)</label>
            <textarea
              value={payloadJson} onChange={(e) => { setPayloadJson(e.target.value); setJsonError(null) }}
              rows={6}
              className={`w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 resize-y ${
                jsonError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder='{ "pr": 42, "repo": "goat-io/fluent" }'
            />
            {jsonError && <p className="text-xs text-red-500 mt-1">{jsonError}</p>}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-600 mb-1">Idempotency Key (optional)</label>
            <input
              type="text" value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="github:pr:42:opened"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSubmit} disabled={submitting || !eventType.trim() || !source.trim()}
              className="bg-blue-600 text-white rounded-md px-6 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Ingesting...' : 'Ingest Event'}
            </button>

            {result && (
              <div className={`text-sm ${result.duplicate ? 'text-amber-600' : 'text-green-600'}`}>
                {result.duplicate ? 'Duplicate event' : 'Event ingested'}: <span className="font-mono">{result.eventId}</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
