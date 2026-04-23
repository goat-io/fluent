// fromShouldQueue — adapt a @goatlab/tasks-core ShouldQueue task as a
// Delphi workflow Step (or single-step Workflow).
//
// Bridges two authoring styles that describe the same shape of thing —
// a typed unit of background work. A `ShouldQueue` carries `taskName`,
// `TInput`, `TResult`, and a `handle(body)` method; a Delphi `FunctionStep`
// carries `stepName`, `TInput`, `TOutput`, and a `handle(input, ctx)`
// method. The adapter maps the generics one-to-one so a task catalogue
// (Sodium-style `taskClasses` tuple) can be consumed by Delphi workflows
// without re-authoring anything.
//
// npx vitest run src/__tests__/workflow.spec.ts

import type {
  InputType,
  JsonObject,
  OutputType,
  ShouldQueue,
} from '@goatlab/tasks-core'
import { FunctionStep } from './Step.js'
import { step, Workflow } from './Workflow.js'

/**
 * Map a ShouldQueue's `TResult` (which may be `undefined`) onto the
 * Delphi step's `TOutput` (which must be a JsonObject).
 * - `TResult = undefined` → step output is `JsonObject` (we return `{}`)
 * - `TResult = JsonObject`-shaped → step output preserves the shape
 */
type StepOutputOf<TResult extends OutputType> = TResult extends JsonObject
  ? TResult
  : JsonObject

/**
 * Wrap a `ShouldQueue` task as a typed `FunctionStep` instance.
 *
 * The task's `handle(body)` runs inline on the workflow worker — Delphi
 * owns retries, timeouts, observability, and durability. The task's
 * own `connector` / `tracker` are NOT used by this adapter; if you need
 * separate-worker dispatch via the task's queue, enqueue it from a step
 * via `connector.queue(...)` instead (option 2 in the README).
 *
 * @example
 *   import { checkPostTask } from '@/api/posts/tasks/checkPosts.task'
 *   const checkPostStep = fromShouldQueue(checkPostTask)
 *
 *   class PostPipeline extends Workflow<{ postId: string }> {
 *     workflowName = 'post_pipeline' as const
 *     steps = [
 *       step(checkPostStep),
 *       step(indexStep, { dependsOn: [checkPostStep] }),
 *     ] as const
 *   }
 */
export function fromShouldQueue<
  TInput extends InputType,
  TResult extends OutputType,
  TName extends string,
>(
  task: ShouldQueue<TInput, TResult, TName>,
): FunctionStep<TInput & JsonObject, StepOutputOf<TResult>> {
  class AdaptedStep extends FunctionStep<
    TInput & JsonObject,
    StepOutputOf<TResult>
  > {
    readonly stepName = task.taskName as TName
    override readonly retries = task.retries

    async handle(input: TInput & JsonObject) {
      const result = await task.handle(input as TInput)
      // ShouldQueue may return undefined (fire-and-forget tasks); Delphi
      // step outputs must be JsonObject, so default to {}.
      return { output: (result ?? {}) as StepOutputOf<TResult> }
    }
  }
  return new AdaptedStep()
}

/**
 * Wrap a `ShouldQueue` task as a single-step `Workflow` instance.
 *
 * Every task is essentially a one-step workflow: given an input, run
 * `handle`, return. This helper skips the Workflow class boilerplate for
 * the common case where the task IS the whole flow.
 *
 * @example
 *   import { checkPostTask } from '@/api/posts/tasks/checkPosts.task'
 *   const checkPostWorkflow = workflowFromShouldQueue(checkPostTask)
 *
 *   const engine = createEngine({
 *     workflows: [checkPostWorkflow] as const,
 *     db, pgPool, connector, tenantId: 'default',
 *   })
 *
 *   // Typed call — `TInput` flows from the ShouldQueue through:
 *   await engine.check_post.start({ postId: 'p_123' })
 */
export function workflowFromShouldQueue<
  TInput extends InputType,
  TResult extends OutputType,
  TName extends string,
>(task: ShouldQueue<TInput, TResult, TName>): Workflow<TInput & JsonObject> {
  const adapted = fromShouldQueue(task)

  class TaskWorkflow extends Workflow<TInput & JsonObject> {
    readonly workflowName = task.taskName as TName
    override readonly defaultRetries = task.retries
    readonly steps = [step(adapted)] as const
    override readonly inputFields = (
      task as unknown as { inputFields?: readonly string[] }
    ).inputFields
    override readonly sensitiveFields = (
      task as unknown as { sensitiveFields?: readonly string[] }
    ).sensitiveFields
  }

  return new TaskWorkflow()
}
