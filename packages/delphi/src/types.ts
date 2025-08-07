/**
 * Type definitions for the Delphi automated dev pipeline.
 */
import { z } from 'zod'

// Flow state schema for type safety
export const FlowStateSchema = z.object({
  // Core task information
  task: z.string().describe("User's raw request/goal"),
  spec: z.string().default('').describe('Refined specification from agents'),

  // Execution results
  codeDiff: z.string().optional().describe('Git patch from Claude Code'),
  testResults: z.string().optional().describe('Test execution output'),

  // Review and approval
  approved: z.boolean().optional().describe('Reviewer verdict'),
  reviewFeedback: z.string().optional().describe('Detailed review feedback'),

  // Execution context
  repoPath: z.string().describe('Working directory for Claude Code'),
  mcpServers: z.array(z.string()).optional().describe('MCP servers to connect'),

  // Metadata
  iterationCount: z.number().default(0).describe('Number of refinement loops'),
  timestamp: z
    .number()
    .default(() => Date.now())
    .describe('Creation timestamp'),
  threadId: z
    .string()
    .optional()
    .describe('LangGraph thread ID for checkpointing')
})

// Infer TypeScript type from Zod schema
export type FlowState = z.infer<typeof FlowStateSchema>

// Agent response types
export interface PlannerResponse {
  draft: string
}

export interface RefinerResponse {
  refined: string
  clear: boolean
}

export interface ReviewerResponse {
  ok: boolean
  feedback?: string
}

// Claude Code execution options
export interface ClaudeCodeOptions {
  spec: string
  cwd: string
  diff?: boolean
  mcpServers?: string[]
  timeout?: number
}

// Graph node types
export type NodeType = 'plan' | 'refine' | 'code' | 'test' | 'review'

// Graph configuration
export interface GraphConfig {
  maxIterations?: number
  testCommand?: string
  enableTests?: boolean
  claudeCodePath?: string
  autogenServiceUrl?: string
  maxRetries?: number
  retryDelayMs?: number
}

// Error types
export class DelphiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'DelphiError'
  }
}

export class AgentError extends DelphiError {
  constructor(message: string, details?: any) {
    super(message, 'AGENT_ERROR', details)
  }
}

export class ExecutionError extends DelphiError {
  constructor(message: string, details?: any) {
    super(message, 'EXECUTION_ERROR', details)
  }
}

export class TimeoutError extends DelphiError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', details)
  }
}
