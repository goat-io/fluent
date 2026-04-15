// SDLC Multi-Agent Workflow Definition for Testing

import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepExecutionContext,
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import {
  MockGitHubAdapter,
  MockLinearAdapter,
  MockUIGenerator,
  SideEffectTracker,
} from './mocks.js'

// Zod-like schemas for step output validation
export const STEP_SCHEMAS: Record<string, (output: any) => boolean> = {
  ingest_feedback: o =>
    typeof o.rawText === 'string' &&
    typeof o.source === 'string' &&
    typeof o.timestamp === 'number',
  structure_feedback: o =>
    typeof o.title === 'string' &&
    Array.isArray(o.requirements) &&
    typeof o.priority === 'string',
  generate_plan: o =>
    Array.isArray(o.tasks) &&
    o.tasks.every((t: any) => t.title && t.description && t.estimate),
  create_tasks: o => Array.isArray(o.issueIds) && o.issueIds.length > 0,
  implement_code: o =>
    typeof o.prId === 'string' &&
    typeof o.branch === 'string' &&
    Array.isArray(o.files),
  review_code: o =>
    typeof o.approved === 'boolean' && typeof o.comment === 'string',
  generate_ui: o => Array.isArray(o.artifacts) && o.artifacts.length > 0,
  validate_output: o => typeof o.valid === 'boolean' && Array.isArray(o.checks),
  complete_workflow: o =>
    typeof o.summary === 'string' && typeof o.completedAt === 'number',
}

export interface SDLCContext {
  linear: MockLinearAdapter
  github: MockGitHubAdapter
  uiGenerator: MockUIGenerator
  tracker: SideEffectTracker
  failureConfig?: {
    /** Step name to fail at */
    failAt?: string
    /** Number of times to fail before succeeding */
    failCount?: number
    /** Whether to produce an invalid plan (for branching test) */
    invalidPlan?: boolean
  }
}

/**
 * Creates the full SDLC workflow executor with all 9 step handlers wired to mock adapters.
 */
export function createSDLCExecutor(ctx: SDLCContext): FunctionStepExecutor {
  const executor = new FunctionStepExecutor()
  let failCounter = 0

  // Helper: check if this step should fail
  function shouldFail(stepName: string): boolean {
    if (ctx.failureConfig?.failAt === stepName) {
      failCounter++
      if (failCounter <= (ctx.failureConfig.failCount ?? 1)) {
        return true
      }
    }
    return false
  }

  // Step 1: Ingest raw user feedback
  executor.register(
    'ingest_feedback',
    async (payload: StepPayload): Promise<StepResult> => {
      if (shouldFail('ingest_feedback')) {
        throw new Error('Agent timeout: ingest_feedback')
      }

      const input = payload.input as { feedback: string; source?: string }
      ctx.tracker.record('agent', 'ingest_feedback', input, payload.stepName)

      return {
        output: {
          rawText: input.feedback,
          source: input.source ?? 'api',
          timestamp: Date.now(),
          wordCount: input.feedback.split(' ').length,
        },
      }
    },
  )

  // Step 2: Structure feedback into requirements
  executor.register(
    'structure_feedback',
    async (payload: StepPayload): Promise<StepResult> => {
      if (shouldFail('structure_feedback')) {
        throw new Error('Agent timeout: structure_feedback')
      }

      const input = payload.input as { rawText: string }
      ctx.tracker.record('agent', 'structure_feedback', input, payload.stepName)

      return {
        output: {
          title: `Feature: ${input.rawText.substring(0, 50)}`,
          requirements: [
            {
              id: 'REQ-1',
              description: 'Primary requirement from feedback',
              priority: 'high',
            },
            {
              id: 'REQ-2',
              description: 'Secondary requirement',
              priority: 'medium',
            },
          ],
          priority: 'high',
          category: 'feature',
        },
      }
    },
  )

  // Step 3: Generate implementation plan
  executor.register(
    'generate_plan',
    async (payload: StepPayload): Promise<StepResult> => {
      if (shouldFail('generate_plan')) {
        throw new Error('Agent timeout: generate_plan')
      }

      const input = payload.input as { title: string; requirements: any[] }
      ctx.tracker.record('agent', 'generate_plan', input, payload.stepName)

      // Support invalid plan for branching test
      if (ctx.failureConfig?.invalidPlan) {
        return {
          output: {
            tasks: [], // Empty tasks = invalid plan
            valid: false,
            reason: 'Could not generate valid plan from requirements',
          },
        }
      }

      return {
        output: {
          tasks: [
            {
              title: 'Create data model',
              description: 'Define schema',
              estimate: '2h',
              type: 'backend',
            },
            {
              title: 'Build API endpoint',
              description: 'REST handler',
              estimate: '3h',
              type: 'backend',
            },
            {
              title: 'Create UI component',
              description: 'React form',
              estimate: '4h',
              type: 'frontend',
            },
          ],
          valid: true,
        },
      }
    },
  )

  // Step 4: Create tasks in Linear (via ExternalAction for exactly-once)
  executor.register(
    'create_tasks',
    async (
      payload: StepPayload,
      context?: StepExecutionContext,
    ): Promise<StepResult> => {
      if (shouldFail('create_tasks')) {
        throw new Error('Agent timeout: create_tasks')
      }

      const input = payload.input as {
        tasks: Array<{ title: string; description: string }>
      }
      ctx.tracker.record('linear', 'create_tasks', input, payload.stepName)

      const issueIds: string[] = []
      for (let i = 0; i < input.tasks.length; i++) {
        const task = input.tasks[i]
        const result = await context!.externalActions.execute(
          {
            workflowRunId: payload.workflowRunId,
            stepName: payload.stepName,
            attempt: payload.attempt,
            tenantId: payload.tenantId,
            provider: 'linear',
            actionType: 'create_issue',
            idempotencyKey: `${payload.workflowRunId}:${payload.stepName}:create_issue:${i}`,
            request: { title: task.title, description: task.description },
          },
          async () => {
            const issue = await ctx.linear.createIssue({
              title: task.title,
              description: task.description,
              labels: ['auto-generated'],
              externalId: `${payload.workflowRunId}-${task.title}`,
            })
            return { externalId: issue.id, data: { id: issue.id } }
          },
        )
        issueIds.push(result.externalId!)
      }

      return {
        output: {
          issueIds,
          count: issueIds.length,
        },
      }
    },
  )

  // Step 5: Implement code (via ExternalAction for exactly-once)
  executor.register(
    'implement_code',
    async (
      payload: StepPayload,
      context?: StepExecutionContext,
    ): Promise<StepResult> => {
      if (shouldFail('implement_code')) {
        throw new Error('Agent timeout: implement_code')
      }

      const input = payload.input as { tasks: any[]; issueIds: string[] }
      ctx.tracker.record('github', 'implement_code', input, payload.stepName)

      const branch = `feat/wf-${payload.workflowRunId.substring(0, 8)}`
      const files = [
        {
          path: 'src/model.ts',
          content: '// Generated model\nexport interface Model {}',
        },
        {
          path: 'src/api.ts',
          content: '// Generated API\nexport function handler() {}',
        },
      ]

      const result = await context!.externalActions.execute(
        {
          workflowRunId: payload.workflowRunId,
          stepName: payload.stepName,
          attempt: payload.attempt,
          tenantId: payload.tenantId,
          provider: 'github',
          actionType: 'create_pr',
          idempotencyKey: `${payload.workflowRunId}:${payload.stepName}:create_pr`,
          request: {
            title: `Auto: ${payload.workflowRunId.substring(0, 8)}`,
            branch,
          },
        },
        async () => {
          const pr = await ctx.github.createPR({
            title: `Auto: ${payload.workflowRunId.substring(0, 8)}`,
            body: 'Auto-generated implementation',
            branch,
            files,
          })
          return { externalId: pr.id, data: { id: pr.id } }
        },
      )

      return {
        output: {
          prId: result.externalId!,
          branch,
          files: files.map(f => f.path),
        },
      }
    },
  )

  // Step 6: Review code (via ExternalAction for exactly-once)
  executor.register(
    'review_code',
    async (
      payload: StepPayload,
      context?: StepExecutionContext,
    ): Promise<StepResult> => {
      if (shouldFail('review_code')) {
        throw new Error('Agent timeout: review_code')
      }

      const input = payload.input as { prId: string }
      ctx.tracker.record('github', 'review_code', input, payload.stepName)

      await context!.externalActions.execute(
        {
          workflowRunId: payload.workflowRunId,
          stepName: payload.stepName,
          attempt: payload.attempt,
          tenantId: payload.tenantId,
          provider: 'github',
          actionType: 'add_review',
          idempotencyKey: `${payload.workflowRunId}:${payload.stepName}:add_review:${input.prId}`,
          request: { prId: input.prId, approved: true },
        },
        async () => {
          await ctx.github.addReview(input.prId, {
            approved: true,
            comment: 'LGTM — auto-reviewed by agent',
          })
          return { externalId: input.prId, data: { approved: true } }
        },
      )

      return {
        output: {
          approved: true,
          comment: 'LGTM — auto-reviewed by agent',
          prId: input.prId,
        },
      }
    },
  )

  // Step 7: Generate UI (via ExternalAction for exactly-once)
  executor.register(
    'generate_ui',
    async (
      payload: StepPayload,
      context?: StepExecutionContext,
    ): Promise<StepResult> => {
      if (shouldFail('generate_ui')) {
        throw new Error('Agent timeout: generate_ui')
      }

      const input = payload.input as { requirements?: any[] }
      ctx.tracker.record('ui', 'generate_ui', input, payload.stepName)

      const result = await context!.externalActions.execute(
        {
          workflowRunId: payload.workflowRunId,
          stepName: payload.stepName,
          attempt: payload.attempt,
          tenantId: payload.tenantId,
          provider: 'ui-generator',
          actionType: 'generate',
          idempotencyKey: `${payload.workflowRunId}:${payload.stepName}:generate`,
          request: { name: 'FeatureForm', type: 'component' },
        },
        async () => {
          const artifact = await ctx.uiGenerator.generate({
            name: 'FeatureForm',
            type: 'component',
            spec: 'Auto-generated from requirements',
          })
          return {
            externalId: artifact.id,
            data: { id: artifact.id, name: artifact.name, type: artifact.type },
          }
        },
      )

      return {
        output: {
          artifacts: [result.data],
        },
      }
    },
  )

  // Step 8: Validate all outputs
  executor.register(
    'validate_output',
    async (payload: StepPayload): Promise<StepResult> => {
      if (shouldFail('validate_output')) {
        throw new Error('Agent timeout: validate_output')
      }

      ctx.tracker.record(
        'agent',
        'validate_output',
        payload.input,
        payload.stepName,
      )

      const checks = [
        { name: 'code_generated', passed: true },
        { name: 'code_reviewed', passed: true },
        { name: 'ui_generated', passed: true },
        { name: 'tasks_created', passed: true },
      ]

      return {
        output: {
          valid: checks.every(c => c.passed),
          checks,
          score: 1.0,
        },
      }
    },
  )

  // Step 9: Complete workflow
  executor.register(
    'complete_workflow',
    async (payload: StepPayload): Promise<StepResult> => {
      ctx.tracker.record(
        'agent',
        'complete_workflow',
        payload.input,
        payload.stepName,
      )

      return {
        output: {
          summary: 'SDLC workflow completed successfully',
          completedAt: Date.now(),
          stepsExecuted: 9,
        },
      }
    },
  )

  return executor
}

/**
 * Build the 9-step SDLC workflow definition.
 * Linear dependency chain with mapInput wiring between steps.
 */
export function buildSDLCWorkflow() {
  return WorkflowBuilder.create('sdlc_pipeline')
    .version('1.0.0')
    .defaultRetries(3)
    .step('ingest_feedback', {
      executorType: 'function',
      executorConfig: { handler: 'ingest_feedback' },
    })
    .step('structure_feedback', {
      dependsOn: ['ingest_feedback'],
      executorType: 'function',
      executorConfig: { handler: 'structure_feedback' },
      mapInput: upstream => ({
        rawText: (upstream.ingest_feedback as any)?.rawText ?? '',
      }),
    })
    .step('generate_plan', {
      dependsOn: ['structure_feedback'],
      executorType: 'function',
      executorConfig: { handler: 'generate_plan' },
      mapInput: upstream => ({
        title: (upstream.structure_feedback as any)?.title,
        requirements: (upstream.structure_feedback as any)?.requirements,
      }),
    })
    .step('create_tasks', {
      dependsOn: ['generate_plan'],
      executorType: 'function',
      executorConfig: { handler: 'create_tasks' },
      mapInput: upstream => ({
        tasks: (upstream.generate_plan as any)?.tasks ?? [],
      }),
    })
    .step('implement_code', {
      dependsOn: ['create_tasks', 'generate_plan'],
      executorType: 'function',
      executorConfig: { handler: 'implement_code' },
      mapInput: upstream => ({
        tasks: (upstream.generate_plan as any)?.tasks ?? [],
        issueIds: (upstream.create_tasks as any)?.issueIds ?? [],
      }),
    })
    .step('review_code', {
      dependsOn: ['implement_code'],
      executorType: 'function',
      executorConfig: { handler: 'review_code' },
      mapInput: upstream => ({
        prId: (upstream.implement_code as any)?.prId,
        branch: (upstream.implement_code as any)?.branch,
      }),
    })
    .step('generate_ui', {
      dependsOn: ['structure_feedback'],
      executorType: 'function',
      executorConfig: { handler: 'generate_ui' },
      mapInput: upstream => ({
        requirements: (upstream.structure_feedback as any)?.requirements,
      }),
    })
    .step('validate_output', {
      dependsOn: ['review_code', 'generate_ui'],
      executorType: 'function',
      executorConfig: { handler: 'validate_output' },
      mapInput: upstream => ({
        review: upstream.review_code,
        ui: upstream.generate_ui,
        code: upstream.implement_code,
      }),
    })
    .step('complete_workflow', {
      dependsOn: ['validate_output'],
      executorType: 'function',
      executorConfig: { handler: 'complete_workflow' },
      mapInput: upstream => ({
        validation: upstream.validate_output,
      }),
    })
    .build()
}
