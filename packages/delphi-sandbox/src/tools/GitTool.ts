// npx vitest run src/__tests__/unit/tools.spec.ts
import type { ContainerHandle } from '../container/ContainerHandle.js'
import type { SandboxTool, ToolResult } from './SandboxTool.js'

export class GitTool implements SandboxTool {
  readonly name = 'git'
  readonly description =
    'Execute git commands in the sandbox. Use for checking status, creating commits, viewing diffs, switching branches, etc.'
  readonly parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description:
          'The git subcommand and arguments (e.g., "status", "diff", "add -A", "commit -m \\"msg\\"")',
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

    const result = await container.exec(`git ${command}`, {
      cwd: (args.cwd as string) ?? undefined,
      timeout: 60_000,
    })

    return {
      output: result.stdout || result.stderr,
      error: result.exitCode !== 0 ? result.stderr : undefined,
      exitCode: result.exitCode,
    }
  }
}
