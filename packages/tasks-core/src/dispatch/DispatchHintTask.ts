import { ShouldQueue } from '../ShouldQueue'

/**
 * Payload for dispatch hint tasks.
 * The dispatchUrl is provided by the producer so the task class
 * has zero app-specific knowledge.
 */
export type DispatchHintPayload = {
  tenantId: string
  queueName: string
  jobId: string
  dispatchUrl: string
}

/**
 * A dispatch hint is a lightweight task queued to a global (cross-tenant)
 * Redis under the 'dispatch' prefix. When listened to via registry.listen(),
 * handle() fires an HTTP POST with X-Tenant-ID to the dispatchUrl provided
 * in the payload.
 *
 * This class is intentionally generic — all app-specific configuration
 * (URL, credentials) is passed through the payload at queue time.
 */
export class DispatchHintTask extends ShouldQueue<
  DispatchHintPayload,
  undefined,
  'dispatch-hints'
> {
  taskName = 'dispatch-hints' as const
  postUrl = ''

  getUniqueTaskName(body: DispatchHintPayload): string {
    return `${body.tenantId}:${body.queueName}:${body.jobId}`
  }

  async handle(body: DispatchHintPayload): Promise<undefined> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    try {
      const response = await globalThis.fetch(body.dispatchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': body.tenantId,
          'X-Dispatch-Source': 'listener',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error')
        throw new Error(`Dispatch returned ${response.status}: ${text}`)
      }
    } finally {
      clearTimeout(timeout)
    }

    return undefined
  }
}
