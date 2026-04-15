// npx vitest run src/__tests__/unit/tools.spec.ts
import type { ContainerHandle } from '../container/ContainerHandle.js'
import type { SandboxTool, ToolResult } from './SandboxTool.js'

export class FileWriteTool implements SandboxTool {
  readonly name = 'file_write'
  readonly description =
    'Write content to a file in the sandbox environment. Creates the file if it does not exist, overwrites if it does.'
  readonly parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to write to',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  }

  async execute(
    container: ContainerHandle,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const path = args.path as string
    const content = args.content as string
    if (!path || content === undefined) {
      return { output: '', error: 'path and content are required', exitCode: 1 }
    }

    try {
      // Ensure parent directory exists
      const dir = path.substring(0, path.lastIndexOf('/'))
      if (dir) {
        await container.exec(`mkdir -p ${dir}`, { cwd: '/' })
      }

      await container.writeFile(path, content)
      return { output: `Wrote ${content.length} bytes to ${path}`, exitCode: 0 }
    } catch (err: any) {
      return { output: '', error: err.message, exitCode: 1 }
    }
  }
}
