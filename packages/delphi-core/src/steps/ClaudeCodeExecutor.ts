// npx vitest run src/__tests__/engine/claude-code.spec.ts
//
// ClaudeCodeExecutor — runs prompts via `claude -p` CLI (Claude Code).
// Uses your Claude Max subscription. No API key needed.
// The worker machine must have Claude Code installed and authenticated.
//
import { type ChildProcess, execSync, spawn } from 'node:child_process'
import type {
  StepExecutionContext,
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'
import type { StepExecutor } from './StepExecutor.js'

export interface ClaudeCodeConfig {
  /** The prompt to send to Claude. Supports template variables: {{input.fieldName}} */
  prompt?: string
  /** System prompt (replaces default) */
  systemPrompt?: string
  /** Append to default system prompt (keeps Claude Code defaults) */
  appendSystemPrompt?: string
  /** Output format: 'text' (default), 'json', or 'stream-json' */
  outputFormat?: 'text' | 'json' | 'stream-json'
  /** Max turns for agentic tasks (default: 1 for simple prompts) */
  maxTurns?: number
  /** Model override (e.g., 'sonnet', 'opus', 'claude-sonnet-4-20250514') */
  model?: string
  /** Fallback model when primary is overloaded */
  fallbackModel?: string
  /** Effort level: 'low', 'medium', 'high', 'max' */
  effort?: 'low' | 'medium' | 'high' | 'max'
  /** Max budget in USD for this step */
  maxBudgetUsd?: number
  /** Timeout in ms (default: 300_000 = 5 min) */
  timeoutMs?: number
  /** Allowed tools (e.g., ['Bash', 'Read', 'Edit', 'Glob', 'Grep']) */
  allowedTools?: string[]
  /** Disallowed tools */
  disallowedTools?: string[]
  /** Permission mode: 'default', 'acceptEdits', 'bypassPermissions', 'plan' */
  permissionMode?: string
  /** Working directory for Claude */
  cwd?: string
  /** Additional directories to allow access to */
  addDirs?: string[]
  /** JSON Schema for structured output validation */
  jsonSchema?: string
  /** MCP config (JSON string or file path) */
  mcpConfig?: string
  /** Include partial message chunks in stream-json */
  includePartialMessages?: boolean
  /** Verbose mode (required for stream-json) */
  verbose?: boolean
  /** Enable streaming — captures events and returns them in output */
  streaming?: boolean
}

export class ClaudeCodeExecutor implements StepExecutor {
  readonly type = 'claude_code'

  async execute(
    payload: StepPayload,
    _context?: StepExecutionContext,
  ): Promise<StepResult> {
    const config = payload.executorConfig as unknown as ClaudeCodeConfig
    const input = payload.input as Record<string, unknown>

    // Build the prompt — resolve template variables from input
    let prompt = config.prompt ?? ''
    if (!prompt && typeof input.prompt === 'string') {
      prompt = input.prompt
    }
    prompt = prompt.replace(/\{\{input\.(\w+)\}\}/g, (_match, field) => {
      const value = input[field]
      return value !== undefined ? String(value) : ''
    })
    if (!prompt && Object.keys(input).length > 0) {
      prompt = JSON.stringify(input, null, 2)
    }
    if (!prompt.trim()) {
      throw new Error('ClaudeCodeExecutor: no prompt provided')
    }

    // Build CLI args
    const args: string[] = ['-p', prompt]

    if (config.systemPrompt) {
      args.push('--system-prompt', config.systemPrompt)
    }
    if (config.appendSystemPrompt) {
      args.push('--append-system-prompt', config.appendSystemPrompt)
    }
    if (config.model) {
      args.push('--model', config.model)
    }
    if (config.fallbackModel) {
      args.push('--fallback-model', config.fallbackModel)
    }
    if (config.maxTurns) {
      args.push('--max-turns', String(config.maxTurns))
    }
    if (config.effort) {
      args.push('--effort', config.effort)
    }
    if (config.maxBudgetUsd) {
      args.push('--max-budget-usd', String(config.maxBudgetUsd))
    }
    if (config.permissionMode) {
      args.push('--permission-mode', config.permissionMode)
    }
    if (config.cwd) {
      args.push('--add-dir', config.cwd)
    }
    if (config.jsonSchema) {
      args.push('--json-schema', config.jsonSchema)
    }
    if (config.mcpConfig) {
      args.push('--mcp-config', config.mcpConfig)
    }

    if (config.addDirs?.length) {
      for (const dir of config.addDirs) {
        args.push('--add-dir', dir)
      }
    }
    if (config.allowedTools?.length) {
      args.push('--allowedTools', config.allowedTools.join(' '))
    }
    if (config.disallowedTools?.length) {
      args.push('--disallowedTools', config.disallowedTools.join(' '))
    }

    // Determine output format
    const streaming = config.streaming || config.outputFormat === 'stream-json'
    if (streaming) {
      args.push('--output-format', 'stream-json', '--verbose')
      if (config.includePartialMessages) {
        args.push('--include-partial-messages')
      }
    } else if (config.outputFormat === 'json') {
      args.push('--output-format', 'json')
    }
    if (config.verbose && !streaming) {
      args.push('--verbose')
    }

    const timeoutMs = config.timeoutMs ?? 300_000

    if (streaming) {
      return this.executeStreaming(args, timeoutMs)
    }
    return this.executeSync(args, timeoutMs, config)
  }

  private executeSync(
    args: string[],
    timeoutMs: number,
    config: ClaudeCodeConfig,
  ): StepResult {
    try {
      const cmd = `claude ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`
      const stdout = execSync(cmd, {
        encoding: 'utf-8',
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let output: Record<string, any>
      if (config.outputFormat === 'json') {
        try {
          const parsed = JSON.parse(stdout)
          output = { result: parsed }
          if (parsed.usage) {
            output._usage = {
              tokens:
                (parsed.usage.input_tokens ?? 0) +
                (parsed.usage.output_tokens ?? 0),
              model: parsed.model ?? config.model ?? 'claude',
            }
          }
        } catch {
          output = { result: stdout.trim() }
        }
      } else {
        output = { result: stdout.trim() }
      }
      return { output }
    } catch (err: any) {
      if (err.killed || err.signal === 'SIGTERM') {
        throw new Error(`Claude Code timed out after ${timeoutMs}ms`)
      }
      const stderr = err.stderr?.toString?.()?.trim?.() ?? ''
      throw new Error(stderr || err.message || 'Claude Code execution failed')
    }
  }

  private async executeStreaming(
    args: string[],
    timeoutMs: number,
  ): Promise<StepResult> {
    return new Promise((resolve, reject) => {
      const child: ChildProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const events: Record<string, any>[] = []
      let resultText = ''
      let usage: Record<string, any> | null = null
      let buffer = ''

      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(`Claude Code timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      child.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) {
            continue
          }
          try {
            const event = JSON.parse(line)
            events.push(event)

            if (event.type === 'assistant' && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text') {
                  resultText += block.text
                }
              }
            }
            if (event.type === 'result') {
              resultText = event.result ?? resultText
              if (event.usage) {
                usage = event.usage
              }
            }
          } catch {
            /* non-JSON line */
          }
        }
      })

      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('close', code => {
        clearTimeout(timer)
        if (code !== 0 && !resultText) {
          reject(
            new Error(stderr.trim() || `Claude Code exited with code ${code}`),
          )
          return
        }

        const output: Record<string, any> = {
          result: resultText.trim(),
          events,
          eventCount: events.length,
        }
        if (usage) {
          output._usage = {
            tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
            costUsd: usage.total_cost_usd,
            model: Object.keys(usage.modelUsage ?? {})[0] ?? 'claude',
          }
        }
        resolve({ output })
      })

      child.on('error', err => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }
}
