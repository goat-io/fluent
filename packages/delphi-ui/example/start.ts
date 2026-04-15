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
  ClaudeCodeExecutor,
  createWorkflowHandlers,
  createBrokerHandlers,
  AgentRegistry,
  CREATE_TABLES_SQL,
} from '@goatlab/delphi-core'
import { generateAgentScript } from '@goatlab/delphi-core/dist/broker/agentScript.js'
import type { Database } from '@goatlab/delphi-core'
import type { StepPayload, StepResult } from '@goatlab/delphi-core'

const PORT = 4444
const TENANT = 'demo'

import os from 'node:os'

import { execSync } from 'node:child_process'

function getNetworkIp(): string {
  // Prefer Tailscale IP (reachable from anywhere on tailnet)
  try {
    const tsIp = execSync('tailscale ip -4', { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim()
    if (tsIp) return tsIp
  } catch {}

  // Fallback to LAN IP
  return getLanIp()
}

function getLanIp(): string {
  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces) as any[]) {
    for (const cfg of iface ?? []) {
      if (cfg.family === 'IPv4' && !cfg.internal && !cfg.address.startsWith('100.')) return cfg.address
    }
  }
  return 'localhost'
}

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

// Claude Code workflow — asks Claude to do real work via the CLI
const claudeAnalyzer = WorkflowBuilder.create('claude_analyzer')
  .version('1.0.0')
  .step('analyze', {
    executorType: 'claude_code',
    executorConfig: {
      prompt: '{{input.task}}',
      appendSystemPrompt: 'Be concise. Respond in 2-3 sentences max.',
      model: 'sonnet',
      effort: 'low',
      maxTurns: 1,
      outputFormat: 'text',
      timeoutMs: 60_000,
    },
  })
  .build()

// Multi-step Claude workflow — research then summarize
const claudeResearch = WorkflowBuilder.create('claude_research')
  .version('1.0.0')
  .step('research', {
    executorType: 'claude_code',
    executorConfig: {
      prompt: '{{input.topic}} — research this topic thoroughly. Use web search if needed.',
      model: 'sonnet',
      effort: 'high',
      maxTurns: 5,
      allowedTools: ['Bash', 'Read', 'WebSearch', 'WebFetch'],
      outputFormat: 'text',
      timeoutMs: 120_000,
    },
  })
  .step('summarize', {
    dependsOn: ['research'],
    executorType: 'claude_code',
    executorConfig: {
      prompt: 'Summarize the following research into 3 bullet points:\n\n{{input.result}}',
      model: 'haiku',
      effort: 'low',
      maxTurns: 1,
      outputFormat: 'text',
      timeoutMs: 30_000,
    },
    mapInput: (upstream) => ({ result: (upstream.research as any)?.result ?? '' }),
  })
  .build()

// Claude codebase analyzer — reads a repo and answers questions about it
const codeReview = WorkflowBuilder.create('code_review')
  .version('1.0.0')
  .step('review', {
    executorType: 'claude_code',
    executorConfig: {
      prompt: 'The codebase is at {{input.repo_path}}. Question: {{input.question}}',
      appendSystemPrompt: 'You are a senior engineer analyzing a codebase. Use Read, Glob, Grep, and Bash tools to explore the code and answer thoroughly. Be specific with file names and line numbers.',
      model: 'sonnet',
      effort: 'high',
      maxTurns: 15,
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
      outputFormat: 'text',
      timeoutMs: 180_000,
    },
  })
  .build()

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║    🐐 Goat Agents — Live Example             ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  // Start containers
  console.log('📦 Starting Postgres...')
  const pgContainer = await new PostgreSqlContainer('postgres:18-alpine')
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
  const claudeExecutor = new ClaudeCodeExecutor()
  const workflows = new Map([
    ['sdlc_pipeline', sdlcPipeline],
    ['quick_task', quickTask],
    ['flaky_pipeline', flakyPipeline],
    ['claude_analyzer', claudeAnalyzer],
    ['claude_research', claudeResearch],
    ['code_review', codeReview],
  ])

  const engine = new WorkflowEngine({
    db,
    connector,
    executors: new Map<string, any>([['function', executor], ['claude_code', claudeExecutor]]),
    workflows,
    tenantId: TENANT,
    disableLogBuffering: true,
  })

  // API handlers
  const handlers = createWorkflowHandlers(engine)

  // Broker for remote agent connections
  const agentRegistry = new AgentRegistry({
    maxPendingJobs: 1000,
    sweepIntervalMs: 10_000,
    agentStaleAfterMs: 90_000,
    defaultJobTimeoutMs: 300_000,
  })
  agentRegistry.startSweep()
  const brokerHandlers = createBrokerHandlers({ db, registry: agentRegistry })

  // WorkerBroker: consumes from BullMQ and dispatches to remote agents via HTTP
  const { WorkerBroker } = await import('@goatlab/delphi-core')
  const broker = new WorkerBroker({ engine, registry: agentRegistry })
  await broker.start(connector)
  console.log('⚡ WorkerBroker running — jobs route from BullMQ to remote agents\n')

  // ── SSE: track connected clients per workflow run ──────────
  const sseClients = new Map<string, Set<http.ServerResponse>>()
  const sseWorkerClients = new Set<http.ServerResponse>()

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

  // Poll workers every 2s and push to SSE clients
  const sseWorkerPoller = setInterval(async () => {
    if (sseWorkerClients.size === 0) return
    try {
      const workers = await handlers.listWorkers({ tenantId: TENANT })
      const msg = `data: ${JSON.stringify({ type: 'workersUpdate', workers })}\n\n`
      for (const client of sseWorkerClients) {
        try { client.write(msg) } catch { sseWorkerClients.delete(client) }
      }
    } catch {}
  }, 2000)

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

    // ── Agent script endpoint (self-contained, no install needed) ──
    if (url.pathname === '/agent/run' && req.method === 'GET') {
      const token = url.searchParams.get('token')
      if (!token) { res.writeHead(400); res.end('token required'); return }
      const queuesParam = url.searchParams.get('queues')
      const queues = queuesParam ? queuesParam.split(',') : undefined
      const script = generateAgentScript(`http://${getNetworkIp()}:${PORT}`, token, TENANT, queues)
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      res.end(script)
      return
    }

    // ── Workers SSE endpoint ─────────────────────────────────
    if (url.pathname === '/workers/subscribe' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

      sseWorkerClients.add(res)

      // Send immediate snapshot
      try {
        const workers = await handlers.listWorkers({ tenantId: TENANT })
        res.write(`data: ${JSON.stringify({ type: 'workersUpdate', workers })}\n\n`)
      } catch {}

      req.on('close', () => { sseWorkerClients.delete(res) })
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
        const filters: any = { tenantId: TENANT }
        if (url.searchParams.get('workflowName')) filters.workflowName = url.searchParams.get('workflowName')
        if (url.searchParams.get('status')) filters.status = url.searchParams.get('status')!.split(',')
        if (url.searchParams.get('limit')) filters.limit = Number(url.searchParams.get('limit'))
        if (url.searchParams.get('offset')) filters.offset = Number(url.searchParams.get('offset'))
        result = await handlers.listWorkflows(filters)
      } else if (url.pathname === '/workflows/definitions') {
        result = await handlers.listDefinitions()
      } else if (url.pathname === '/workflows/definition') {
        result = await handlers.getDefinition(body)
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
      } else if (url.pathname === '/workflows/metrics') {
        result = await handlers.getRunMetrics(body)
      } else if (url.pathname === '/workflows/aggregate-metrics') {
        result = await handlers.getAggregateMetrics({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/workflows/validate') {
        result = await handlers.validateDefinition(body)
      } else if (url.pathname === '/workflows/ingest-event') {
        result = await handlers.ingestEvent({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/workflows/start-batch') {
        const wfs = (body.workflows || []).map((w: any) => ({ ...w, tenantId: TENANT }))
        result = await handlers.startBatch({ workflows: wfs })
      } else if (url.pathname === '/workers/update-queues') {
        result = await handlers.updateWorkerQueues(body)
      } else if (url.pathname === '/workers/list') {
        result = await handlers.listWorkers({ tenantId: TENANT })
      } else if (url.pathname === '/workers/generate-token') {
        // Generate token with primary IP, then add LAN IP as alternative
        const primaryIp = getNetworkIp()
        const lanIp = getLanIp()
        const tokenResult = await handlers.generateWorkerToken({ tenantId: TENANT, engineUrl: `http://${primaryIp}:${PORT}`, queues: body.queues })
        // Add LAN command if primary is Tailscale
        if (primaryIp !== lanIp) {
          const queueParam = body.queues?.length ? `&queues=${body.queues.join(',')}` : ''
          ;(tokenResult as any).lanCommand = `curl -fsSL 'http://${lanIp}:${PORT}/agent/run?token=${tokenResult.token}${queueParam}' | node`
        }
        result = tokenResult
      } else if (url.pathname === '/health') {
        result = { ok: true }

      // ── Agent / Broker endpoints ────────────────────────
      } else if (url.pathname === '/agents/token') {
        result = await brokerHandlers.generateAgentToken({ tenantId: TENANT })
      } else if (url.pathname === '/agents/register') {
        result = await brokerHandlers.register({ ...body, tenantId: TENANT })
      } else if (url.pathname === '/agents/next-job') {
        result = await brokerHandlers.nextJob(body)
      } else if (url.pathname === '/agents/step-started') {
        result = await brokerHandlers.stepStarted(body)
      } else if (url.pathname === '/agents/step-result') {
        result = await brokerHandlers.stepResult(body)
      } else if (url.pathname === '/agents/step-failed') {
        result = await brokerHandlers.stepFailed(body)
      } else if (url.pathname === '/agents/heartbeat') {
        result = await brokerHandlers.heartbeat(body)
      } else if (url.pathname === '/agents/deregister') {
        result = await brokerHandlers.deregister(body)
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

  server.listen(PORT, '0.0.0.0', async () => {
    const ip = getNetworkIp()
    console.log(`🌐 API ready on http://localhost:${PORT}`)
    console.log(`🌐 Network:    http://${ip}:${PORT}\n`)

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
    console.log('   $ cd packages/delphi-ui && VITE_API_URL=http://localhost:4444 pnpm dev\n')
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
    clearInterval(sseWorkerPoller)
    agentRegistry.stopSweep()
    server.close()
    await broker.stop()
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
