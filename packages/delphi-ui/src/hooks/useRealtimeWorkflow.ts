import { useEffect, useRef, useState } from 'react'
import type { WorkflowRunDetail } from '@/api/types'
import { useAgents } from '@/providers/AgentsProvider'

/**
 * Subscribe to real-time workflow updates via SSE.
 * Falls back to polling if SSE is not available.
 */
export function useRealtimeWorkflow(runId: string | undefined) {
  const { client } = useAgents()
  const [workflow, setWorkflow] = useState<WorkflowRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!runId) {
      return
    }

    // Initial fetch
    client
      .getWorkflow(runId)
      .then(data => {
        setWorkflow(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // Connect SSE
    const es = client.subscribe(runId)
    eventSourceRef.current = es

    es.onmessage = event => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'workflowUpdate' && data.workflow) {
          setWorkflow(prev => {
            if (!prev) {
              return prev
            }
            const updated = data.workflow
            return {
              ...prev,
              status: updated.status ?? prev.status,
              output: updated.output ?? prev.output,
              completedAt: updated.completedAt ?? prev.completedAt,
              steps: prev.steps.map(step => {
                const updatedStep = updated.steps?.find(
                  (s: any) => s.stepName === step.stepName,
                )
                if (!updatedStep) {
                  return step
                }
                return {
                  ...step,
                  status: updatedStep.status ?? step.status,
                  attempt: updatedStep.attempt ?? step.attempt,
                  output: updatedStep.output ?? step.output,
                  error: updatedStep.error ?? step.error,
                  startedAt: updatedStep.startedAt ?? step.startedAt,
                  completedAt: updatedStep.completedAt ?? step.completedAt,
                  humanPrompt: updatedStep.humanPrompt ?? step.humanPrompt,
                }
              }),
            }
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.onerror = () => {
      // SSE disconnected — fall back to polling
      es.close()
      eventSourceRef.current = null
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => {
          client
            .getWorkflow(runId)
            .then(setWorkflow)
            .catch(() => {})
        }, 2000)
      }
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [runId, client])

  return { workflow, loading, setWorkflow }
}
