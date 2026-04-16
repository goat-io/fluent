// Native API Benchmark Runner (Elysia native vs Hono native - no tRPC)
// Run: npx tsx src/runners/run-native-benchmark.ts
// Stress test: npx tsx src/runners/run-native-benchmark.ts --stress

import { type ChildProcess, execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

interface ResourceSample {
  timestamp: number
  memoryMB: number
  cpuPercent: number
}

interface BenchmarkConfig {
  name: string
  runtime: 'bun' | 'node'
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
    peakRPS?: number
    // Resource metrics
    peakMemoryMB?: number
    avgMemoryMB?: number
    peakCpuPercent?: number
    avgCpuPercent?: number
  }
  resourceSamples?: ResourceSample[]
}

// Check for stress test mode
const STRESS_TEST = process.argv.includes('--stress')

const configs: BenchmarkConfig[] = [
  {
    name: 'Express Native + Node',
    runtime: 'node',
    framework: 'express-native',
    port: 3007,
    command: ['npx', 'tsx', 'src/servers/express-native-server.ts'],
  },
  {
    name: 'Hono Native + Bun',
    runtime: 'bun',
    framework: 'hono-native',
    port: 3005,
    command: ['bun', 'run', 'src/servers/hono-native-server.ts'],
  },
  {
    name: 'Elysia Native + Bun',
    runtime: 'bun',
    framework: 'elysia-native',
    port: 3004,
    command: ['bun', 'run', 'src/servers/elysia-native-server.ts'],
  },
  {
    name: 'Elysia Optimized + Bun',
    runtime: 'bun',
    framework: 'elysia-optimized',
    port: 3006,
    command: ['bun', 'run', 'src/servers/elysia-optimized-server.ts'],
  },
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
    cwd: process.cwd(),
  })

  proc.stdout?.on('data', data => {
    console.log(`[${config.name}] ${data.toString().trim()}`)
  })

  proc.stderr?.on('data', data => {
    const msg = data.toString().trim()
    if (
      msg &&
      !msg.includes('ExperimentalWarning') &&
      !msg.includes('prisma:error')
    ) {
      console.error(`[${config.name}] ${msg}`)
    }
  })

  return proc
}

// Resource monitoring using /proc filesystem (Linux)
function _getProcessStats(
  pid: number,
): { memoryMB: number; cpuPercent: number } | null {
  try {
    // Read memory from /proc/[pid]/status
    const statusPath = `/proc/${pid}/status`
    if (!existsSync(statusPath)) {
      return null
    }

    const status = readFileSync(statusPath, 'utf-8')
    const vmRssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/)
    const memoryKB = vmRssMatch ? Number.parseInt(vmRssMatch[1]) : 0
    const memoryMB = memoryKB / 1024

    // Read CPU from /proc/[pid]/stat
    const statPath = `/proc/${pid}/stat`
    const stat = readFileSync(statPath, 'utf-8')
    const parts = stat.split(' ')
    // utime (14th field) + stime (15th field) = total CPU time in jiffies
    const utime = Number.parseInt(parts[13]) || 0
    const stime = Number.parseInt(parts[14]) || 0
    const totalTime = utime + stime

    // This is cumulative, so we just return a rough estimate
    // Real CPU% would need two samples to calculate delta
    const cpuPercent = totalTime / 100 // Rough approximation

    return { memoryMB, cpuPercent }
  } catch {
    return null
  }
}

class ResourceMonitor {
  private pid: number
  private samples: ResourceSample[] = []
  private interval: NodeJS.Timeout | null = null
  private lastCpuTime = 0
  private lastSampleTime = Date.now()

  constructor(pid: number) {
    this.pid = pid
  }

  start(intervalMs = 1000) {
    this.samples = []
    this.lastSampleTime = Date.now()

    // Get initial CPU time
    const initial = this.getCpuTime()
    if (initial !== null) {
      this.lastCpuTime = initial
    }

    this.interval = setInterval(() => {
      this.takeSample()
    }, intervalMs)
  }

  private getCpuTime(): number | null {
    try {
      const statPath = `/proc/${this.pid}/stat`
      if (!existsSync(statPath)) {
        return null
      }
      const stat = readFileSync(statPath, 'utf-8')
      const parts = stat.split(' ')
      const utime = Number.parseInt(parts[13]) || 0
      const stime = Number.parseInt(parts[14]) || 0
      return utime + stime
    } catch {
      return null
    }
  }

  private takeSample() {
    try {
      const statusPath = `/proc/${this.pid}/status`
      if (!existsSync(statusPath)) {
        return
      }

      const status = readFileSync(statusPath, 'utf-8')
      const vmRssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/)
      const memoryKB = vmRssMatch ? Number.parseInt(vmRssMatch[1]) : 0
      const memoryMB = memoryKB / 1024

      // Calculate CPU percentage
      const now = Date.now()
      const currentCpuTime = this.getCpuTime()
      let cpuPercent = 0

      if (currentCpuTime !== null && this.lastCpuTime > 0) {
        const cpuDelta = currentCpuTime - this.lastCpuTime
        const timeDelta = (now - this.lastSampleTime) / 1000 // seconds
        // CPU time is in jiffies (usually 100Hz = 10ms each)
        // So cpuDelta jiffies / 100 = seconds of CPU time
        // CPU% = (CPU seconds / wall clock seconds) * 100
        cpuPercent = (cpuDelta / 100 / timeDelta) * 100
        this.lastCpuTime = currentCpuTime
      }

      this.lastSampleTime = now

      this.samples.push({
        timestamp: now,
        memoryMB: Math.round(memoryMB * 100) / 100,
        cpuPercent: Math.round(cpuPercent * 100) / 100,
      })
    } catch {
      // Process may have exited
    }
  }

  stop(): ResourceSample[] {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    return this.samples
  }

  getStats(): {
    peak: { memoryMB: number; cpuPercent: number }
    avg: { memoryMB: number; cpuPercent: number }
  } {
    if (this.samples.length === 0) {
      return {
        peak: { memoryMB: 0, cpuPercent: 0 },
        avg: { memoryMB: 0, cpuPercent: 0 },
      }
    }

    const peakMemory = Math.max(...this.samples.map(s => s.memoryMB))
    const peakCpu = Math.max(...this.samples.map(s => s.cpuPercent))
    const avgMemory =
      this.samples.reduce((sum, s) => sum + s.memoryMB, 0) / this.samples.length
    const avgCpu =
      this.samples.reduce((sum, s) => sum + s.cpuPercent, 0) /
      this.samples.length

    return {
      peak: {
        memoryMB: Math.round(peakMemory * 100) / 100,
        cpuPercent: Math.round(peakCpu * 100) / 100,
      },
      avg: {
        memoryMB: Math.round(avgMemory * 100) / 100,
        cpuPercent: Math.round(avgCpu * 100) / 100,
      },
    }
  }
}

async function runK6Benchmark(
  config: BenchmarkConfig,
  stressTest: boolean,
): Promise<string> {
  const baseUrl = `http://localhost:${config.port}`

  const env = {
    ...process.env,
    BASE_URL: baseUrl,
    RUNTIME: config.runtime,
    FRAMEWORK: config.framework,
    STRESS_TEST: stressTest ? '1' : '0',
  }

  // Longer timeout for stress tests
  const timeout = stressTest ? 300000 : 180000

  try {
    const result = execSync('k6 run src/k6/native-benchmark.js', {
      env,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout,
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
  const durationMatch = output.match(
    /http_req_duration[^:]*:\s*avg=([0-9.]+)(\w+)\s+min=[\d.]+[µm]?s?\s+med=[\d.]+[µm]?s?\s+max=[\d.]+[µm]?s?\s+p\(90\)=([0-9.]+)(\w+)\s+p\(95\)=([0-9.]+)(\w+)/,
  )
  if (durationMatch) {
    metrics.avgLatency = Number.parseFloat(durationMatch[1])
    metrics.p95Latency = Number.parseFloat(durationMatch[5])
    // p99 not in default k6 output, use p90 as fallback
    metrics.p99Latency = Number.parseFloat(durationMatch[3])
  }

  // Parse http_reqs
  const reqsMatch = output.match(/http_reqs[^:]*:\s*(\d+)\s+([0-9.]+)\/s/)
  if (reqsMatch) {
    metrics.totalRequests = Number.parseInt(reqsMatch[1])
    metrics.requestsPerSecond = Number.parseFloat(reqsMatch[2])
    metrics.peakRPS = metrics.requestsPerSecond // Will be same as avg for k6
  }

  // Parse error_rate - handle both count and rate format
  const errorMatch = output.match(/error_rate[^:]*:\s*(\d+)/)
  if (errorMatch) {
    metrics.errorRate = Number.parseInt(errorMatch[1])
  }

  return metrics
}

async function runBenchmark(
  config: BenchmarkConfig,
  stressTest: boolean,
): Promise<BenchmarkResult> {
  console.log(`\nStarting ${config.name} server...`)

  const server = startServer(config)
  let monitor: ResourceMonitor | null = null

  try {
    const serverUrl = `http://localhost:${config.port}`
    const ready = await waitForServer(serverUrl)

    if (!ready) {
      throw new Error(`Server ${config.name} failed to start`)
    }

    // Start resource monitoring
    if (server.pid) {
      monitor = new ResourceMonitor(server.pid)
      monitor.start(500) // Sample every 500ms
    }

    console.log(
      `\nRunning ${stressTest ? 'STRESS TEST' : 'benchmark'} for ${config.name}...`,
    )
    console.log(`  URL: ${serverUrl}`)
    if (server.pid) {
      console.log(`  PID: ${server.pid}`)
    }

    const output = await runK6Benchmark(config, stressTest)
    console.log(output)

    const metrics = parseK6Output(output)

    // Get resource stats
    if (monitor) {
      const resourceStats = monitor.getStats()
      metrics.peakMemoryMB = resourceStats.peak.memoryMB
      metrics.avgMemoryMB = resourceStats.avg.memoryMB
      metrics.peakCpuPercent = resourceStats.peak.cpuPercent
      metrics.avgCpuPercent = resourceStats.avg.cpuPercent
    }

    const resourceSamples = monitor?.stop() || []

    return { config, metrics, resourceSamples }
  } finally {
    if (monitor) {
      monitor.stop()
    }
    console.log(`\nStopping ${config.name} server...`)
    server.kill('SIGTERM')
    await sleep(1000)
  }
}

function printComparison(results: BenchmarkResult[], stressTest: boolean) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(
    stressTest
      ? 'STRESS TEST RESULTS (Max RPS & Resource Usage)'
      : 'NATIVE API COMPARISON RESULTS (No tRPC)',
  )
  console.log('='.repeat(80))

  // Header
  const headers = [
    'Metric',
    ...results.map(r => r.config.name.replace(' + Bun', '')),
  ]
  const colWidths = headers.map((h, i) =>
    Math.max(h.length + 2, i === 0 ? 20 : 18),
  )

  const printRow = (cells: string[]) => {
    console.log(cells.map((c, i) => c.padEnd(colWidths[i])).join(''))
  }

  printRow(headers)
  console.log('-'.repeat(colWidths.reduce((a, b) => a + b, 0)))

  // Performance metrics
  printRow([
    'Avg Latency (ms)',
    ...results.map(r => r.metrics.avgLatency?.toFixed(2) || 'N/A'),
  ])
  printRow([
    'P95 Latency (ms)',
    ...results.map(r => r.metrics.p95Latency?.toFixed(2) || 'N/A'),
  ])
  printRow([
    'Total Requests',
    ...results.map(r => String(r.metrics.totalRequests || 'N/A')),
  ])
  printRow([
    'Requests/sec',
    ...results.map(r => r.metrics.requestsPerSecond?.toFixed(1) || 'N/A'),
  ])
  printRow(['Errors', ...results.map(r => String(r.metrics.errorRate || 0))])

  // Resource metrics
  console.log('-'.repeat(colWidths.reduce((a, b) => a + b, 0)))
  printRow([
    'Peak Memory (MB)',
    ...results.map(r => r.metrics.peakMemoryMB?.toFixed(1) || 'N/A'),
  ])
  printRow([
    'Avg Memory (MB)',
    ...results.map(r => r.metrics.avgMemoryMB?.toFixed(1) || 'N/A'),
  ])
  printRow([
    'Peak CPU (%)',
    ...results.map(r => r.metrics.peakCpuPercent?.toFixed(1) || 'N/A'),
  ])
  printRow([
    'Avg CPU (%)',
    ...results.map(r => r.metrics.avgCpuPercent?.toFixed(1) || 'N/A'),
  ])

  // Rankings
  console.log(`\n${'='.repeat(80)}`)
  console.log('RANKINGS')
  console.log('='.repeat(80))

  // By RPS (higher is better)
  console.log('\nBy Throughput (requests/sec - higher is better):')
  const sortedByRps = [...results]
    .filter(r => r.metrics.requestsPerSecond !== undefined)
    .sort(
      (a, b) =>
        (b.metrics.requestsPerSecond || 0) - (a.metrics.requestsPerSecond || 0),
    )

  sortedByRps.forEach((r, i) => {
    const rps = r.metrics.requestsPerSecond?.toFixed(1) || 'N/A'
    const mem = r.metrics.peakMemoryMB?.toFixed(1) || 'N/A'
    let comparison = ''
    if (i > 0 && sortedByRps[0].metrics.requestsPerSecond) {
      const diff =
        ((sortedByRps[0].metrics.requestsPerSecond! -
          r.metrics.requestsPerSecond!) /
          sortedByRps[0].metrics.requestsPerSecond!) *
        100
      comparison = ` (-${diff.toFixed(1)}% throughput)`
    }
    console.log(
      `${i + 1}. ${r.config.name}: ${rps} req/s, ${mem}MB peak${comparison}`,
    )
  })

  // By latency (lower is better)
  console.log('\nBy Latency (avg ms - lower is better):')
  const sortedByLatency = [...results]
    .filter(r => r.metrics.avgLatency !== undefined)
    .sort(
      (a, b) => (a.metrics.avgLatency || 999) - (b.metrics.avgLatency || 999),
    )

  sortedByLatency.forEach((r, i) => {
    const latency = r.metrics.avgLatency?.toFixed(2) || 'N/A'
    let comparison = ''
    if (i > 0 && sortedByLatency[0].metrics.avgLatency) {
      const diff =
        ((r.metrics.avgLatency! - sortedByLatency[0].metrics.avgLatency!) /
          sortedByLatency[0].metrics.avgLatency!) *
        100
      comparison = ` (+${diff.toFixed(1)}% slower)`
    }
    console.log(`${i + 1}. ${r.config.name}: ${latency}ms avg${comparison}`)
  })

  // By efficiency (RPS per MB of memory)
  console.log('\nBy Efficiency (req/s per MB memory - higher is better):')
  const sortedByEfficiency = [...results]
    .filter(
      r =>
        r.metrics.requestsPerSecond !== undefined &&
        r.metrics.peakMemoryMB !== undefined &&
        r.metrics.peakMemoryMB > 0,
    )
    .sort((a, b) => {
      const effA =
        (a.metrics.requestsPerSecond || 0) / (a.metrics.peakMemoryMB || 1)
      const effB =
        (b.metrics.requestsPerSecond || 0) / (b.metrics.peakMemoryMB || 1)
      return effB - effA
    })

  sortedByEfficiency.forEach((r, i) => {
    const eff = (
      (r.metrics.requestsPerSecond || 0) / (r.metrics.peakMemoryMB || 1)
    ).toFixed(2)
    console.log(`${i + 1}. ${r.config.name}: ${eff} req/s/MB`)
  })
}

async function main() {
  console.log('='.repeat(80))
  console.log(
    STRESS_TEST
      ? 'Native API STRESS TEST (Finding Max RPS & Resource Limits)'
      : 'Native API Benchmark (Elysia vs Hono - No tRPC)',
  )
  console.log('='.repeat(80))

  if (STRESS_TEST) {
    console.log('\nSTRESS TEST MODE: Ramping up to 200 concurrent users')
    console.log('This will take approximately 2.5 minutes per framework\n')
  }

  // Ensure results directory exists
  if (!existsSync('results')) {
    mkdirSync('results')
  }

  const results: BenchmarkResult[] = []

  for (const config of configs) {
    try {
      const result = await runBenchmark(config, STRESS_TEST)
      results.push(result)
    } catch (error) {
      console.error(`Failed to benchmark ${config.name}:`, error)
    }

    // Wait between benchmarks
    await sleep(3000)
  }

  // Print comparison
  printComparison(results, STRESS_TEST)

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const prefix = STRESS_TEST ? 'stress-test' : 'native-benchmark'
  const resultsFile = `results/${prefix}-${timestamp}.json`
  writeFileSync(resultsFile, JSON.stringify(results, null, 2))
  console.log(`\nResults saved to ${resultsFile}`)
}

main().catch(console.error)
