// npx vitest run src/__tests__/unit/tools.spec.ts
import type { SandboxToolName } from '../types/SandboxConfig.js'
import { BashTool } from './BashTool.js'
import { FileReadTool } from './FileReadTool.js'
import { FileWriteTool } from './FileWriteTool.js'
import { GitTool } from './GitTool.js'
import type { SandboxTool } from './SandboxTool.js'

/**
 * Registry of sandbox tools available to AI agents.
 * Maps tool names to implementations.
 */
export class SandboxToolRegistry {
  private tools = new Map<string, SandboxTool>()

  constructor() {
    // Register built-in tools
    this.register(new BashTool())
    this.register(new FileReadTool())
    this.register(new FileWriteTool())
    this.register(new GitTool())
  }

  register(tool: SandboxTool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): SandboxTool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get tools by names (for a step's tool list).
   */
  getTools(names: SandboxToolName[]): SandboxTool[] {
    return names
      .map(name => this.tools.get(name))
      .filter((t): t is SandboxTool => t !== undefined)
  }

  /**
   * Convert tools to LLM function definitions for tool calling.
   */
  toToolDefinitions(names: SandboxToolName[]): Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }> {
    return this.getTools(names).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))
  }

  listTools(): string[] {
    return Array.from(this.tools.keys())
  }
}
