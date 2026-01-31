import type { InputType, OutputType } from '../ShouldQueue.types'
import type { ShouldQueue } from '../ShouldQueue'

// ─── String Utility Types ────────────────────────────────────────

/**
 * Convert a snake_case string to camelCase at the type level.
 *
 * Examples:
 *   SnakeToCamelCase<'process_post'>       => 'processPost'
 *   SnakeToCamelCase<'send_message'>        => 'sendMessage'
 *   SnakeToCamelCase<'check_comment'>       => 'checkComment'
 *   SnakeToCamelCase<'data_center_etl'>     => 'dataCenterEtl'
 *   SnakeToCamelCase<'singleword'>          => 'singleword'
 */
export type SnakeToCamelCase<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Lowercase<Head>}${SnakeToCamelCaseRest<Tail>}`
    : Lowercase<S>

/**
 * Helper: capitalize the first letter of each segment after the first underscore.
 * @internal
 */
type SnakeToCamelCaseRest<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Capitalize<Lowercase<Head>>}${SnakeToCamelCaseRest<Tail>}`
    : Capitalize<Lowercase<S>>

// ─── Task Extraction Types ───────────────────────────────────────

/**
 * Extract the TName string literal from a ShouldQueue subclass instance.
 */
export type ExtractTaskName<T> =
  T extends ShouldQueue<any, any, infer TName> ? TName : never

/**
 * Extract the TInput type from a ShouldQueue subclass instance.
 */
export type ExtractTaskInput<T> =
  T extends ShouldQueue<infer TInput, any, any> ? TInput : never

/**
 * Extract the TResult type from a ShouldQueue subclass instance.
 */
export type ExtractTaskResult<T> =
  T extends ShouldQueue<any, infer TResult, any> ? TResult : never

// ─── Registry Map Types ──────────────────────────────────────────

/**
 * Given an array/tuple of ShouldQueue instances, build a mapped type where:
 *   - Keys are the camelCase version of each task's snake_case taskName
 *   - Values are the corresponding TInput type
 *
 * Example:
 *   TaskQueueMap<[
 *     ShouldQueue<ProcessPostTaskProps, undefined, 'process_post'>,
 *     ShouldQueue<SendMessageProps, undefined, 'send_message'>,
 *   ]>
 *   =>
 *   {
 *     processPost: ProcessPostTaskProps
 *     sendMessage: SendMessageProps
 *   }
 *
 * When TName is `string` (untyped tasks), the key becomes `string` and gets
 * merged into an index signature. Typed tasks still get autocomplete.
 */
export type TaskQueueMap<TTasks extends readonly ShouldQueue<any, any, any>[]> = {
  [K in TTasks[number] as SnakeToCamelCase<ExtractTaskName<K>>]: ExtractTaskInput<K>
}

/**
 * The input shape for TaskRegistry.queue().
 * Accepts an object where each key is a camelCase task name and the value
 * is the corresponding input payload. Multiple tasks can be queued at once.
 *
 * Uses Partial so callers only specify the tasks they want to queue.
 */
export type TaskQueueInput<TTasks extends readonly ShouldQueue<any, any, any>[]> =
  Partial<TaskQueueMap<TTasks>>

/**
 * Result of a TaskRegistry.queue() call.
 * Maps each queued task key to its job ID.
 */
export type TaskQueueResult<TKeys extends string = string> = {
  [K in TKeys]: { id: string }
}

/**
 * Configuration for creating a TaskRegistry instance.
 */
export interface TaskRegistryConfig {
  /**
   * Optional callback to resolve the current tenant ID.
   * When provided, queue() automatically scopes jobs to this tenant.
   * Typically reads from AsyncLocalStorage / DI container context.
   */
  getTenantId?: () => string

  /**
   * Optional callback to queue a job to the tenant's queue.
   * Receives the task instance, payload, and resolved tenant ID.
   * This replaces the old queueTask() utility.
   */
  queueFn?: (params: {
    task: ShouldQueue<any, any, any>
    payload: InputType
    tenantId: string
  }) => Promise<{ id: string }>

  /**
   * Optional callback to write a dispatch hint after queueing (shared mode).
   * When provided, queue() automatically dual-writes the dispatch hint.
   * This replaces the old dispatchAwareQueueTask() wrapper.
   */
  writeDispatchHint?: (params: {
    tenantId: string
    taskName: string
    jobId: string
  }) => Promise<void>
}

/**
 * Runtime function to convert a snake_case string to camelCase.
 *
 * Must match the behavior of SnakeToCamelCase<S> at compile time.
 *
 * @param s - A snake_case string (e.g., 'process_post')
 * @returns The camelCase equivalent (e.g., 'processPost')
 */
export function snakeToCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}
