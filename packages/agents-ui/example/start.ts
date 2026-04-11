#!/usr/bin/env tsx
/**
 * Live example: Full agent workflow system with dashboard.
 *
 * Starts everything you need:
 *   - Postgres (testcontainer)
 *   - Redis (testcontainer)
 *   - Backend API (port 4444)
 *   - BullMQ worker
 *   - Seeds 3 demo workflows
 *
 * Then run the Vite UI separately: pnpm dev
 * Or explore with: npx playwright open http://localhost:5173
 *
 * Usage: npx tsx example/start.ts
 */
import http from 'node:http'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import {
  WorkflowEngine,
  WorkflowBuilder,
  WorkflowStepTask,
  FunctionStepExecutor,
  createWorkflowHandlers,
  CREATE_TABLES_SQL,
} from '@goatlab/agents-core'
import type { Database } from '@goatlab/agents-core'
import type { StepPayload, StepResult } from '@goatlab/agents-core'

const PORT = 4444
const TENANT = 'demo'

// ── Step handlers (simulated agents) ─────────────────────────────

function createDemoExecutor(): FunctionStepExecutor {
  const executor = new FunctionStepExecutor()

  executor.register('analyze', async (p: StepPayload): Promise<StepResult> => {
    await sleep(800)
    return {
      output: {
        summary: 'Feature analysis complete',
        requirements: ['Authentication flow', 'Dashboard widget', 'API endpoint'],
        complexity: 'medium',
        estimatedHours: 16,
      },
    }
  })

  executor.register('plan', async (p: StepPayload): Promise<StepResult> => {
    await sleep(600)
    return {
      output: {
        tasks: [
          { id: 'T-1', title: 'Design auth schema', estimate: '2h', assignee: 'backend-agent' },
          { id: 'T-2', title: 'Build login API', estimate: '4h', assignee: 'backend-agent' },
          { id: 'T-3', title: 'Create dashboard component', estimate: '6h', assignee: 'frontend-agent' },
          { id: 'T-4', title: 'Write integration tests', estimate: '4h', assignee: 'qa-agent' },
        ],
        approved: true,
        methodology: 'agile-sprint',
      },
    }
  })

  executor.register('implement', async (p: StepPayload): Promise<StepResult> => {
    await sleep(1200)
    return {
      output: {
        branch: 'feat/user-dashboard',
        commits: 3,
        filesChanged: 12,
        linesAdded: 485,
        linesRemoved: 23,
        pullRequest: 'PR-42',
        testsAdded: 8,
      },
    }
  })

  executor.register('review', async (_p: StepPayload): Promise<StepResult> => {
    // This step PAUSES for human approval
    return {
      output: {
        reviewReady: true,
        prUrl: 'https://github.com/org/repo/pull/42',
        changedFiles: ['src/auth/login.ts', 'src/dashboard/Widget.tsx', 'src/api/routes.ts'],
      },
      waitForHuman: {
        prompt: 'Code review needed for PR-42. Please review the implementation and approve or request changes.',
        schema: {
          type: 'object',
          properties: {
            approved: { type: 'boolean', description: 'Approve the changes?' },
            comment: { type: 'string', description: 'Review feedback' },
          },
        },
      },
    }
  })

  executor.register('deploy', async (p: StepPayload): Promise<StepResult> => {
    await sleep(500)
    return {
      output: {
        environment: 'production',
        version: '2.1.0',
        url: 'https://app.example.com',
        deployedAt: new Date().toISOString(),
        healthCheck: 'passing',
      },
    }
  })

  // Simple echo handler for quick workflows
  executor.register('echo', async (p: StepPayload): Promise<StepResult> => {
    await sleep(200)
    return { output: { echoed: true, received: p.input } }
  })

  executor.register('fail_sometimes', async (_p: StepPayload): Promise<StepResult> => {
    if (Math.random() < 0.5) throw new Error('Transient failure — will retry')
    return { output: { recovered: true } }
  })

  return executor
}

// ── Workflow definitions ─────────────────────────────────────────

const sdlcPipeline = WorkflowBuilder.create('sdlc_pipeline')
  .version('1.0.0')
  .defaultRetries(3)
  .step('analyze', {
    executorType: 'function',
    executorConfig: { handler: 'analyze' },
  })
  .step('plan', {
    dependsOn: ['analyze'],
    executorType: 'function',
    executorConfig: { handler: 'plan' },
    mapInput: (up) => ({ analysis: up.analyze }),
  })
  .step('implement', {
    dependsOn: ['plan'],
    executorType: 'function',
    executorConfig: { handler: 'implement' },
    mapInput: (up) => ({ plan: up.plan }),
  })
  .step('review', {
    dependsOn: ['implement'],
    executorType: 'function',
    executorConfig: { handler: 'review' },
  })
  .step('deploy', {
    dependsOn: ['review'],
    executorType: 'function',
    executorConfig: { handler: 'deploy' },
  })
  .build()

const quickTask = WorkflowBuilder.create('quick_task')
  .version('1.0.0')
  .step('process', {
    executorType: 'function',
    executorConfig: { handler: 'echo' },
  })
  .step('validate', {
    dependsOn: ['process'],
    executorType: 'function',
    executorConfig: { handler: 'echo' },
  })
  .build()

const flakyPipeline = WorkflowBuilder.create('flaky_pipeline')
  .version('1.0.0')
  .defaultRetries(5)
  .step('start', {
    executorType: 'function',
    executorConfig: { handler: 'echo' },
  })
  .step('unreliable', {
    dependsOn: ['start'],
    executorType: 'function',
    executorConfig: { handler: 'fail_sometimes' },
    retries: 5,
  })
  .step('finish', {
    dependsOn: ['unreliable'],
    executorType: 'function',
    executorConfig: { handler: 'echo' },
  })
  .build()

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║    🐐 Goat Agents — Live Example             ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  // Start containers
  console.log('📦 Starting Postgres...')
  const pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('agents_example')
    .start()

  console.log('📦 Starting Redis...')
  const redisContainer = await new RedisContainer('redis:7-alpine').start()

  // Database
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        host: pgContainer.getHost(),
        port: pgContainer.getMappedPort(5432),
        database: 'agents_example',
        user: pgContainer.getUsername(),
        password: pgContainer.getPassword(),
        max: 10,
      }),
    }),
  })

  const statements = CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) await sql.raw(stmt).execute(db)
  console.log('✅ Database ready\n')

  // BullMQ
  const connector = new BullMQConnector({
    connection: {
      host: redisContainer.getHost(),
      port: redisContainer.getMappedPort(6379),
    },
  })

  // Engine
  const executor = createDemoExecutor()
  const workflows = new Map([
    ['sdlc_pipeline', sdlcPipeline],
    ['quick_task', quickTask],
    ['flaky_pipeline', flakyPipeline],
  ])

  const engine = new WorkflowEngine({
    db,
    connector,
    executors: new Map([['function', executor]]),
    workflows,
    tenantId: TENANT,
    disableLogBuffering: true,
  })

  // Worker
  const stepTask = new WorkflowStepTask(engine)
  stepTask.setConnector(connector)
  const workerHandle = await connector.listen({
    tasks: [{
      taskName: stepTask.taskName,
      handle: (data: unknown) => stepTask.handle(data as StepPayload),
    }],
    defaultConcurrency: 5,
  })
  console.log('⚡ BullMQ worker running\n')

  // API handlers
  const handlers = createWorkflowHandlers(engine)

  // ── SSE: track connected clients per workflow run ──────────
  const sseClients = new Map<string, Set<http.ServerResponse>>()

  function broadcastWorkflowUpdate(runId: string, data: any) {
    const clients = sseClients.get(runId)
    if (!clients || clients.size === 0) return
    const payload = `data: ${JSON.stringify(data)}\n\n`
    for (const res of clients) {
      try { res.write(payload) } catch { clients.delete(res) }
    }
  }

  // Poll active workflows every 1s and push changes to SSE clients
  const ssePoller = setInterval(async () => {
    for (const [runId, clients] of sseClients) {
      if (clients.size === 0) { sseClients.delete(runId); continue }
      try {
        const status = await engine.getStatus(runId, TENANT)
        broadcastWorkflowUpdate(runId, {
          type: 'workflowUpdate',
          workflow: {
            id: status.id,
            status: status.status,
            output: status.output,
            completedAt: status.completedAt,
            steps: status.steps.map(s => ({
              stepName: s.stepName,
              status: s.status,
              attempt: s.attempt,
              output: s.output,
              error: s.error,
              startedAt: s.startedAt,
              completedAt: s.completedAt,
              humanPrompt: (s as any).humanPrompt,
            })),
          },
        })
      } catch { /* workflow might not exist */ }
    }
  }, 1000)

  // HTTP server
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

    // ── SSE endpoint ───────────────────────────────────────
    if (url.pathname === '/workflows/subscribe' && req.method === 'GET') {
      const runId = url.searchParams.get('runId')
      if (!runId) { res.writeHead(400); res.end('runId required'); return }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

      // Register client
      if (!sseClients.has(runId)) sseClients.set(runId, new Set())
      sseClients.get(runId)!.add(res)

      // Send immediate snapshot
      try {
        const status = await engine.getStatus(runId, TENANT)
        res.write(`data: ${JSON.stringify({ type: 'workflowUpdate', workflow: status })}\n\n`)
      } catch {}

      // Cleanup on disconnect
      req.on('close', () => {
        sseClients.get(runId)?.delete(res)
      })
      return
    }

    try {
      let body: any = {}
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        body = JSON.parse(Buffer.concat(chunks).toString())
      }

      let result: any

      if (url.pathname === '/workflows' && req.method === 'GET') {
        result = await handlers.listWorkflows({ tenantId: TENANT })
      } else if (url.pathname === '/workflows/start') {
        result = await handlers.start({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/workflows/status') {
        result = await handlers.getStatus({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/workflows/cancel') {
        result = await handlers.cancel({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/workflows/human-input') {
        result = await handlers.submitHumanInput({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/workflows/signal') {
        result = await handlers.signal({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/workflows/query') {
        result = await handlers.query({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/health') {
        result = { ok: true }
      } else {
        res.writeHead(404); res.end('Not found'); return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (err: any) {
      res.writeHead(err.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
  })

  server.listen(PORT, async () => {
    console.log(`🌐 API ready on http://localhost:${PORT}\n`)

    // Seed demo workflows
    console.log('🌱 Seeding demo workflows...\n')

    const { runId: r1 } = await engine.start({
      workflowName: 'sdlc_pipeline',
      tenantId: TENANT,
      input: { feature: 'Add user dashboard with activity feed' },
    })
    console.log(`   📋 sdlc_pipeline → ${r1} (will pause at review for your approval)`)

    const { runId: r2 } = await engine.start({
      workflowName: 'quick_task',
      tenantId: TENANT,
      input: { task: 'Run health checks' },
    })
    console.log(`   📋 quick_task    → ${r2} (completes quickly)`)

    const { runId: r3 } = await engine.start({
      workflowName: 'flaky_pipeline',
      tenantId: TENANT,
      input: { task: 'Deploy with retries' },
    })
    console.log(`   📋 flaky_pipeline → ${r3} (may retry on failures)`)

    console.log('\n' + '─'.repeat(50))
    console.log('\n🎯 Now open the dashboard:\n')
    console.log('   Option 1: Start Vite dev server')
    console.log('   $ cd packages/agents-ui && VITE_API_URL=http://localhost:4444 pnpm dev\n')
    console.log('   Option 2: Explore with Playwright')
    console.log('   $ npx playwright open http://localhost:5173\n')
    console.log('─'.repeat(50))
    console.log('\n💡 The SDLC pipeline will pause at the "review" step.')
    console.log('   Click it in the UI to see the approval form and approve it!\n')
  })

  // Shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...')
    clearInterval(ssePoller)
    server.close()
    await workerHandle.stop()
    await connector.close()
    await engine.shutdown()
    await db.destroy()
    await redisContainer.stop()
    await pgContainer.stop()
    console.log('👋 Bye!')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
