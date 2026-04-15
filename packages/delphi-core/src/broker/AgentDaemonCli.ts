#!/usr/bin/env node
import { FunctionStepExecutor } from '../steps/FunctionStepExecutor.js'
// npx tsx src/broker/AgentDaemonCli.ts
//
// Agent Daemon CLI — start a remote worker that connects to the platform via HTTPS.
// No Redis. No Postgres. Outbound HTTPS only.
//
// Usage:
//   npx @goatlab/delphi-core agent start \
//     --url https://platform.example.com \
//     --token abc123 \
//     --tenant my-tenant
//
// Or with environment variables as fallback:
//   BROKER_URL=... BROKER_TOKEN=... AGENTS_TENANT_ID=... npx @goatlab/delphi-core agent start
//
import { AgentDaemon } from './AgentDaemon.js'

// ── Parse CLI args ──────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (
      arg.startsWith('--') &&
      i + 1 < argv.length &&
      !argv[i + 1].startsWith('--')
    ) {
      args[arg.slice(2)] = argv[i + 1]
      i++
    }
  }
  return args
}

const args = parseArgs(process.argv.slice(2))

const brokerUrl =
  args.url ||
  args.broker ||
  process.env.BROKER_URL ||
  process.env.AGENTS_ENGINE_URL
const registrationToken =
  args.token || process.env.BROKER_TOKEN || process.env.AGENTS_WORKER_TOKEN
const tenantId = args.tenant || process.env.AGENTS_TENANT_ID || 'default'
const name = args.name || process.env.AGENTS_WORKER_NAME

if (!brokerUrl) {
  console.error(`
Usage: npx @goatlab/delphi-core agent start --url <URL> --token <TOKEN> --tenant <TENANT>

Options:
  --url <url>        Platform URL (required)
  --token <token>    Registration token from "Add Worker" (required)
  --tenant <id>      Tenant ID (default: "default")
  --name <name>      Worker name (default: hostname)

Example:
  npx @goatlab/delphi-core agent start \\
    --url https://platform.example.com \\
    --token abc123def456 \\
    --tenant my-team
`)
  process.exit(1)
}

if (!registrationToken) {
  console.error(
    'Error: --token is required. Generate one via the platform UI: Workers > + Add Worker',
  )
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
║    Goat Agent — Remote Worker                ║
╚══════════════════════════════════════════════╝

  Platform: ${brokerUrl}
  Tenant:   ${tenantId}
  Name:     ${name || '(auto-detect hostname)'}
`)

daemon.start().catch(err => {
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
