#!/usr/bin/env node
// Worker Node CLI — start a worker process
//
// Usage:
//   AGENTS_REDIS_URL=redis://localhost:6379 AGENTS_TENANT_ID=my-tenant node worker/cli.js start
//   AGENTS_REDIS_HOST=localhost AGENTS_REDIS_PORT=6379 node worker/cli.js start
//
import { WorkerNode } from './WorkerNode.js'

const command = process.argv[2]

if (command !== 'start') {
  console.log('Usage: worker-node start')
  console.log('')
  console.log('Environment variables:')
  console.log(
    '  AGENTS_REDIS_URL       Redis connection URL (e.g. redis://localhost:6379)',
  )
  console.log('  AGENTS_REDIS_HOST      Redis host (alternative to URL)')
  console.log('  AGENTS_REDIS_PORT      Redis port (default: 6379)')
  console.log(
    '  AGENTS_ENGINE_URL      Engine API URL for registration/heartbeat',
  )
  console.log('  AGENTS_WORKER_TOKEN    Worker auth token')
  console.log('  AGENTS_TENANT_ID       Tenant ID (default: "default")')
  console.log('  AGENTS_WORKER_NAME     Worker name (default: hostname)')
  process.exit(1)
}

async function main() {
  const worker = new WorkerNode()
  const caps = worker.detectResources()

  console.log(`[WorkerNode] Detected resources:`)
  console.log(`  CPU: ${caps.cpuCount} cores`)
  console.log(`  Memory: ${(caps.memoryMB / 1024).toFixed(1)} GB`)
  console.log(
    `  Docker: ${caps.dockerAvailable ? 'available' : 'not available'}`,
  )
  console.log(`  GPU: ${caps.gpuAvailable ? 'available' : 'not available'}`)
  console.log(`  Queues: ${caps.queues.join(', ')}`)
  console.log('')

  // Dynamic import to avoid hard dependency — user must have BullMQ installed
  const redisUrl = process.env.AGENTS_REDIS_URL
  const redisHost = process.env.AGENTS_REDIS_HOST ?? 'localhost'
  const redisPort = Number(process.env.AGENTS_REDIS_PORT ?? '6379')

  if (!redisUrl && !process.env.AGENTS_REDIS_HOST) {
    console.error('Error: AGENTS_REDIS_URL or AGENTS_REDIS_HOST must be set')
    process.exit(1)
  }

  try {
    const { BullMQConnector } = await import('@goatlab/tasks-adapter-bullmq')
    const { WorkflowEngine } = await import('../index.js')

    const connection = redisUrl
      ? { url: redisUrl }
      : { host: redisHost, port: redisPort }

    const connector = new BullMQConnector({ connection: connection as any })

    // Minimal engine — worker nodes process jobs dispatched by the main engine
    // The engine reference is needed for WorkflowStepTask to call onStepCompleted/onStepFailed
    // In production, this would connect to the same Postgres as the main engine
    console.log('[WorkerNode] Connecting to engine...')

    // Note: for a standalone worker, you need AGENTS_POSTGRES_URL set too
    // This CLI is a starting point — production deployments would extend this
    const { createDbClient } = await import('../db/DbClient.js')
    const pg = await import('pg')

    const pgUrl = process.env.AGENTS_POSTGRES_URL
    if (!pgUrl) {
      console.error('Error: AGENTS_POSTGRES_URL must be set for worker nodes')
      process.exit(1)
    }

    const pool = new pg.default.Pool({ connectionString: pgUrl, max: 5 })
    const db = createDbClient(pool)

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map(),
      workflows: new Map(),
      tenantId: process.env.AGENTS_TENANT_ID ?? 'default',
      disableLogBuffering: false,
    })

    await worker.start(engine, connector)

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n[WorkerNode] Shutting down...')
      await worker.stop()
      await engine.shutdown()
      await db.destroy()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (err) {
    console.error(`[WorkerNode] Failed to start: ${(err as Error).message}`)
    process.exit(1)
  }
}

main()
