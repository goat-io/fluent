// npx vitest run src/__tests__/unit/tools.spec.ts
import type { ContainerHandle } from '../container/ContainerHandle.js'
import type { SandboxTool, ToolResult } from './SandboxTool.js'

export class FileReadTool implements SandboxTool {
  readonly name = 'file_read'
  readonly description =
    'Read the contents of a file from the sandbox environment.'
  readonly parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the file to read',
      },
    },
    required: ['path'],
  }

  async execute(
    container: ContainerHandle,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const path = args.path as string
    if (!path) {
      return { output: '', error: 'path is required', exitCode: 1 }
    }

    try {
      const content = await container.readFile(path)
      return { output: content, exitCode: 0 }
    } catch (err: any) {
      return { output: '', error: err.message, exitCode: 1 }
    }
  }
}
