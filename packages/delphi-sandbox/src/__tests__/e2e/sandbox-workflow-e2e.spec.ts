// npx vitest run src/__tests__/e2e/sandbox-workflow-e2e.spec.ts
//
// Full SDLC Workflow E2E: Real Docker containers + Real BullMQ + Real Postgres
//
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Database, StepPayload, StepResult } from '@goatlab/delphi-core'
import {
  CREATE_TABLES_SQL,
  FunctionStepExecutor,
  WorkflowBuilder,
  WorkflowEngine,
  WorkflowStepTask,
} from '@goatlab/delphi-core'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SandboxStepExecutor } from '../../SandboxStepExecutor.js'

const dockerSocketCandidates = [
  process.env.DOCKER_HOST?.replace('unix://', ''),
  `${process.env.HOME}/.docker/run/docker.sock`,
  '/var/run/docker.sock',
].filter(Boolean) as string[]
const dockerSocket = dockerSocketCandidates.find(p => existsSync(p))
const dockerAvailable = !!dockerSocket

if (!dockerAvailable) {
  console.warn('Docker not found — skipping sandbox workflow E2E tests')
}

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

async function waitForWorkflow(
  engine: WorkflowEngine,
  runId: string,
  tenantId: string,
  targets: string[],
  timeoutMs = 120_000,
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const s = await engine.getStatus(runId, tenantId)
    if (targets.includes(s.status)) {
      return s.status
    }
    await new Promise(r => setTimeout(r, 500))
  }
  const final = await engine.getStatus(runId, tenantId)
  throw new Error(
    `Workflow ${runId} stuck at ${final.status} after ${timeoutMs}ms. Steps: ${final.steps.map(s => `${s.stepName}=${s.status}`).join(', ')}`,
  )
}

describe('Sandbox Workflow E2E — Real Docker Containers', () => {
  let db: Kysely<Database>
  let connector: BullMQConnector
  let stopWorker: (() => Promise<void>) | null = null
  const TENANT = 'sandbox-e2e'

  beforeAll(async () => {
    if (!dockerAvailable) {
      return
    }
    const data = getGlobalData()
    db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({
          host: data.postgres.host,
          port: data.postgres.port,
          database: data.postgres.database,
          user: data.postgres.username,
          password: data.postgres.password,
          max: 10,
        }),
      }),
    })
    const statements = CREATE_TABLES_SQL.split(';')
      .map(s => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      await sql.raw(stmt).execute(db)
    }
  })

  afterAll(async () => {
    if (stopWorker) {
      await stopWorker()
    }
    if (connector) {
      await connector.close()
    }
    if (db) {
      await db.destroy()
    }
  })

  beforeEach(async () => {
    if (!dockerAvailable) {
      return
    }
    await sql`TRUNCATE TABLE workflow_step_logs, workflow_signals, workflow_steps, workflow_runs CASCADE`.execute(
      db,
    )
  })

  async function setupEngine(
    workflows: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    executors: Map<string, any>,
  ) {
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

    const engine = new WorkflowEngine({
      db,
      connector,
      executors,
      workflows: new Map(workflows.map(w => [w.name, w])),
      tenantId: TENANT,
      disableLogBuffering: true,
    })

    const stepTask = new WorkflowStepTask(engine)
    stepTask.setConnector(connector)

    const handle = await connector.listen({
      tasks: [
        {
          taskName: stepTask.taskName,
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
      ],
      defaultConcurrency: 3,
    })
    stopWorker = handle.stop
    await new Promise(r => setTimeout(r, 500))
    return engine
  }

  it.skipIf(!dockerAvailable)(
    'runs a 3-step SDLC pipeline in real Docker containers',
    async () => {
      const sandboxExecutor = new SandboxStepExecutor()
      const workflow = WorkflowBuilder.create('docker_sdlc')
        .step('analyze', {
          executorType: 'sandbox',
          executorConfig: {
            image: 'alpine:latest',
            setup: ['mkdir -p /workspace/analysis'],
            execute: {
              type: 'script' as const,
              commands: [
                'echo "Analyzing requirement: {{task}}" > /workspace/analysis/report.txt',
                'cat /workspace/analysis/report.txt',
              ],
            },
            extract: { files: ['/workspace/analysis/report.txt'] },
          },
        })
        .step('implement', {
          dependsOn: ['analyze'],
          executorType: 'sandbox',
          executorConfig: {
            image: 'node:20-alpine',
            setup: ['mkdir -p /workspace/src'],
            execute: {
              type: 'script' as const,
              commands: [
                'echo "export const hello = () => true" > /workspace/src/index.ts',
                'ls -la /workspace/src/',
              ],
            },
            extract: { files: ['/workspace/src/index.ts'] },
          },
        })
        .step('test', {
          dependsOn: ['implement'],
          executorType: 'sandbox',
          executorConfig: {
            image: 'node:20-alpine',
            execute: {
              type: 'script' as const,
              commands: [
                'node -e "console.log(JSON.stringify({ passed: 2, failed: 0 }))"',
              ],
            },
          },
        })
        .build()

      const engine = await setupEngine(
        [workflow],
        new Map([['sandbox', sandboxExecutor]]),
      )
      const { runId } = await engine.start({
        workflowName: 'docker_sdlc',
        tenantId: TENANT,
        input: { task: 'Build auth system' },
      })

      const finalStatus = await waitForWorkflow(engine, runId, TENANT, [
        'COMPLETED',
        'FAILED',
      ])
      expect(finalStatus).toBe('COMPLETED')

      const status = await engine.getStatus(runId, TENANT)
      expect(status.steps).toHaveLength(3)
      expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)
    },
    180_000,
  )

  it.skipIf(!dockerAvailable)(
    'mixes sandbox and function executors',
    async () => {
      const sandboxExecutor = new SandboxStepExecutor()
      const functionExecutor = new FunctionStepExecutor()
      functionExecutor.register(
        'plan',
        async (): Promise<StepResult> => ({
          output: { tasks: [{ name: 'setup-db' }], planApproved: true },
        }),
      )
      functionExecutor.register(
        'validate',
        async (): Promise<StepResult> => ({
          output: { allChecks: 'passed' },
        }),
      )

      const workflow = WorkflowBuilder.create('mixed_workflow')
        .step('plan', {
          executorType: 'function',
          executorConfig: { handler: 'plan' },
        })
        .step('implement', {
          dependsOn: ['plan'],
          executorType: 'sandbox',
          executorConfig: {
            image: 'node:20-alpine',
            execute: {
              type: 'script' as const,
              commands: [
                'node -e "console.log(JSON.stringify({ filesCreated: 3 }))"',
              ],
            },
          },
        })
        .step('validate', {
          dependsOn: ['implement'],
          executorType: 'function',
          executorConfig: { handler: 'validate' },
        })
        .build()

      const engine = await setupEngine(
        [workflow],
        new Map<string, any>([
          ['function', functionExecutor],
          ['sandbox', sandboxExecutor],
        ]),
      )
      const { runId } = await engine.start({
        workflowName: 'mixed_workflow',
        tenantId: TENANT,
        input: {},
      })
      const finalStatus = await waitForWorkflow(engine, runId, TENANT, [
        'COMPLETED',
        'FAILED',
      ])

      expect(finalStatus).toBe('COMPLETED')
      const status = await engine.getStatus(runId, TENANT)
      expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)
    },
    180_000,
  )
})
