#!/usr/bin/env tsx
// Run: npx tsx src/runners/run-all-benchmarks.ts
// Options: npx tsx src/runners/run-all-benchmarks.ts --vus 20 --duration 60s --quick

import { spawn, ChildProcess, execSync } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

interface BenchmarkConfig {
  name: string
  runtime: 'node' | 'bun'
  framework: 'express' | 'hono'
  serverScript: string
  port: number
  command: string[]
}

interface BenchmarkResult {
  config: BenchmarkConfig
  metrics: {
    httpReqDuration: { avg: number; min: number; max: number; p95: number; p99: number }
    httpReqs: number
    httpReqFailed: number
    iterations: number
    vus: number
    duration: string
  }
  raw: string
  timestamp: Date
}

const configs: BenchmarkConfig[] = [
  {
    name: 'Express + Node.js',
    runtime: 'node',
    framework: 'express',
    serverScript: 'src/servers/express-server.ts',
    port: 3001,
    command: ['npx', 'tsx', 'src/servers/express-server.ts']
  },
  {
    name: 'Hono + Bun',
    runtime: 'bun',
    framework: 'hono',
    serverScript: 'src/servers/hono-server.ts',
    port: 3002,
    command: ['bun', 'run', 'src/servers/hono-server.ts']
  }
]

// Parse CLI arguments
function parseArgs(): { vus: number; duration: string; quick: boolean; output: string } {
  const args = process.argv.slice(2)
  let vus = 10
  let duration = '30s'
  let quick = false
  let output = 'results'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vus' && args[i + 1]) {
      vus = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--duration' && args[i + 1]) {
      duration = args[i + 1]
      i++
    } else if (args[i] === '--quick') {
      quick = true
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1]
      i++
    }
  }

  return { vus, duration, quick, output }
}

// Check if k6 is installed
function checkK6(): boolean {
  try {
    execSync('k6 version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// Check if Bun is installed
function checkBun(): boolean {
  try {
    execSync('bun --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// Start a server process
async function startServer(config: BenchmarkConfig): Promise<ChildProcess> {
  console.log(`\nStarting ${config.name} server...`)

  const env = { ...process.env, PORT: config.port.toString() }

  const serverProcess = spawn(config.command[0], config.command.slice(1), {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Wait for server to be ready
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      serverProcess.kill()
      reject(new Error(`Server ${config.name} failed to start within 10 seconds`))
    }, 10000)

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log(`[${config.name}] ${output.trim()}`)
      if (output.includes('Server running')) {
        clearTimeout(timeout)
        // Give server a moment to fully initialize
        setTimeout(() => resolve(serverProcess), 500)
      }
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[${config.name}] ERROR: ${data.toString().trim()}`)
    })

    serverProcess.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout)
        reject(new Error(`Server exited with code ${code}`))
      }
    })
  })
}

// Run k6 benchmark
async function runBenchmark(
  config: BenchmarkConfig,
  options: { vus: number; duration: string; quick: boolean }
): Promise<BenchmarkResult> {
  const scriptPath = options.quick
    ? 'src/k6/quick-benchmark.js'
    : 'src/k6/benchmark.js'

  const baseUrl = `http://localhost:${config.port}`

  console.log(`\nRunning k6 benchmark for ${config.name}...`)
  console.log(`  URL: ${baseUrl}`)
  console.log(`  VUs: ${options.vus}`)
  console.log(`  Duration: ${options.duration}`)

  return new Promise((resolve, reject) => {
    const args = [
      'run',
      '--vus', options.vus.toString(),
      '--duration', options.duration,
      '--env', `BASE_URL=${baseUrl}`,
      '--summary-trend-stats', 'avg,min,med,max,p(90),p(95),p(99)',
      '--out', 'json=results.json',
      scriptPath
    ]

    const k6Process = spawn('k6', args, {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    k6Process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      stdout += output
      process.stdout.write(output)
    })

    k6Process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      stderr += output
      process.stderr.write(output)
    })

    k6Process.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`k6 exited with code ${code}\n${stderr}`))
        return
      }

      // Parse results
      const metrics = parseK6Output(stdout)

      resolve({
        config,
        metrics,
        raw: stdout,
        timestamp: new Date()
      })
    })
  })
}

// Parse k6 output for metrics
function parseK6Output(output: string): BenchmarkResult['metrics'] {
  const metrics: BenchmarkResult['metrics'] = {
    httpReqDuration: { avg: 0, min: 0, max: 0, p95: 0, p99: 0 },
    httpReqs: 0,
    httpReqFailed: 0,
    iterations: 0,
    vus: 0,
    duration: ''
  }

  // Extract http_req_duration
  const durationMatch = output.match(/http_req_duration[^=]*=\s*avg=([0-9.]+)m?s\s+min=([0-9.]+)m?s.*max=([0-9.]+)m?s.*p\(95\)=([0-9.]+)m?s.*p\(99\)=([0-9.]+)m?s/i)
  if (durationMatch) {
    metrics.httpReqDuration.avg = parseFloat(durationMatch[1])
    metrics.httpReqDuration.min = parseFloat(durationMatch[2])
    metrics.httpReqDuration.max = parseFloat(durationMatch[3])
    metrics.httpReqDuration.p95 = parseFloat(durationMatch[4])
    metrics.httpReqDuration.p99 = parseFloat(durationMatch[5])
  }

  // Extract http_reqs
  const reqsMatch = output.match(/http_reqs[^0-9]*([0-9]+)/)
  if (reqsMatch) {
    metrics.httpReqs = parseInt(reqsMatch[1], 10)
  }

  // Extract iterations
  const iterMatch = output.match(/iterations[^0-9]*([0-9]+)/)
  if (iterMatch) {
    metrics.iterations = parseInt(iterMatch[1], 10)
  }

  // Extract VUs
  const vusMatch = output.match(/vus[^0-9]*([0-9]+)/)
  if (vusMatch) {
    metrics.vus = parseInt(vusMatch[1], 10)
  }

  return metrics
}

// Generate comparison report
function generateReport(results: BenchmarkResult[]): string {
  const lines: string[] = []

  lines.push('=' .repeat(80))
  lines.push('tRPC API Benchmark Results')
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push(`Timestamp: ${new Date().toISOString()}`)
  lines.push('')

  // Summary table
  lines.push('-'.repeat(80))
  lines.push('Summary Comparison')
  lines.push('-'.repeat(80))
  lines.push('')
  lines.push(
    'Server'.padEnd(25) +
    'Avg (ms)'.padStart(12) +
    'P95 (ms)'.padStart(12) +
    'P99 (ms)'.padStart(12) +
    'Requests'.padStart(12) +
    'Req/s'.padStart(12)
  )
  lines.push('-'.repeat(85))

  for (const result of results) {
    const duration = result.metrics.httpReqDuration
    const reqsPerSec = Math.round(result.metrics.httpReqs / 30)  // Approximate

    lines.push(
      result.config.name.padEnd(25) +
      duration.avg.toFixed(2).padStart(12) +
      duration.p95.toFixed(2).padStart(12) +
      duration.p99.toFixed(2).padStart(12) +
      result.metrics.httpReqs.toString().padStart(12) +
      reqsPerSec.toString().padStart(12)
    )
  }

  lines.push('')

  // Performance comparison
  if (results.length >= 2) {
    lines.push('-'.repeat(80))
    lines.push('Performance Comparison')
    lines.push('-'.repeat(80))
    lines.push('')

    const [first, second] = results
    const avgDiff = ((first.metrics.httpReqDuration.avg - second.metrics.httpReqDuration.avg) /
      first.metrics.httpReqDuration.avg * 100)
    const p95Diff = ((first.metrics.httpReqDuration.p95 - second.metrics.httpReqDuration.p95) /
      first.metrics.httpReqDuration.p95 * 100)
    const reqsDiff = ((second.metrics.httpReqs - first.metrics.httpReqs) /
      first.metrics.httpReqs * 100)

    if (avgDiff > 0) {
      lines.push(`${second.config.name} is ${Math.abs(avgDiff).toFixed(1)}% faster (avg latency)`)
    } else {
      lines.push(`${first.config.name} is ${Math.abs(avgDiff).toFixed(1)}% faster (avg latency)`)
    }

    if (p95Diff > 0) {
      lines.push(`${second.config.name} has ${Math.abs(p95Diff).toFixed(1)}% better P95 latency`)
    } else {
      lines.push(`${first.config.name} has ${Math.abs(p95Diff).toFixed(1)}% better P95 latency`)
    }

    if (reqsDiff > 0) {
      lines.push(`${second.config.name} handled ${Math.abs(reqsDiff).toFixed(1)}% more requests`)
    } else {
      lines.push(`${first.config.name} handled ${Math.abs(reqsDiff).toFixed(1)}% more requests`)
    }
  }

  lines.push('')
  lines.push('=' .repeat(80))

  return lines.join('\n')
}

// Main runner
async function main() {
  console.log('tRPC API Benchmark Runner')
  console.log('='.repeat(50))

  // Check dependencies
  if (!checkK6()) {
    console.error('Error: k6 is not installed. Install it with:')
    console.error('  brew install k6  (macOS)')
    console.error('  choco install k6 (Windows)')
    console.error('  sudo apt install k6 (Ubuntu/Debian)')
    console.error('  Or download from: https://k6.io/docs/getting-started/installation/')
    process.exit(1)
  }

  if (!checkBun()) {
    console.warn('Warning: Bun is not installed. Hono+Bun benchmark will be skipped.')
    console.warn('  Install Bun: curl -fsSL https://bun.sh/install | bash')
  }

  const options = parseArgs()
  console.log(`\nBenchmark options:`)
  console.log(`  VUs: ${options.vus}`)
  console.log(`  Duration: ${options.duration}`)
  console.log(`  Quick mode: ${options.quick}`)

  const results: BenchmarkResult[] = []
  const hasBun = checkBun()

  for (const config of configs) {
    // Skip Bun tests if Bun is not installed
    if (config.runtime === 'bun' && !hasBun) {
      console.log(`\nSkipping ${config.name} (Bun not installed)`)
      continue
    }

    let serverProcess: ChildProcess | null = null

    try {
      // Start server
      serverProcess = await startServer(config)

      // Run benchmark
      const result = await runBenchmark(config, options)
      results.push(result)
    } catch (error) {
      console.error(`\nError benchmarking ${config.name}:`, error)
    } finally {
      // Stop server
      if (serverProcess) {
        console.log(`\nStopping ${config.name} server...`)
        serverProcess.kill('SIGTERM')
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  // Generate and save report
  if (results.length > 0) {
    const report = generateReport(results)
    console.log('\n')
    console.log(report)

    // Save results
    const outputDir = path.join(ROOT_DIR, options.output)
    await mkdir(outputDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await writeFile(
      path.join(outputDir, `benchmark-${timestamp}.txt`),
      report
    )
    await writeFile(
      path.join(outputDir, `benchmark-${timestamp}.json`),
      JSON.stringify(results, null, 2)
    )

    console.log(`\nResults saved to ${outputDir}/`)
  } else {
    console.error('\nNo benchmark results collected!')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
