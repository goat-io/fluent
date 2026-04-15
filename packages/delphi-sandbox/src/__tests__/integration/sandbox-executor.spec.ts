// npx vitest run src/__tests__/integration/sandbox-executor.spec.ts
//
// Integration test: real Docker containers, no LLM calls.
// Requires a running Docker daemon.
//

import { existsSync } from 'node:fs'
import type { JsonObject, StepPayload } from '@goatlab/delphi-core'
import { describe, expect, it } from 'vitest'
import { SandboxStepExecutor } from '../../SandboxStepExecutor.js'

function makePayload(
  executorConfig: JsonObject,
  overrides?: Partial<StepPayload>,
): StepPayload {
  return {
    workflowRunId: 'test-run-123',
    stepName: 'test-step',
    tenantId: 'test-tenant',
    input: { message: 'hello from test' },
    attempt: 1,
    executorType: 'sandbox',
    executorConfig,
    ...overrides,
  }
}

// Synchronously check if Docker socket exists (for skipIf)
const dockerSocketCandidates = [
  process.env.DOCKER_HOST?.replace('unix://', ''),
  `${process.env.HOME}/.docker/run/docker.sock`,
  '/var/run/docker.sock',
].filter(Boolean) as string[]
const dockerSocket = dockerSocketCandidates.find(p => existsSync(p))
const dockerAvailable = !!dockerSocket

if (!dockerAvailable) {
  console.warn(
    '⚠️  Docker socket not found — skipping sandbox integration tests',
  )
}

describe('SandboxStepExecutor — Integration', () => {
  it.skipIf(!dockerAvailable)(
    'executes a simple script in a container',
    async () => {
      const executor = new SandboxStepExecutor()

      const result = await executor.execute(
        makePayload({
          image: 'alpine:latest',
          execute: {
            type: 'script',
            commands: ['echo "hello world"', 'echo "step: test-step"'],
          },
        }),
      )

      expect(result.output).toBeDefined()
      const output = result.output as any
      expect(output.success).toBe(true)
      expect(output.results).toHaveLength(2)
      expect(output.results[0].exitCode).toBe(0)
    },
  )

  it.skipIf(!dockerAvailable)(
    'runs setup commands before execution',
    async () => {
      const executor = new SandboxStepExecutor()

      const result = await executor.execute(
        makePayload({
          image: 'alpine:latest',
          setup: [
            'mkdir -p /workspace/src',
            'echo "setup complete" > /workspace/src/status.txt',
          ],
          execute: {
            type: 'script',
            commands: ['cat /workspace/src/status.txt'],
          },
        }),
      )

      const output = result.output as any
      expect(output.success).toBe(true)
      expect(output.stdout).toContain('setup complete')
    },
  )

  it.skipIf(!dockerAvailable)(
    'resolves {{workflowRunId}} in setup commands',
    async () => {
      const executor = new SandboxStepExecutor()

      const result = await executor.execute(
        makePayload({
          image: 'alpine:latest',
          setup: ['echo "run:{{workflowRunId}}" > /workspace/id.txt'],
          execute: {
            type: 'script',
            commands: ['cat /workspace/id.txt'],
          },
        }),
      )

      const output = result.output as any
      expect(output.success).toBe(true)
      expect(output.stdout).toContain('run:test-run-123')
    },
  )

  it.skipIf(!dockerAvailable)('injects secrets as env vars', async () => {
    const executor = new SandboxStepExecutor()

    const result = await executor.execute(
      makePayload({
        image: 'alpine:latest',
        secrets: { MY_SECRET: 'super-secret-value' },
        execute: {
          type: 'script',
          commands: ['echo "$MY_SECRET"'],
        },
      }),
    )

    const output = result.output as any
    expect(output.success).toBe(true)
    expect(output.stdout).toContain('super-secret-value')
  })

  it.skipIf(!dockerAvailable)('reports failed commands correctly', async () => {
    const executor = new SandboxStepExecutor()

    const result = await executor.execute(
      makePayload({
        image: 'alpine:latest',
        execute: {
          type: 'script',
          commands: ['echo "ok"', 'exit 42'],
        },
      }),
    )

    const output = result.output as any
    expect(output.success).toBe(false)
    expect(output.error).toContain('failed')
  })

  it.skipIf(!dockerAvailable)('extracts files from container', async () => {
    const executor = new SandboxStepExecutor()

    const result = await executor.execute(
      makePayload({
        image: 'alpine:latest',
        setup: ['echo "test data" > /workspace/output.txt'],
        execute: {
          type: 'script',
          commands: ['echo "done"'],
        },
        extract: {
          files: ['/workspace/output.txt'],
        },
      }),
    )

    const output = result.output as any
    expect(output._artifacts).toBeDefined()
    expect(output._artifacts.files).toBeDefined()
    expect(output._artifacts.files['/workspace/output.txt']).toBeDefined()
  })

  it.skipIf(!dockerAvailable)(
    'cleans up container after execution',
    async () => {
      const executor = new SandboxStepExecutor()
      const docker = executor.getContainerManager().getDocker()

      // Count containers before
      const beforeContainers = await docker.listContainers({
        all: true,
        filters: { label: ['goatlab.sandbox=true'] },
      })

      await executor.execute(
        makePayload({
          image: 'alpine:latest',
          execute: { type: 'script', commands: ['echo "cleanup test"'] },
        }),
      )

      // Count containers after — should be same (container was cleaned up)
      const afterContainers = await docker.listContainers({
        all: true,
        filters: { label: ['goatlab.sandbox=true'] },
      })

      expect(afterContainers.length).toBe(beforeContainers.length)
    },
  )

  it.skipIf(!dockerAvailable)(
    'cleans up container even on setup failure',
    async () => {
      const executor = new SandboxStepExecutor()

      await expect(
        executor.execute(
          makePayload({
            image: 'alpine:latest',
            setup: ['exit 1'], // Setup fails
            execute: { type: 'script', commands: ['echo "never runs"'] },
          }),
        ),
      ).rejects.toThrow(/Setup command failed/)
    },
  )

  it.skipIf(!dockerAvailable)(
    'handles git init and commit inside container',
    async () => {
      const executor = new SandboxStepExecutor()

      const result = await executor.execute(
        makePayload({
          image: 'alpine:latest',
          setup: [
            'apk add --no-cache git',
            'cd /workspace && git init',
            'git config user.email "test@test.com"',
            'git config user.name "Test"',
            'echo "hello" > /workspace/file.txt',
            'cd /workspace && git add -A && git commit -m "init"',
          ],
          execute: {
            type: 'script',
            commands: ['cd /workspace && git log --oneline'],
          },
          extract: {
            git: {},
          },
        }),
      )

      const output = result.output as any
      expect(output.success).toBe(true)
      expect(output.stdout).toContain('init')
      expect(output._artifacts?.git?.commitSha).toBeDefined()
      expect(output._artifacts?.git?.branch).toBeDefined()
    },
  )

  it.skipIf(!dockerAvailable)(
    'runs Node.js code inside container',
    async () => {
      const executor = new SandboxStepExecutor()

      const result = await executor.execute(
        makePayload({
          image: 'node:20-alpine',
          execute: {
            type: 'script',
            commands: [
              'node -e "console.log(JSON.stringify({ node: process.version, sum: 2+2 }))"',
            ],
          },
        }),
      )

      const output = result.output as any
      expect(output.success).toBe(true)
      const parsed = JSON.parse(output.stdout)
      expect(parsed.sum).toBe(4)
      expect(parsed.node).toContain('v20')
    },
  )
})
