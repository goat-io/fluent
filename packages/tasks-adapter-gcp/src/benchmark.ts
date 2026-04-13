/**
 * GCP Cloud Tasks Benchmark Script
 *
 * Run with: npx tsx src/benchmark.ts [mode]
 *
 * Modes:
 *   (default) - Run queue throughput benchmark
 *   payload   - Compare different payload sizes
 *   batch     - Compare different batch sizes
 *
 * Requires FIREBASE_SERVICE_ACCOUNT environment variable.
 *
 * Note: GCP Cloud Tasks is HTTP callback based, so we can only measure
 * queue throughput (enqueue rate). E2E and latency tests would require
 * a real HTTP endpoint to receive callbacks.
 */

import 'dotenv/config'
import type { TaskConnector } from '@goatlab/tasks-core'
import { ShouldQueue } from '@goatlab/tasks-core'
import { CloudTaskConnector } from './CloudTaskConnector.js'

// Configuration
const WARMUP_COUNT = 10
const BENCHMARK_DURATION_MS = 10000 // 10 seconds (GCP has rate limits)
const DEFAULT_BATCH_SIZE = 10 // Smaller batches for GCP rate limits

// Parse service account
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT
if (!serviceAccountBase64) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable is required')
  process.exit(1)
}

const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString(
  'utf8',
)
const gcpServiceAccount = JSON.parse(serviceAccountJson)

class BenchmarkTask extends ShouldQueue<{ index: number; data?: string }> {
  postUrl: string
  taskName: string

  constructor(
    connector: TaskConnector<{ index: number; data?: string }>,
    name: string,
  ) {
    super({ connector })
    this.taskName = name
    // Use httpbin to accept the POST (though we won't wait for it)
    this.postUrl = 'https://httpbin.org/post'
  }

  async handle(): Promise<undefined> {
    return undefined
  }
}

async function runQueueBenchmark(
  _connector: CloudTaskConnector,
  task: BenchmarkTask,
  batchSize: number = DEFAULT_BATCH_SIZE,
) {
  console.log('\n📊 Queue Throughput (enqueue to GCP)')
  console.log('='.repeat(50))
  console.log(`Batch size: ${batchSize}`)

  // Warmup
  console.log(`Warming up (${WARMUP_COUNT} tasks)...`)
  for (let i = 0; i < WARMUP_COUNT; i++) {
    try {
      await task.queue({ index: i })
    } catch (err: any) {
      console.log(`Warmup error: ${err.message}`)
    }
  }

  console.log(`Running for ${BENCHMARK_DURATION_MS / 1000}s...`)
  let count = 0
  let errors = 0
  const startTime = Date.now()
  const endTime = startTime + BENCHMARK_DURATION_MS

  while (Date.now() < endTime) {
    const promises = []
    for (let i = 0; i < batchSize; i++) {
      promises.push(
        task.queue({ index: count++ }).catch(_err => {
          errors++
          return null
        }),
      )
    }
    await Promise.all(promises)
  }

  const elapsed = Date.now() - startTime
  const successful = count - errors
  const throughput = (successful / elapsed) * 1000

  console.log(`✅ Attempted: ${count.toLocaleString()} tasks`)
  console.log(`✅ Successful: ${successful.toLocaleString()} tasks`)
  console.log(`❌ Errors: ${errors.toLocaleString()} tasks`)
  console.log(`✅ Throughput: ${throughput.toFixed(1)} tasks/sec`)

  return { throughput, successful, errors }
}

async function runSequentialBenchmark(
  _connector: CloudTaskConnector,
  task: BenchmarkTask,
) {
  console.log('\n📊 Sequential Queue (one at a time)')
  console.log('='.repeat(50))

  const count = 50
  const latencies: number[] = []

  for (let i = 0; i < count; i++) {
    const start = Date.now()
    try {
      await task.queue({ index: i })
      latencies.push(Date.now() - start)
    } catch (err: any) {
      console.log(`Error at ${i}: ${err.message}`)
    }
  }

  if (latencies.length === 0) {
    console.log('❌ No successful queues')
    return { avg: 0, p50: 0, p95: 0, throughput: 0 }
  }

  latencies.sort((a, b) => a - b)
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  const throughput = 1000 / avg

  console.log(`✅ Samples: ${latencies.length}`)
  console.log(
    `✅ Avg latency: ${avg.toFixed(0)}ms | P50: ${p50}ms | P95: ${p95}ms`,
  )
  console.log(`✅ Sequential throughput: ${throughput.toFixed(1)} tasks/sec`)

  return { avg, p50, p95, throughput }
}

async function runPayloadComparison(connector: CloudTaskConnector) {
  console.log('\n📊 Payload Size Comparison')
  console.log('='.repeat(50))

  const results: {
    size: string
    bytes: number
    throughput: number
    errors: number
  }[] = []

  const payloads = [
    { name: 'Tiny (100B)', data: 'x'.repeat(80) },
    { name: 'Small (1KB)', data: 'x'.repeat(900) },
    { name: 'Medium (10KB)', data: 'x'.repeat(10000) },
    { name: 'Large (50KB)', data: 'x'.repeat(50000) },
    // GCP Cloud Tasks has a 100KB limit for task payload
    { name: 'Max (95KB)', data: 'x'.repeat(95000) },
  ]

  for (const payload of payloads) {
    const bytes = JSON.stringify({ index: 0, data: payload.data }).length
    console.log(
      `\n📊 Payload: ${payload.name} (~${(bytes / 1024).toFixed(1)}KB)`,
    )

    const task = new BenchmarkTask(connector, `bench_payload_${Date.now()}`)
    task.postUrl = 'https://httpbin.org/post'

    // Smaller test for payload comparison
    const testDuration = 5000
    let count = 0
    let errors = 0
    const startTime = Date.now()
    const endTime = startTime + testDuration

    while (Date.now() < endTime) {
      try {
        await task.queue({ index: count++, data: payload.data })
      } catch (err: any) {
        errors++
        if (errors === 1) {
          console.log(`First error: ${err.message?.slice(0, 100)}`)
        }
      }
    }

    const elapsed = Date.now() - startTime
    const throughput = ((count - errors) / elapsed) * 1000

    console.log(
      `✅ Throughput: ${throughput.toFixed(1)} tasks/sec (${errors} errors)`,
    )
    results.push({ size: payload.name, bytes, throughput, errors })
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log('📈 PAYLOAD SIZE COMPARISON')
  console.log('='.repeat(50))
  const maxThroughput = Math.max(...results.map(r => r.throughput))
  for (const r of results) {
    const pct =
      maxThroughput > 0 ? Math.round((r.throughput / maxThroughput) * 100) : 0
    console.log(
      `${r.size.padEnd(15)} ${r.throughput.toFixed(1).padStart(8)} tasks/sec  (${pct.toString().padStart(3)}%)  ${r.errors} errors`,
    )
  }

  return results
}

async function runBatchComparison(connector: CloudTaskConnector) {
  console.log('\n📊 Batch Size Comparison')
  console.log('='.repeat(50))

  const results: { batchSize: number; throughput: number; errors: number }[] =
    []
  const batchSizes = [1, 5, 10, 20, 50]

  for (const batchSize of batchSizes) {
    console.log(`\n📊 Batch size: ${batchSize}`)

    const task = new BenchmarkTask(connector, `bench_batch_${Date.now()}`)

    const testDuration = 5000
    let count = 0
    let errors = 0
    const startTime = Date.now()
    const endTime = startTime + testDuration

    while (Date.now() < endTime) {
      const promises = []
      for (let i = 0; i < batchSize; i++) {
        promises.push(
          task.queue({ index: count++ }).catch(() => {
            errors++
            return null
          }),
        )
      }
      await Promise.all(promises)
    }

    const elapsed = Date.now() - startTime
    const throughput = ((count - errors) / elapsed) * 1000

    console.log(
      `✅ Throughput: ${throughput.toFixed(1)} tasks/sec (${errors} errors)`,
    )
    results.push({ batchSize, throughput, errors })
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log('📈 BATCH SIZE COMPARISON')
  console.log('='.repeat(50))
  const maxThroughput = Math.max(...results.map(r => r.throughput))
  for (const r of results) {
    const pct =
      maxThroughput > 0 ? Math.round((r.throughput / maxThroughput) * 100) : 0
    console.log(
      `Batch ${r.batchSize.toString().padStart(2)}:  ${r.throughput.toFixed(1).padStart(8)} tasks/sec  (${pct.toString().padStart(3)}%)  ${r.errors} errors`,
    )
  }

  return results
}

async function main() {
  console.log('🚀 GCP Cloud Tasks Benchmark')
  console.log('='.repeat(50))
  console.log(`Project: ${gcpServiceAccount.project_id}`)
  console.log(`Location: europe-west1`)
  console.log(`Queue: default`)
  console.log('')
  console.log('⚠️  Note: GCP Cloud Tasks has rate limits.')
  console.log('    Results may vary based on quota and network latency.')
  console.log('')

  const connector = new CloudTaskConnector({
    gcpServiceAccount,
    location: 'europe-west1',
    encryptionKey: 'benchmark-encryption-key-32ch!',
    gcpProject: gcpServiceAccount.project_id,
  })

  // Queue throughput test
  const task1 = new BenchmarkTask(connector, `bench_queue_${Date.now()}`)
  const queueResult = await runQueueBenchmark(
    connector,
    task1,
    DEFAULT_BATCH_SIZE,
  )

  // Sequential test (measures single-request latency)
  const task2 = new BenchmarkTask(connector, `bench_seq_${Date.now()}`)
  const seqResult = await runSequentialBenchmark(connector, task2)

  // Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log('📈 GCP CLOUD TASKS SUMMARY')
  console.log('='.repeat(50))
  console.log(
    `Parallel throughput:    ${queueResult.throughput.toFixed(1)} tasks/sec (batch=${DEFAULT_BATCH_SIZE})`,
  )
  console.log(
    `Sequential throughput:  ${seqResult.throughput.toFixed(1)} tasks/sec`,
  )
  console.log(`Avg queue latency:      ${seqResult.avg.toFixed(0)}ms`)
  console.log(`P95 queue latency:      ${seqResult.p95}ms`)
  console.log('')
  console.log(
    'Note: E2E throughput cannot be measured without an HTTP endpoint',
  )
  console.log('      to receive GCP callbacks.')
}

// CLI
const mode = process.argv[2]

if (mode === 'payload') {
  const connector = new CloudTaskConnector({
    gcpServiceAccount,
    location: 'europe-west1',
    encryptionKey: 'benchmark-encryption-key-32ch!',
    gcpProject: gcpServiceAccount.project_id,
  })
  runPayloadComparison(connector).catch(console.error)
} else if (mode === 'batch') {
  const connector = new CloudTaskConnector({
    gcpServiceAccount,
    location: 'europe-west1',
    encryptionKey: 'benchmark-encryption-key-32ch!',
    gcpProject: gcpServiceAccount.project_id,
  })
  runBatchComparison(connector).catch(console.error)
} else {
  main().catch(console.error)
}
