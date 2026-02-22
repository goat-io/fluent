import { TaskRegistry } from '../registry/TaskRegistry'
import type { TaskConnector } from '../ShouldQueue.types'
import { DispatchHintTask } from './DispatchHintTask'

/**
 * Pre-wired factory that creates a TaskRegistry with DispatchHintTask.
 *
 * The consumer provides the concrete connector (e.g. BullMQConnector)
 * configured with its own Redis connection and prefix.
 *
 * ```typescript
 * import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
 * import { createHintRegistry } from '@goatlab/tasks-core'
 *
 * const registry = createHintRegistry(
 *   new BullMQConnector({ connection, prefix: 'dispatch' }),
 * )
 *
 * await registry.queue({ dispatchHints: { tenantId, queueName, jobId, dispatchUrl } })
 * await registry.listen()
 * ```
 */
export function createHintRegistry(connector: TaskConnector<any>) {
  return TaskRegistry.fromClasses({
    classes: [DispatchHintTask] as const,
    connector,
  })
}

export type HintRegistry = ReturnType<typeof createHintRegistry>
