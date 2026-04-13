// Stress Test Runner using autocannon (no k6 required)
// Run: npx tsx src/runners/run-stress-test.ts

import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

interface ServerConfig {
  name: string
  runtime: 'bun' | 'node'
  framework: string
  port: number
  command: string[]
  // Endpoint to test (defaults to /api/products for native, /trpc/product.list for tRPC)
  endpoint?: string
  // Whether this uses tRPC (needs special URL encoding)
  isTrpc?: boolean
}

interface StressResult {
  config: ServerConfig
  metrics: {
    requestsPerSecond: number
    avgLatencyMs: number
    p99LatencyMs: number
    totalRequests: number
    errors: number
    duration: number
  }
}

const configs: ServerConfig[] = [
  {
    name: 'Express Native + Node',
    runtime: 'node',
    framework: 'express-native',
    port: 3007,
    command: ['npx', 'tsx', 'src/servers/express-native-server.ts']
  },
  {
    name: 'Express + tRPC + Bun',
    runtime: 'bun',
    framework: 'express-trpc',
    port: 3008,
    command: ['bun', 'run', 'src/servers/express-trpc-bun-server.ts'],
    isTrpc: true
  },
  {
    name: 'Hono Native + Bun',
    runtime: 'bun',
    framework: 'hono-native',
    port: 3005,
    command: ['bun', 'run', 'src/servers/hono-native-server.ts']
  }
]

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`)
      if (response.ok) return true
    } catch {
      // Server not ready
    }
    await sleep(500)
  }
  return false
}

function startServer(config: ServerConfig): ChildProcess {
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

async function runAutocannon(url: string, duration: number, connections: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [
      'autocannon',
      '-c', String(connections),  // concurrent connections
      '-d', String(duration),     // duration in seconds
      '-j',                       // JSON output
      url
    ]

    const proc = spawn('npx', args, { cwd: process.cwd() })
    let output = ''

    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      const msg = data.toString()
      if (!msg.includes('Running')) {
        console.log(`  [autocannon] ${msg.trim()}`)
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output))
        } catch {
          reject(new Error('Failed to parse autocannon output'))
        }
      } else {
        reject(new Error(`autocannon exited with code ${code}`))
      }
    })
  })
}

function getTrpcUrl(baseUrl: string, procedure: string, input: object): string {
  // tRPC uses SuperJSON encoding for input
  // Format: /trpc/procedure?input=encodedJSON
  const encodedInput = encodeURIComponent(JSON.stringify({ json: input }))
  return `${baseUrl}/trpc/${procedure}?input=${encodedInput}`
}

async function runStressTest(config: ServerConfig): Promise<StressResult | null> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Starting ${config.name}...`)

  const server = startServer(config)

  try {
    const serverUrl = `http://localhost:${config.port}`
    const ready = await waitForServer(serverUrl)

    if (!ready) {
      console.error(`  Server failed to start`)
      return null
    }

    // Determine endpoint URL based on server type
    let testUrl: string
    if (config.isTrpc) {
      // tRPC endpoint for product list
      testUrl = getTrpcUrl(serverUrl, 'product.list', { page: 1, pageSize: 20 })
      console.log(`  Server ready, running stress test...`)
      console.log(`  Testing tRPC product.list with 200 connections for 30s`)
    } else {
      testUrl = `${serverUrl}/api/products`
      console.log(`  Server ready, running stress test...`)
      console.log(`  Testing /api/products endpoint with 200 connections for 30s`)
    }

    // Run autocannon with high concurrency
    const result = await runAutocannon(testUrl, 30, 200)

    const metrics = {
      requestsPerSecond: result.requests?.average || 0,
      avgLatencyMs: result.latency?.average || 0,
      p99LatencyMs: result.latency?.p99 || 0,
      totalRequests: result.requests?.total || 0,
      errors: result.errors || 0,
      duration: result.duration || 30
    }

    console.log(`\n  Results:`)
    console.log(`    Requests/sec: ${metrics.requestsPerSecond.toFixed(1)}`)
    console.log(`    Avg Latency:  ${metrics.avgLatencyMs.toFixed(2)}ms`)
    console.log(`    P99 Latency:  ${metrics.p99LatencyMs.toFixed(2)}ms`)
    console.log(`    Total Reqs:   ${metrics.totalRequests}`)
    console.log(`    Errors:       ${metrics.errors}`)

    return { config, metrics }
  } catch (error) {
    console.error(`  Error: ${error}`)
    return null
  } finally {
    console.log(`  Stopping server...`)
    server.kill('SIGTERM')
    await sleep(1000)
  }
}

function printComparison(results: StressResult[]) {
  console.log('\n' + '='.repeat(80))
  console.log('STRESS TEST RESULTS - Max RPS Comparison (200 concurrent connections)')
  console.log('='.repeat(80))

  // Sort by RPS
  const sorted = [...results].sort((a, b) => b.metrics.requestsPerSecond - a.metrics.requestsPerSecond)

  console.log('\n+--------------------------+-------------+-------------+-------------+-------------+')
  console.log('| Framework                | Requests/s  | Avg Latency | P99 Latency | Total Reqs  |')
  console.log('+--------------------------+-------------+-------------+-------------+-------------+')

  sorted.forEach((r, i) => {
    const name = r.config.name.padEnd(24)
    const rps = r.metrics.requestsPerSecond.toFixed(1).padStart(9)
    const avg = (r.metrics.avgLatencyMs.toFixed(1) + 'ms').padStart(9)
    const p99 = (r.metrics.p99LatencyMs.toFixed(1) + 'ms').padStart(9)
    const total = String(r.metrics.totalRequests).padStart(9)
    const medal = i === 0 ? ' *' : ''
    console.log(`| ${name} | ${rps}${medal} | ${avg}   | ${p99}   | ${total}   |`)
  })

  console.log('+--------------------------+-------------+-------------+-------------+-------------+')

  // Performance comparison
  if (sorted.length >= 2) {
    console.log('\nPerformance Analysis:')
    const best = sorted[0]
    sorted.slice(1).forEach(r => {
      const diff = ((best.metrics.requestsPerSecond - r.metrics.requestsPerSecond) / r.metrics.requestsPerSecond * 100).toFixed(1)
      console.log(`   ${best.config.name} is ${diff}% faster than ${r.config.name}`)
    })
  }
}

async function main() {
  console.log('='.repeat(80))
  console.log('STRESS TEST: Express Native vs Express+tRPC vs Hono Native')
  console.log('='.repeat(80))
  console.log('\nConfiguration:')
  console.log('  - 200 concurrent connections')
  console.log('  - 30 second duration per framework')
  console.log('  - Testing product list endpoint (native REST or tRPC)')

  if (!existsSync('results')) {
    mkdirSync('results')
  }

  const results: StressResult[] = []

  for (const config of configs) {
    const result = await runStressTest(config)
    if (result) {
      results.push(result)
    }
    await sleep(2000)
  }

  if (results.length > 0) {
    printComparison(results)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const resultsFile = `results/stress-test-autocannon-${timestamp}.json`
    writeFileSync(resultsFile, JSON.stringify(results, null, 2))
    console.log(`\nResults saved to ${resultsFile}`)
  } else {
    console.log('\nNo successful benchmark results')
  }
}

main().catch(console.error)
