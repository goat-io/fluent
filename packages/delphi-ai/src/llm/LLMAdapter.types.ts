// npx vitest run src/__tests__/llm/adapter.spec.ts
import { z } from 'zod'

export const ModelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'ollama',
  'custom',
])

export type ModelProvider = z.infer<typeof ModelProviderSchema>

export const ModelConfigSchema = z.object({
  provider: ModelProviderSchema,
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().optional(),
  topP: z.number().min(0).max(1).optional(),
  stopSequences: z.array(z.string()).optional(),
})

export type ModelConfig = z.infer<typeof ModelConfigSchema>

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ChatOptions {
  provider: ModelProvider
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
  apiKey?: string
  baseUrl?: string
}

export interface ChatResponse {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  toolCalls?: ToolCall[]
}

export interface AgentDefinition {
  id: string
  model: string | ModelConfig
  systemPrompt: string
  tools?: ToolDefinition[]
  temperature?: number
  maxTokens?: number
  role?: 'proposer' | 'reviewer' | 'arbiter'
  weight?: number
}
