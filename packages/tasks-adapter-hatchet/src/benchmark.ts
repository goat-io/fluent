/**
 * Hatchet Benchmark Script
 *
 * Run with: npx tsx src/benchmark.ts
 *
 * Uses testcontainers to spin up Hatchet + Postgres automatically.
 * Total runtime: ~45-60 seconds
 */

import type { TaskConnector } from '@goatlab/tasks-core'
import { ShouldQueue } from '@goatlab/tasks-core'
import { Network } from 'testcontainers'
import { HatchetConnector } from './HatchetConnector.js'
import { getHatchetContainer } from './test/hatchet.js'
import { getPostgres } from './test/postgres.js'

// Configuration - keep benchmarks short
const QUEUE_BATCH_SIZE = 50 // Smaller for Hatchet gRPC
const WARMUP_COUNT = 20
const BENCHMARK_DURATION_MS = 5000 // 5 seconds
const E2E_TASK_COUNT = 200
const LATENCY_SAMPLES = 20

class BenchmarkTask extends ShouldQueue<{ index: number }> {
  postUrl = 'http://localhost/benchmark'
  taskName = 'benchmark_task'

  constructor(connector: TaskConnector<{ index: number }>) {
    super({ connector })
  }

  async handle(): Promise<undefined> {
    return undefined
  }
}

async function runQueueBenchmark(
  connector: HatchetConnector,
  task: BenchmarkTask
) {
  console.log('\n📊 Queue Throughput (queue-only)')
  console.log('='.repeat(50))

  // Start worker (required for Hatchet)
  await connector.startWorker({
    tasks: [task],
    workerName: 'benchmark-worker',
    slots: 100
  })
  await new Promise(r => setTimeout(r, 2000))

  // Warmup
  for (let i = 0; i < WARMUP_COUNT; i++) {
    await task.queue({ index: i })
  }

  console.log(`Running for ${BENCHMARK_DURATION_MS / 1000}s...`)
  let count = 0
  const startTime = Date.now()
  const endTime = startTime + BENCHMARK_DURATION_MS

  while (Date.now() < endTime) {
    const promises = []
    for (let i = 0; i < QUEUE_BATCH_SIZE; i++) {
      promises.push(task.queue({ index: count++ }))
    }
    await Promise.all(promises)
  }

  const elapsed = Date.now() - startTime
  const throughput = (count / elapsed) * 1000

  console.log(`✅ Queued: ${count.toLocaleString()} tasks`)
  console.log(`✅ Throughput: ${throughput.toFixed(0)} tasks/sec`)

  return throughput
}

async function runE2EBenchmark(
  connector: HatchetConnector,
  task: BenchmarkTask
) {
  console.log('\n📊 End-to-End (queue + worker)')
  console.log('='.repeat(50))

  await connector.startWorker({
    tasks: [task],
    workerName: 'e2e-worker',
    slots: 100
  })
  await new Promise(r => setTimeout(r, 2000))

  console.log(`Queuing ${E2E_TASK_COUNT} tasks...`)
  const start = Date.now()
  const taskIds: string[] = []

  // Queue tasks
  for (let i = 0; i < E2E_TASK_COUNT; i += QUEUE_BATCH_SIZE) {
    const batch = []
    for (let j = 0; j < QUEUE_BATCH_SIZE && i + j < E2E_TASK_COUNT; j++) {
      batch.push(task.queue({ index: i + j }))
    }
    const results = await Promise.all(batch)
    taskIds.push(...results.map(r => r.id))
  }

  const queueTime = Date.now() - start

  // Wait for completion by sampling (max 20s)
  const timeout = 20000
  let completed = 0
  const waitStart = Date.now()

  while (completed < E2E_TASK_COUNT && Date.now() - waitStart < timeout) {
    const sampleSize = Math.min(10, taskIds.length)
    let sampleCompleted = 0

    for (let i = 0; i < sampleSize; i++) {
      try {
        const status = await task.getStatus(taskIds[i])
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          sampleCompleted++
        }
      } catch {
        // ignore
      }
    }

    completed = Math.floor((sampleCompleted / sampleSize) * E2E_TASK_COUNT)
    if (completed < E2E_TASK_COUNT) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const totalTime = Date.now() - start
  const throughput = (completed / totalTime) * 1000

  console.log(`✅ Processed: ~${completed.toLocaleString()} tasks`)
  console.log(`✅ Queue time: ${queueTime}ms`)
  console.log(`✅ Total time: ${totalTime}ms`)
  console.log(`✅ Throughput: ~${throughput.toFixed(0)} tasks/sec`)

  return throughput
}

async function runLatencyBenchmark(
  connector: HatchetConnector,
  task: BenchmarkTask
) {
  console.log('\n📊 Latency (round-trip)')
  console.log('='.repeat(50))

  await connector.startWorker({
    tasks: [task],
    workerName: 'latency-worker',
    slots: 10
  })
  await new Promise(r => setTimeout(r, 2000))

  const latencies: number[] = []

  for (let i = 0; i < LATENCY_SAMPLES; i++) {
    const start = Date.now()
    const status = await task.queue({ index: i })

    // Poll for completion (max 5s per task)
    const timeout = Date.now() + 5000
    while (Date.now() < timeout) {
      try {
        const currentStatus = await task.getStatus(status.id)
        if (
          currentStatus.status === 'COMPLETED' ||
          currentStatus.status === 'FAILED'
        ) {
          latencies.push(Date.now() - start)
          break
        }
      } catch {
        // ignore
      }
      await new Promise(r => setTimeout(r, 50))
    }
  }

  if (latencies.length === 0) {
    console.log('❌ No tasks completed')
    return { avg: 0, p50: 0, p95: 0, p99: 0 }
  }

  latencies.sort((a, b) => a - b)
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  const p99 = latencies[Math.floor(latencies.length * 0.99)]

  console.log(`✅ Samples: ${latencies.length}`)
  console.log(
    `✅ Avg: ${avg.toFixed(1)}ms | P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`
  )

  return { avg, p50, p95, p99 }
}

async function main() {
  console.log('🚀 Hatchet Benchmark')
  console.log('Starting containers (Postgres + Hatchet)...')

  const network = await new Network().start()
  const postgresContainer = await getPostgres({ network }).start()

  const connection = {
    host: postgresContainer.getName().replace('/', ''),
    port: postgresContainer.getMappedPort(5432),
    database: postgresContainer.getDatabase(),
    user: postgresContainer.getUsername(),
    password: postgresContainer.getPassword()
  }

  const postgresUri = `postgresql://${connection.user}:${connection.password}@db:5432/${connection.database}`

  const hatchetContainer = await getHatchetContainer({
    postgresConnectionString: postgresUri,
    network: network
  }).start()

  const cmd = await hatchetContainer.exec(
    '/hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs'
  )
  const token = cmd.stdout.trim()

  const hostAndPort = `localhost:${hatchetContainer.getMappedPort(7077)}`
  const apiUrl = `http://localhost:${hatchetContainer.getMappedPort(8888)}`

  console.log(`Hatchet gRPC: ${hostAndPort}`)
  console.log(`Hatchet API: ${apiUrl}`)

  try {
    // Queue throughput test
    const connector1 = new HatchetConnector({
      token,
      hostAndPort,
      apiUrl,
      logLevel: 'WARN'
    })
    const task1 = new BenchmarkTask(connector1)
    const queueThroughput = await runQueueBenchmark(connector1, task1)

    // E2E test
    const connector2 = new HatchetConnector({
      token,
      hostAndPort,
      apiUrl,
      logLevel: 'WARN'
    })
    const task2 = new BenchmarkTask(connector2)
    const e2eThroughput = await runE2EBenchmark(connector2, task2)

    // Latency test
    const connector3 = new HatchetConnector({
      token,
      hostAndPort,
      apiUrl,
      logLevel: 'WARN'
    })
    const task3 = new BenchmarkTask(connector3)
    const latency = await runLatencyBenchmark(connector3, task3)

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📈 HATCHET SUMMARY')
    console.log('='.repeat(50))
    console.log(`Queue throughput:  ${queueThroughput.toFixed(0)} tasks/sec`)
    console.log(`E2E throughput:    ~${e2eThroughput.toFixed(0)} tasks/sec`)
    console.log(`Latency (avg):     ${latency.avg.toFixed(1)}ms`)
    console.log(`Latency (p95):     ${latency.p95}ms`)
  } finally {
    console.log('\nStopping containers...')
    await hatchetContainer.stop()
    await postgresContainer.stop()
    await network.stop()
  }
}

main().catch(console.error)
