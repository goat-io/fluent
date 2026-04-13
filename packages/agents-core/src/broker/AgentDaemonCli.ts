#!/usr/bin/env node
// npx tsx src/broker/AgentDaemonCli.ts
//
// Agent Daemon CLI — start a remote worker that connects to the platform via HTTPS.
// No Redis. No Postgres. Outbound HTTPS only.
//
// Usage:
//   BROKER_URL=https://platform.example.com \
//   BROKER_TOKEN=<registration-token> \
//   AGENTS_TENANT_ID=my-tenant \
//   npx @goatlab/agents-core agent start
//
// Or with tsx:
//   npx tsx src/broker/AgentDaemonCli.ts
//
import { AgentDaemon } from './AgentDaemon.js'
import { FunctionStepExecutor } from '../steps/FunctionStepExecutor.js'

const brokerUrl = process.env.BROKER_URL || process.env.AGENTS_ENGINE_URL
const registrationToken = process.env.BROKER_TOKEN || process.env.AGENTS_WORKER_TOKEN
const tenantId = process.env.AGENTS_TENANT_ID || 'default'
const name = process.env.AGENTS_WORKER_NAME

if (!brokerUrl) {
  console.error('Error: BROKER_URL environment variable is required')
  console.error('  Example: BROKER_URL=https://platform.example.com')
  process.exit(1)
}

if (!registrationToken) {
  console.error('Error: BROKER_TOKEN environment variable is required')
  console.error('  Generate one via the platform UI or API: POST /agents/token')
  process.exit(1)
}

// Default executor — users can import AgentDaemon directly for custom executors
const executor = new FunctionStepExecutor()

const daemon = new AgentDaemon({
  brokerUrl,
  registrationToken,
  tenantId,
  name,
  executors: new Map([['function', executor]]),
  logger: {
    info: (...args: unknown[]) => console.log('[agent]', ...args),
    warn: (...args: unknown[]) => console.warn('[agent]', ...args),
    error: (...args: unknown[]) => console.error('[agent]', ...args),
  },
})

console.log(`
╔══════════════════════════════════════════════╗
║    🐐 Goat Agent — Remote Worker             ║
╚══════════════════════════════════════════════╝

  Broker: ${brokerUrl}
  Tenant: ${tenantId}
  Name:   ${name || '(auto-detect hostname)'}
`)

daemon.start().catch((err) => {
  console.error('Failed to start agent:', err.message)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down...')
  await daemon.stop()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down...')
  await daemon.stop()
  process.exit(0)
})
