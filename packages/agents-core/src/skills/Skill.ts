// npx vitest run src/__tests__/engine/skills.spec.ts
import type { JsonObject } from '@goatlab/tasks-core'

export interface Skill {
  /** Unique skill name (e.g. 'web_search', 'code_execution') */
  name: string
  /** Human-readable description */
  description: string
  /** JSON Schema for input parameters */
  inputSchema?: JsonObject
  /** Execute the skill */
  execute(input: JsonObject, context?: unknown): Promise<JsonObject>
}

/** OpenAI-compatible tool definition for LLM function calling */
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters?: JsonObject
  }
}
