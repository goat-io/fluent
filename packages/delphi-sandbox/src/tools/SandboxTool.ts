// npx vitest run src/__tests__/unit/tools.spec.ts
import type { ContainerHandle } from '../container/ContainerHandle.js'

export interface ToolResult {
  output: string
  error?: string
  exitCode: number
}

export interface SandboxTool {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
  execute(
    container: ContainerHandle,
    args: Record<string, unknown>,
  ): Promise<ToolResult>
}
