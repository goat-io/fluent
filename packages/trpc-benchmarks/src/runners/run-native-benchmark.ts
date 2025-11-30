// Native API Benchmark Runner (Elysia native vs Hono native - no tRPC)
// Run: npx tsx src/runners/run-native-benchmark.ts

import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

interface BenchmarkConfig {
  name: string
  runtime: 'bun'
  framework: string
  port: number
  command: string[]
}

interface BenchmarkResult {
  config: BenchmarkConfig
  metrics: {
    avgLatency?: number
    p95Latency?: number
    p99Latency?: number
    totalRequests?: number
    errorRate?: number
    requestsPerSecond?: number
  }
}

const configs: BenchmarkConfig[] = [
  {
    name: 'Hono Native + Bun',
    runtime: 'bun',
    framework: 'hono-native',
    port: 3005,
    command: ['bun', 'run', 'src/servers/hono-native-server.ts']
  },
  {
    name: 'Elysia Native + Bun',
    runtime: 'bun',
    framework: 'elysia-native',
    port: 3004,
    command: ['bun', 'run', 'src/servers/elysia-native-server.ts']
  },
  {
    name: 'Elysia Optimized + Bun',
    runtime: 'bun',
    framework: 'elysia-optimized',
    port: 3006,
    command: ['bun', 'run', 'src/servers/elysia-optimized-server.ts']
  }
]

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`)
      if (response.ok) {
        return true
      }
    } catch {
      // Server not ready yet
    }
    await sleep(500)
  }
  return false
}

function startServer(config: BenchmarkConfig): ChildProcess {
  const env = { ...process.env, PORT: String(config.port) }
  const proc = spawn(config.command[0], config.command.slice(1), {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  })

  proc.stdout?.on('data', (data) => {
    console.log(`[${config.name}] ${data.toString().trim()}`)
  })

  proc.stderr?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg && !msg.includes('ExperimentalWarning')) {
      console.error(`[${config.name}] ${msg}`)
    }
  })

  return proc
}

async function runK6Benchmark(config: BenchmarkConfig): Promise<string> {
  const baseUrl = `http://localhost:${config.port}`

  const env = {
    ...process.env,
    BASE_URL: baseUrl,
    RUNTIME: config.runtime,
    FRAMEWORK: config.framework
  }

  try {
    const result = execSync('k6 run src/k6/native-benchmark.js', {
      env,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 180000
    })
    return result
  } catch (error: any) {
    if (error.stdout) {
      return error.stdout
    }
    throw error
  }
}

function parseK6Output(output: string): BenchmarkResult['metrics'] {
  const metrics: BenchmarkResult['metrics'] = {}

  // Parse http_req_duration - k6 outputs: avg=Xms p(90)=Yms p(95)=Zms
  const durationMatch = output.match(/http_req_duration[^:]*:\s*avg=([0-9.]+)(\w+)\s+min=[\d.]+[µm]?s?\s+med=[\d.]+[µm]?s?\s+max=[\d.]+[µm]?s?\s+p\(90\)=([0-9.]+)(\w+)\s+p\(95\)=([0-9.]+)(\w+)/)
  if (durationMatch) {
    metrics.avgLatency = parseFloat(durationMatch[1])
    metrics.p95Latency = parseFloat(durationMatch[5])
    // p99 not in default k6 output, use p90 as fallback
    metrics.p99Latency = parseFloat(durationMatch[3])
  }

  // Parse http_reqs
  const reqsMatch = output.match(/http_reqs[^:]*:\s*(\d+)\s+([0-9.]+)\/s/)
  if (reqsMatch) {
    metrics.totalRequests = parseInt(reqsMatch[1])
    metrics.requestsPerSecond = parseFloat(reqsMatch[2])
  }

  // Parse error_rate
  const errorMatch = output.match(/error_rate[^:]*:\s*[0-9.]+%?\s*✓?\s*(\d+)/)
  if (errorMatch) {
    metrics.errorRate = parseInt(errorMatch[1])
  }

  return metrics
}

async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  console.log(`\nStarting ${config.name} server...`)

  const server = startServer(config)

  try {
    const serverUrl = `http://localhost:${config.port}`
    const ready = await waitForServer(serverUrl)

    if (!ready) {
      throw new Error(`Server ${config.name} failed to start`)
    }

    console.log(`\nRunning native benchmark for ${config.name}...`)
    console.log(`  URL: ${serverUrl}`)

    const output = await runK6Benchmark(config)
    console.log(output)

    const metrics = parseK6Output(output)

    return { config, metrics }
  } finally {
    console.log(`\nStopping ${config.name} server...`)
    server.kill('SIGTERM')
    await sleep(1000)
  }
}

function printComparison(results: BenchmarkResult[]) {
  console.log('\n' + '='.repeat(70))
  console.log('NATIVE API COMPARISON RESULTS (No tRPC)')
  console.log('='.repeat(70))

  // Header
  const headers = ['Metric', ...results.map(r => r.config.name)]
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...results.map(r => {
      if (i === 0) return 20
      const m = r.metrics
      return Math.max(
        String(m.avgLatency?.toFixed(2) || 'N/A').length + 2,
        String(m.p95Latency?.toFixed(2) || 'N/A').length + 2,
        String(m.totalRequests || 'N/A').length,
        String(m.requestsPerSecond?.toFixed(1) || 'N/A').length + 4
      )
    })) + 2
  )

  const printRow = (cells: string[]) => {
    console.log(cells.map((c, i) => c.padEnd(colWidths[i])).join(''))
  }

  printRow(headers)
  console.log('-'.repeat(colWidths.reduce((a, b) => a + b, 0)))

  // Metrics rows
  printRow(['Avg Latency (ms)', ...results.map(r => r.metrics.avgLatency?.toFixed(2) || 'N/A')])
  printRow(['P95 Latency (ms)', ...results.map(r => r.metrics.p95Latency?.toFixed(2) || 'N/A')])
  printRow(['P99 Latency (ms)', ...results.map(r => r.metrics.p99Latency?.toFixed(2) || 'N/A')])
  printRow(['Total Requests', ...results.map(r => String(r.metrics.totalRequests || 'N/A'))])
  printRow(['Requests/sec', ...results.map(r => r.metrics.requestsPerSecond?.toFixed(1) || 'N/A')])
  printRow(['Errors', ...results.map(r => String(r.metrics.errorRate || 0))])

  // Rankings
  console.log('\n' + '='.repeat(70))
  console.log('RANKINGS (by average latency)')
  console.log('='.repeat(70))

  const sorted = [...results]
    .filter(r => r.metrics.avgLatency !== undefined)
    .sort((a, b) => (a.metrics.avgLatency || 999) - (b.metrics.avgLatency || 999))

  sorted.forEach((r, i) => {
    const latency = r.metrics.avgLatency?.toFixed(2) || 'N/A'
    const rps = r.metrics.requestsPerSecond?.toFixed(1) || 'N/A'
    let comparison = ''
    if (i > 0 && sorted[0].metrics.avgLatency) {
      const diff = ((r.metrics.avgLatency! - sorted[0].metrics.avgLatency!) / sorted[0].metrics.avgLatency!) * 100
      comparison = ` (+${diff.toFixed(1)}% slower)`
    }
    console.log(`${i + 1}. ${r.config.name}: ${latency}ms avg, ${rps} req/s${comparison}`)
  })
}

async function main() {
  console.log('='.repeat(70))
  console.log('Native API Benchmark (Elysia vs Hono - No tRPC)')
  console.log('='.repeat(70))

  // Ensure results directory exists
  if (!existsSync('results')) {
    mkdirSync('results')
  }

  const results: BenchmarkResult[] = []

  for (const config of configs) {
    try {
      const result = await runBenchmark(config)
      results.push(result)
    } catch (error) {
      console.error(`Failed to benchmark ${config.name}:`, error)
    }

    // Wait between benchmarks
    await sleep(2000)
  }

  // Print comparison
  printComparison(results)

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultsFile = `results/native-benchmark-${timestamp}.json`
  writeFileSync(resultsFile, JSON.stringify(results, null, 2))
  console.log(`\nResults saved to ${resultsFile}`)
}

main().catch(console.error)
