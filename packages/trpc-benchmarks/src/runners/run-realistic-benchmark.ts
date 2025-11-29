#!/usr/bin/env tsx
// Run: npx tsx src/runners/run-realistic-benchmark.ts
// Runs realistic database benchmarks for Express+Node vs Hono+Bun vs Elysia+Bun

import { spawn, ChildProcess, execSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

interface BenchmarkConfig {
  name: string
  runtime: 'node' | 'bun'
  framework: 'express' | 'hono' | 'elysia'
  serverScript: string
  port: number
  command: string[]
}

const configs: BenchmarkConfig[] = [
  {
    name: 'Express + Node + SQLite',
    runtime: 'node',
    framework: 'express',
    serverScript: 'src/servers/express-db-server.ts',
    port: 3001,
    command: ['npx', 'tsx', 'src/servers/express-db-server.ts']
  },
  {
    name: 'Hono + Bun + SQLite',
    runtime: 'bun',
    framework: 'hono',
    serverScript: 'src/servers/hono-db-server.ts',
    port: 3002,
    command: ['bun', 'run', 'src/servers/hono-db-server.ts']
  },
  {
    name: 'Elysia + Bun + SQLite',
    runtime: 'bun',
    framework: 'elysia',
    serverScript: 'src/servers/elysia-db-server.ts',
    port: 3003,
    command: ['bun', 'run', 'src/servers/elysia-db-server.ts']
  }
]

function parseArgs() {
  const args = process.argv.slice(2)
  let duration = '60s'
  let maxVus = 20

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--duration' && args[i + 1]) {
      duration = args[i + 1]
      i++
    } else if (args[i] === '--max-vus' && args[i + 1]) {
      maxVus = parseInt(args[i + 1], 10)
      i++
    }
  }

  return { duration, maxVus }
}

function checkBun(): boolean {
  try {
    execSync('bun --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function checkElysia(): boolean {
  try {
    // Check if Elysia can be loaded (requires compatible typebox version)
    execSync('bun -e "import(\'elysia\')"', { stdio: 'pipe', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function startServer(config: BenchmarkConfig): Promise<ChildProcess> {
  console.log(`\nStarting ${config.name} server...`)

  const env = { ...process.env, PORT: config.port.toString() }

  const serverProcess = spawn(config.command[0], config.command.slice(1), {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      serverProcess.kill()
      reject(new Error(`Server ${config.name} failed to start within 15 seconds`))
    }, 15000)

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log(`[${config.name}] ${output.trim()}`)
      if (output.includes('Server running')) {
        clearTimeout(timeout)
        setTimeout(() => resolve(serverProcess), 1000) // Extra time for DB connection
      }
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[${config.name}] ERROR: ${data.toString().trim()}`)
    })

    serverProcess.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function runBenchmark(config: BenchmarkConfig): Promise<string> {
  const baseUrl = `http://localhost:${config.port}`

  console.log(`\nRunning realistic benchmark for ${config.name}...`)
  console.log(`  URL: ${baseUrl}`)

  return new Promise((resolve, reject) => {
    let output = ''

    const k6Process = spawn('k6', [
      'run',
      '--env', `BASE_URL=${baseUrl}`,
      '--summary-trend-stats', 'avg,min,med,max,p(90),p(95),p(99)',
      'src/k6/realistic-benchmark.js'
    ], {
      cwd: ROOT_DIR,
      env: { ...process.env, PATH: `/home/user/.local/bin:${process.env.PATH}` },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    k6Process.stdout?.on('data', (data: Buffer) => {
      const str = data.toString()
      output += str
      process.stdout.write(str)
    })

    k6Process.stderr?.on('data', (data: Buffer) => {
      const str = data.toString()
      output += str
      process.stderr.write(str)
    })

    k6Process.on('close', (code) => {
      if (code !== 0 && code !== 99) { // 99 = threshold crossed but ran
        reject(new Error(`k6 exited with code ${code}`))
      } else {
        resolve(output)
      }
    })
  })
}

function extractMetrics(output: string) {
  const metrics: Record<string, any> = {}

  // Extract http_req_duration
  const durationMatch = output.match(/http_req_duration[^=]*=\s*avg=([0-9.]+)m?s.*p\(95\)=([0-9.]+)m?s.*p\(99\)=([0-9.]+)m?s/i)
  if (durationMatch) {
    metrics.httpReqDuration = {
      avg: parseFloat(durationMatch[1]),
      p95: parseFloat(durationMatch[2]),
      p99: parseFloat(durationMatch[3])
    }
  }

  // Extract custom DB metrics
  const dbMetrics = ['product_list', 'product_get', 'product_search', 'order_create', 'order_get', 'dashboard']
  for (const metric of dbMetrics) {
    const regex = new RegExp(`db_${metric}_latency[^=]*=\\s*avg=([0-9.]+)m?s.*p\\(95\\)=([0-9.]+)m?s`, 'i')
    const match = output.match(regex)
    if (match) {
      metrics[metric] = {
        avg: parseFloat(match[1]),
        p95: parseFloat(match[2])
      }
    }
  }

  // Extract request count
  const reqsMatch = output.match(/http_reqs[^0-9]*([0-9]+)/)
  if (reqsMatch) {
    metrics.totalRequests = parseInt(reqsMatch[1], 10)
  }

  // Extract error rate
  const errorMatch = output.match(/error_rate[^0-9]*([0-9.]+)%/)
  if (errorMatch) {
    metrics.errorRate = parseFloat(errorMatch[1])
  }

  return metrics
}

async function main() {
  console.log('='.repeat(70))
  console.log('Realistic tRPC API Benchmark (with SQLite Database)')
  console.log('='.repeat(70))

  const hasBun = checkBun()
  if (!hasBun) {
    console.warn('\nWarning: Bun not installed. Hono+Bun and Elysia+Bun benchmarks will be skipped.')
  }

  const hasElysia = hasBun && checkElysia()
  if (hasBun && !hasElysia) {
    console.warn('\nWarning: Elysia has TypeBox compatibility issues. Elysia benchmark will be skipped.')
  }

  const results: Array<{ config: BenchmarkConfig; metrics: any; output: string }> = []

  for (const config of configs) {
    if (config.runtime === 'bun' && !hasBun) {
      console.log(`\nSkipping ${config.name} (Bun not installed)`)
      continue
    }

    if (config.framework === 'elysia' && !hasElysia) {
      console.log(`\nSkipping ${config.name} (Elysia TypeBox incompatibility)`)
      continue
    }

    let serverProcess: ChildProcess | null = null

    try {
      serverProcess = await startServer(config)
      const output = await runBenchmark(config)
      const metrics = extractMetrics(output)
      results.push({ config, metrics, output })
    } catch (error) {
      console.error(`\nError with ${config.name}:`, error)
    } finally {
      if (serverProcess) {
        console.log(`\nStopping ${config.name} server...`)
        serverProcess.kill('SIGTERM')
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  // Print comparison
  if (results.length >= 2) {
    console.log('\n')
    console.log('='.repeat(70))
    console.log('COMPARISON RESULTS')
    console.log('='.repeat(70))
    console.log('')

    const headers = ['Metric', ...results.map(r => r.config.name)]
    const rows: string[][] = []

    // HTTP overall
    rows.push([
      'HTTP Avg Latency',
      ...results.map(r => `${r.metrics.httpReqDuration?.avg?.toFixed(2) || 'N/A'}ms`)
    ])
    rows.push([
      'HTTP P95 Latency',
      ...results.map(r => `${r.metrics.httpReqDuration?.p95?.toFixed(2) || 'N/A'}ms`)
    ])

    // DB operations
    const dbOps = [
      ['Product List', 'product_list'],
      ['Product Get', 'product_get'],
      ['Product Search', 'product_search'],
      ['Order Create', 'order_create'],
      ['Dashboard', 'dashboard']
    ]

    for (const [label, key] of dbOps) {
      rows.push([
        `${label} Avg`,
        ...results.map(r => `${r.metrics[key]?.avg?.toFixed(2) || 'N/A'}ms`)
      ])
    }

    rows.push([
      'Total Requests',
      ...results.map(r => r.metrics.totalRequests?.toString() || 'N/A')
    ])
    rows.push([
      'Error Rate',
      ...results.map(r => `${r.metrics.errorRate?.toFixed(2) || '0'}%`)
    ])

    // Print table
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => (r[i] || '').length)) + 2
    )

    console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join(''))
    console.log('-'.repeat(colWidths.reduce((a, b) => a + b, 0)))
    for (const row of rows) {
      console.log(row.map((c, i) => c.padEnd(colWidths[i])).join(''))
    }

    // Find the fastest
    const sortedByAvg = results
      .filter(r => r.metrics.httpReqDuration?.avg)
      .sort((a, b) => a.metrics.httpReqDuration.avg - b.metrics.httpReqDuration.avg)

    if (sortedByAvg.length >= 2) {
      const fastest = sortedByAvg[0]
      const slowest = sortedByAvg[sortedByAvg.length - 1]

      console.log('')
      console.log('Rankings (by average latency):')
      sortedByAvg.forEach((r, i) => {
        const diffFromFastest = ((r.metrics.httpReqDuration.avg - fastest.metrics.httpReqDuration.avg) /
          fastest.metrics.httpReqDuration.avg * 100)
        if (i === 0) {
          console.log(`  1. ${r.config.name} - ${r.metrics.httpReqDuration.avg.toFixed(2)}ms (fastest)`)
        } else {
          console.log(`  ${i + 1}. ${r.config.name} - ${r.metrics.httpReqDuration.avg.toFixed(2)}ms (+${diffFromFastest.toFixed(1)}%)`)
        }
      })
    }
  }

  // Save results
  const outputDir = path.join(ROOT_DIR, 'results')
  await mkdir(outputDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await writeFile(
    path.join(outputDir, `realistic-benchmark-${timestamp}.json`),
    JSON.stringify(results.map(r => ({ config: r.config, metrics: r.metrics })), null, 2)
  )

  console.log(`\nResults saved to results/realistic-benchmark-${timestamp}.json`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
