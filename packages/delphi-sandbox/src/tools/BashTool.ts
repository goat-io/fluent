// npx vitest run src/__tests__/unit/tools.spec.ts
import type { ContainerHandle } from '../container/ContainerHandle.js'
import type { SandboxTool, ToolResult } from './SandboxTool.js'

export class BashTool implements SandboxTool {
  readonly name = 'bash'
  readonly description =
    'Execute a shell command in the sandbox environment. Use this for running scripts, installing packages, building projects, running tests, etc.'
  readonly parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory (default: /workspace)',
      },
    },
    required: ['command'],
  }

  async execute(
    container: ContainerHandle,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const command = args.command as string
    if (!command) {
      return { output: '', error: 'command is required', exitCode: 1 }
    }

    const result = await container.exec(command, {
      cwd: (args.cwd as string) ?? undefined,
      timeout: 120_000,
    })

    return {
      output: result.stdout || result.stderr,
      error: result.exitCode !== 0 ? result.stderr : undefined,
      exitCode: result.exitCode,
    }
  }
}
