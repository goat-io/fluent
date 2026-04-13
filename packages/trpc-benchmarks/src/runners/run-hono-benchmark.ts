#!/usr/bin/env tsx
// Run: npx tsx src/runners/run-hono-benchmark.ts
// Options: npx tsx src/runners/run-hono-benchmark.ts --vus 20 --duration 60s

import { spawn, ChildProcess, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

const PORT = 3002
const BASE_URL = `http://localhost:${PORT}`

function parseArgs() {
  const args = process.argv.slice(2)
  let vus = 10
  let duration = '30s'
  let quick = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vus' && args[i + 1]) {
      vus = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--duration' && args[i + 1]) {
      duration = args[i + 1]
      i++
    } else if (args[i] === '--quick') {
      quick = true
    }
  }

  return { vus, duration, quick }
}

function checkK6(): boolean {
  try {
    execSync('k6 version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function checkBun(): boolean {
  try {
    execSync('bun --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function startServer(): Promise<ChildProcess> {
  const hasBun = checkBun()

  if (hasBun) {
    console.log('Starting Hono+Bun server...')
  } else {
    console.log('Starting Hono+Node server (Bun not available)...')
    console.log('  Note: For accurate benchmarks, install Bun: curl -fsSL https://bun.sh/install | bash')
  }

  const command = hasBun ? 'bun' : 'npx'
  const args = hasBun ? ['run', 'src/servers/hono-server.ts'] : ['tsx', 'src/servers/hono-server.ts']

  const serverProcess = spawn(command, args, {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: PORT.toString() },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      serverProcess.kill()
      reject(new Error('Server failed to start within 10 seconds'))
    }, 10000)

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log(`[Hono] ${output.trim()}`)
      if (output.includes('Server running')) {
        clearTimeout(timeout)
        setTimeout(() => resolve(serverProcess), 500)
      }
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Hono] ERROR: ${data.toString().trim()}`)
    })

    serverProcess.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function runBenchmark(options: { vus: number; duration: string; quick: boolean }) {
  const scriptPath = options.quick
    ? 'src/k6/quick-benchmark.js'
    : 'src/k6/benchmark.js'

  console.log(`\nRunning k6 benchmark...`)
  console.log(`  URL: ${BASE_URL}`)
  console.log(`  VUs: ${options.vus}`)
  console.log(`  Duration: ${options.duration}`)
  console.log(`  Script: ${scriptPath}`)
  console.log('')

  return new Promise<void>((resolve, reject) => {
    const k6Process = spawn('k6', [
      'run',
      '--vus', options.vus.toString(),
      '--duration', options.duration,
      '--env', `BASE_URL=${BASE_URL}`,
      '--summary-trend-stats', 'avg,min,med,max,p(90),p(95),p(99)',
      scriptPath
    ], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    })

    k6Process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`k6 exited with code ${code}`))
      } else {
        resolve()
      }
    })
  })
}

async function main() {
  const hasBun = checkBun()
  const serverType = hasBun ? 'Hono + Bun' : 'Hono + Node.js'

  console.log(`${serverType} tRPC Benchmark`)
  console.log('='.repeat(50))

  if (!checkK6()) {
    console.error('Error: k6 is not installed')
    process.exit(1)
  }

  const options = parseArgs()
  let serverProcess: ChildProcess | null = null

  try {
    serverProcess = await startServer()
    await runBenchmark(options)
  } catch (error) {
    console.error('Benchmark error:', error)
    process.exit(1)
  } finally {
    if (serverProcess) {
      console.log('\nStopping server...')
      serverProcess.kill('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  console.log('\nBenchmark complete!')
}

main()
