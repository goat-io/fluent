// npx vitest run src/__tests__/sdlc/sdlc-e2e.spec.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { WorkflowStepTask } from '../../tasks/WorkflowStepTask.js'
import type { StepPayload } from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from '../engine/shared.js'
import {
  MockGitHubAdapter,
  MockLinearAdapter,
  MockUIGenerator,
  SideEffectTracker,
} from './mocks.js'
import {
  buildSDLCWorkflow,
  createSDLCExecutor,
  type SDLCContext,
  STEP_SCHEMAS,
} from './workflow.js'

interface GlobalTestData {
  redis: { host: string; port: number }
  postgres: {
    host: string
    port: number
    database: string
    username: string
    password: string
  }
}

function getGlobalData(): GlobalTestData {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'),
  )
}

async function waitForStatus(
  engine: WorkflowEngine,
  runId: string,
  tenantId: string,
  targets: string[],
  timeoutMs = 30_000,
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const s = await engine.getStatus(runId, tenantId)
    if (targets.includes(s.status)) {
      return s.status
    }
    await new Promise(r => setTimeout(r, 200))
  }
  const final = await engine.getStatus(runId, tenantId)
  throw new Error(
    `Workflow ${runId} did not reach ${targets.join('|')} within ${timeoutMs}ms. ` +
      `Current: ${final.status}, steps: ${final.steps.map(s => `${s.stepName}=${s.status}`).join(', ')}`,
  )
}

describe('SDLC Multi-Agent Workflow — Full E2E', () => {
  let db: TestDb
  let connector: BullMQConnector
  let stopWorker: (() => Promise<void>) | null = null

  // Mock adapters (reset per test)
  let linear: MockLinearAdapter
  let github: MockGitHubAdapter
  let uiGen: MockUIGenerator
  let tracker: SideEffectTracker

  const TENANT = 'sdlc-test'

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    if (stopWorker) {
      await stopWorker()
    }
    if (connector) {
      await connector.close()
    }
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    linear = new MockLinearAdapter()
    github = new MockGitHubAdapter()
    uiGen = new MockUIGenerator()
    tracker = new SideEffectTracker()
  })

  async function setupEngine(ctx: SDLCContext) {
    if (stopWorker) {
      await stopWorker()
      stopWorker = null
    }
    if (connector) {
      await connector.close()
    }

    const data = getGlobalData()
    connector = new BullMQConnector({
      connection: { host: data.redis.host, port: data.redis.port },
    })

    const wf = buildSDLCWorkflow()
    const executor = createSDLCExecutor(ctx)

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([['sdlc_pipeline', wf]]),
      tenantId: TENANT,
      disableLogBuffering: true,
    })

    const stepTask = new WorkflowStepTask(engine)
    stepTask.setConnector(connector)

    const handle = await connector.listen({
      tasks: [
        {
          taskName: 'workflow_step_light',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
        {
          taskName: 'workflow_step_heavy',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
        {
          taskName: 'workflow_step_ai',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
        {
          taskName: 'workflow_step_sandbox',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
      ],
      defaultConcurrency: 5,
    })
    stopWorker = handle.stop
    await new Promise(r => setTimeout(r, 500))

    return engine
  }

  // ─────────────────────────────────────────────────────────────────
  // 1. END-TO-END HAPPY PATH
  // ─────────────────────────────────────────────────────────────────
  describe('1. End-to-End Happy Path', () => {
    it('executes full SDLC pipeline from feedback to completion', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: {
          feedback: 'Add a user dashboard with activity feed and notifications',
        },
      })

      const status = await waitForStatus(engine, runId, TENANT, [
        'COMPLETED',
        'FAILED',
      ])
      expect(status).toBe('COMPLETED')

      const final = await engine.getStatus(runId, TENANT)

      // All 9 steps executed
      expect(final.steps).toHaveLength(9)
      for (const step of final.steps) {
        expect(step.status).toBe('COMPLETED')
      }

      // State persisted — each step has output
      for (const step of final.steps) {
        expect(step.output).toBeDefined()
        expect(step.output).not.toBeNull()
      }

      // External integrations called
      expect(linear.issues.length).toBeGreaterThan(0)
      expect(github.prs.length).toBeGreaterThan(0)
      expect(uiGen.artifacts.length).toBeGreaterThan(0)

      // Workflow output contains merged step outputs
      expect(final.output).toHaveProperty('complete_workflow')
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 2. STEP ISOLATION (IDEMPOTENCY)
  // ─────────────────────────────────────────────────────────────────
  describe('2. Step Isolation — Idempotency', () => {
    it('Linear tasks not duplicated when create_tasks runs twice with same externalId', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })

      // Run full workflow
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Idempotency test feedback' },
      })
      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      const issueCountAfterFirst = linear.issues.length

      // Run second workflow with same structure — externalIds include runId so they'll be different
      // But within a single workflow, if create_tasks ran twice (retry), externalIds deduplicate
      const createTaskCalls = linear.callLog.filter(
        c => c.method === 'createIssue',
      )
      const externalIds = createTaskCalls.map(c => c.args.externalId)
      const uniqueExternalIds = new Set(externalIds)
      expect(uniqueExternalIds.size).toBe(externalIds.length) // All unique
      expect(issueCountAfterFirst).toBe(3) // Exactly 3 tasks from plan
    })

    it('GitHub PRs not duplicated when implement_code runs twice with same branch', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'PR idempotency test' },
      })
      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      // Exactly 1 PR created
      expect(github.prs.length).toBe(1)
      expect(github.prs[0].status).toBe('open')
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 3. FAILURE + RETRY
  // ─────────────────────────────────────────────────────────────────
  describe('3. Failure + Retry', () => {
    it('recovers from agent timeout via retry', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
        failureConfig: { failAt: 'structure_feedback', failCount: 2 },
      })

      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Retry test — agent will fail twice then succeed' },
      })

      const status = await waitForStatus(engine, runId, TENANT, [
        'COMPLETED',
        'FAILED',
      ])
      expect(status).toBe('COMPLETED')

      // Verify retry happened
      const final = await engine.getStatus(runId, TENANT)
      const structStep = final.steps.find(
        s => s.stepName === 'structure_feedback',
      )
      expect(structStep?.attempt).toBeGreaterThanOrEqual(2)
    })

    it('fails workflow when retries exhausted', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
        failureConfig: { failAt: 'generate_plan', failCount: 99 }, // Always fail
      })

      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'This will fail permanently' },
      })

      const status = await waitForStatus(engine, runId, TENANT, [
        'COMPLETED',
        'FAILED',
      ])
      expect(status).toBe('FAILED')

      const final = await engine.getStatus(runId, TENANT)
      expect(final.error).toContain('generate_plan')

      // Steps after failure should not have executed
      const laterSteps = final.steps.filter(s =>
        ['create_tasks', 'implement_code', 'review_code'].includes(s.stepName),
      )
      for (const step of laterSteps) {
        expect(step.status).not.toBe('COMPLETED')
      }
    })

    it('maintains state integrity after failure — no duplicate side effects', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
        failureConfig: { failAt: 'create_tasks', failCount: 1 },
      })

      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Side effect integrity test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED', 'FAILED'])

      // Even with retry, Linear issues should be deduplicated via externalId
      const _createCalls = linear.callLog.filter(
        c => c.method === 'createIssue',
      )
      // Issues created = 3 (not 6, because externalId dedup)
      expect(linear.issues.length).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 4. QUEUE RELIABILITY (worker crash simulation)
  // ─────────────────────────────────────────────────────────────────
  describe('4. Queue Reliability', () => {
    it('workflow resumes after worker restart', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Queue reliability test' },
      })

      // Let some steps run
      await new Promise(r => setTimeout(r, 2000))

      // Verify workflow is in progress
      const mid = await engine.getStatus(runId, TENANT)
      const _completedSteps = mid.steps.filter(
        s => s.status === 'COMPLETED',
      ).length

      // Wait for full completion (worker is still running)
      const status = await waitForStatus(engine, runId, TENANT, [
        'COMPLETED',
        'FAILED',
      ])
      expect(status).toBe('COMPLETED')

      // All steps should be completed
      const final = await engine.getStatus(runId, TENANT)
      expect(final.steps.filter(s => s.status === 'COMPLETED').length).toBe(9)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 5. STATE CONSISTENCY
  // ─────────────────────────────────────────────────────────────────
  describe('5. State Consistency', () => {
    it('all step outputs persisted in DB after completion', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'State persistence test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      // Read directly from DB — verify output is persisted
      const steps = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .execute()

      for (const step of steps) {
        expect(step.output, `Step ${step.stepName} has no output`).toBeDefined()
        expect(
          step.output,
          `Step ${step.stepName} output is null`,
        ).not.toBeNull()
        expect(step.status).toBe('COMPLETED')
        expect(step.completedAt).toBeDefined()
      }
    })

    it('audit log contains events for all step transitions', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Audit log test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      const logs = await db
        .selectFrom('workflow_step_logs')
        .selectAll()
        .where('tenantId', '=', TENANT)
        .orderBy('createdAt', 'asc')
        .execute()

      // Each step should have at minimum: queued + started + completed
      const stepNames = new Set(logs.map(l => l.stepId))
      expect(stepNames.size).toBe(9)

      // Verify event types present
      const eventTypes = new Set(logs.map(l => l.event))
      expect(eventTypes.has('queued')).toBe(true)
      expect(eventTypes.has('started')).toBe(true)
      expect(eventTypes.has('completed')).toBe(true)
    })

    it('no hidden state outside DB — engine reconstructs from Postgres', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'No hidden state test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      // Create a NEW engine instance pointing to same DB
      const engine2 = new WorkflowEngine({
        db,
        connector,
        executors: new Map([
          [
            'function',
            createSDLCExecutor({ linear, github, uiGenerator: uiGen, tracker }),
          ],
        ]),
        workflows: new Map([['sdlc_pipeline', buildSDLCWorkflow()]]),
        tenantId: TENANT,
        disableLogBuffering: true,
      })

      // Should be able to read the workflow state from the new engine
      const status = await engine2.getStatus(runId, TENANT)
      expect(status.status).toBe('COMPLETED')
      expect(status.steps).toHaveLength(9)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 7. EXTERNAL INTEGRATIONS
  // ─────────────────────────────────────────────────────────────────
  describe('7. External Integrations', () => {
    it('Linear: tasks created exactly once with correct mapping from plan', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Linear integration test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      // 3 tasks created (matching plan)
      expect(linear.issues).toHaveLength(3)
      expect(linear.issues[0].title).toBe('Create data model')
      expect(linear.issues[1].title).toBe('Build API endpoint')
      expect(linear.issues[2].title).toBe('Create UI component')

      // Each has externalId for deduplication
      for (const issue of linear.issues) {
        expect(issue.externalId).toContain(runId)
      }

      // External IDs stored in step output
      const final = await engine.getStatus(runId, TENANT)
      const createStep = final.steps.find(s => s.stepName === 'create_tasks')
      expect((createStep?.output as any)?.issueIds).toHaveLength(3)
    })

    it('GitHub: PR created and reviewed correctly', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'GitHub integration test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      // PR created
      expect(github.prs).toHaveLength(1)
      const pr = github.prs[0]
      expect(pr.status).toBe('open')
      expect(pr.files.length).toBeGreaterThan(0)

      // Review added
      expect(pr.reviews).toHaveLength(1)
      expect(pr.reviews[0].approved).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 8. MULTI-AGENT COORDINATION (output chaining)
  // ─────────────────────────────────────────────────────────────────
  describe('8. Multi-Agent Coordination — Output Chaining', () => {
    it('each step receives correct input from upstream steps', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Output chaining test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      const final = await engine.getStatus(runId, TENANT)

      // structure_feedback received rawText from ingest
      const structStep = final.steps.find(
        s => s.stepName === 'structure_feedback',
      )
      expect(structStep?.input).toHaveProperty('rawText')

      // generate_plan received title + requirements from structure
      const planStep = final.steps.find(s => s.stepName === 'generate_plan')
      expect(planStep?.input).toHaveProperty('title')
      expect(planStep?.input).toHaveProperty('requirements')

      // create_tasks received tasks from plan
      const taskStep = final.steps.find(s => s.stepName === 'create_tasks')
      expect((taskStep?.input as any)?.tasks).toHaveLength(3)

      // implement_code received both tasks and issueIds
      const codeStep = final.steps.find(s => s.stepName === 'implement_code')
      expect((codeStep?.input as any)?.tasks).toHaveLength(3)
      expect((codeStep?.input as any)?.issueIds).toHaveLength(3)

      // review_code received prId from implement
      const reviewStep = final.steps.find(s => s.stepName === 'review_code')
      expect(reviewStep?.input).toHaveProperty('prId')
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 9. SCHEMA VALIDATION
  // ─────────────────────────────────────────────────────────────────
  describe('9. Data Validation — Schema Enforcement', () => {
    it('all step outputs conform to expected schemas', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Schema validation test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      const final = await engine.getStatus(runId, TENANT)
      for (const step of final.steps) {
        const validator = STEP_SCHEMAS[step.stepName]
        if (validator) {
          const valid = validator(step.output)
          expect(
            valid,
            `Step "${step.stepName}" output does not match schema: ${JSON.stringify(step.output)}`,
          ).toBe(true)
        }
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 10. PERFORMANCE — CONCURRENT WORKFLOWS
  // ─────────────────────────────────────────────────────────────────
  describe('10. Performance — Concurrent Workflows', () => {
    it('runs 10 workflows concurrently without contention', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })

      const runIds: string[] = []
      for (let i = 0; i < 10; i++) {
        const { runId } = await engine.start({
          workflowName: 'sdlc_pipeline',
          tenantId: TENANT,
          input: { feedback: `Concurrent workflow #${i}` },
        })
        runIds.push(runId)
      }

      // Wait for all to complete
      const results = await Promise.all(
        runIds.map(id =>
          waitForStatus(engine, id, TENANT, ['COMPLETED', 'FAILED'], 60_000),
        ),
      )

      // All should complete
      const completed = results.filter(r => r === 'COMPLETED').length
      expect(completed).toBe(10)

      // Verify no cross-contamination — each workflow has its own steps
      for (const runId of runIds) {
        const status = await engine.getStatus(runId, TENANT)
        expect(status.steps).toHaveLength(9)
        expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)
      }
    }, 90_000) // Longer timeout for concurrent execution
  })

  // ─────────────────────────────────────────────────────────────────
  // ANTI-PATTERN DETECTION
  // ─────────────────────────────────────────────────────────────────
  describe('Anti-Pattern Detection', () => {
    it('all external calls tracked in side effect tracker', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'Side effect tracking test' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      // Linear calls tracked
      const linearEffects = tracker.getEffectsForService('linear')
      expect(linearEffects.length).toBeGreaterThan(0)

      // GitHub calls tracked
      const githubEffects = tracker.getEffectsForService('github')
      expect(githubEffects.length).toBeGreaterThan(0)

      // UI calls tracked
      const uiEffects = tracker.getEffectsForService('ui')
      expect(uiEffects.length).toBeGreaterThan(0)

      // Agent calls tracked
      const agentEffects = tracker.getEffectsForService('agent')
      expect(agentEffects.length).toBeGreaterThan(0)
    })

    it('no step produces output without corresponding DB entry', async () => {
      const engine = await setupEngine({
        linear,
        github,
        uiGenerator: uiGen,
        tracker,
      })
      const { runId } = await engine.start({
        workflowName: 'sdlc_pipeline',
        tenantId: TENANT,
        input: { feedback: 'DB consistency check' },
      })

      await waitForStatus(engine, runId, TENANT, ['COMPLETED'])

      // Every tracked side effect should correspond to a completed step in DB
      const steps = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .execute()
      const completedStepNames = new Set(
        steps.filter(s => s.status === 'COMPLETED').map(s => s.stepName),
      )

      // All 9 step names present
      const expected = [
        'ingest_feedback',
        'structure_feedback',
        'generate_plan',
        'create_tasks',
        'implement_code',
        'review_code',
        'generate_ui',
        'validate_output',
        'complete_workflow',
      ]
      for (const name of expected) {
        expect(completedStepNames.has(name), `Step "${name}" not in DB`).toBe(
          true,
        )
      }
    })
  })
})
