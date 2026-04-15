// npx vitest run src/__tests__/unit/sandbox-agent-runner.spec.ts
import type { ChatMessage, LLMAdapter } from '@goatlab/delphi-ai'
import { modelSelector } from '@goatlab/delphi-ai'
import type { ContainerHandle } from '../container/ContainerHandle.js'
import { SandboxToolRegistry } from '../tools/SandboxToolRegistry.js'
import type { SandboxAgentExecution } from '../types/SandboxConfig.js'
import { DEFAULT_MAX_TURNS } from '../types/SandboxConfig.js'

export interface AgentRunResult {
  output: Record<string, unknown>
  toolCalls: number
  turns: number
  tokenUsage: { prompt: number; completion: number; total: number }
  conversation: ChatMessage[]
}

export class SandboxAgentRunner {
  private adapter: LLMAdapter
  private toolRegistry: SandboxToolRegistry
  private logger?: {
    info: (...a: unknown[]) => void
    debug: (...a: unknown[]) => void
  }

  constructor(
    adapter: LLMAdapter,
    toolRegistry?: SandboxToolRegistry,
    logger?: {
      info: (...a: unknown[]) => void
      debug: (...a: unknown[]) => void
    },
  ) {
    this.adapter = adapter
    this.toolRegistry = toolRegistry ?? new SandboxToolRegistry()
    this.logger = logger
  }

  async run(
    container: ContainerHandle,
    config: SandboxAgentExecution,
    input: Record<string, unknown>,
    onHeartbeat?: (data: Record<string, unknown>) => void,
  ): Promise<AgentRunResult> {
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS
    const _tools = this.toolRegistry.getTools(config.tools)
    const _toolDefs = this.toolRegistry.toToolDefinitions(config.tools)

    const resolvedModel = modelSelector.resolveModelConfig(config.model)

    const messages: ChatMessage[] = [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: JSON.stringify(input) },
    ]

    let totalToolCalls = 0
    const tokenUsage = { prompt: 0, completion: 0, total: 0 }

    for (let turn = 0; turn < maxTurns; turn++) {
      onHeartbeat?.({ turn, totalToolCalls, phase: 'llm_call' })

      // Call LLM
      const response = await this.adapter.chatFromConfig(
        {
          ...resolvedModel,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
        messages,
      )

      tokenUsage.prompt += response.usage.promptTokens
      tokenUsage.completion += response.usage.completionTokens
      tokenUsage.total += response.usage.totalTokens

      // Check for tool calls in the response
      if (response.toolCalls && response.toolCalls.length > 0) {
        messages.push({ role: 'assistant', content: response.content })

        for (const toolCall of response.toolCalls) {
          totalToolCalls++
          const tool = this.toolRegistry.get(toolCall.name)
          if (!tool) {
            messages.push({
              role: 'user',
              content: `Tool "${toolCall.name}" not found. Available: ${config.tools.join(', ')}`,
            })
            continue
          }

          this.logger?.debug?.(
            `[SandboxAgent] Tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`,
          )
          onHeartbeat?.({
            turn,
            totalToolCalls,
            phase: 'tool_exec',
            tool: toolCall.name,
          })

          const result = await tool.execute(container, toolCall.arguments)

          this.logger?.debug?.(
            `[SandboxAgent] Result: exitCode=${result.exitCode}, output=${result.output.substring(0, 200)}`,
          )

          messages.push({
            role: 'user',
            content: `Tool "${toolCall.name}" result (exit ${result.exitCode}):\n${result.output}${result.error ? `\nError: ${result.error}` : ''}`,
          })
        }
      } else {
        // LLM returned text without tool calls — agent is done
        messages.push({ role: 'assistant', content: response.content })

        this.logger?.info?.(
          `[SandboxAgent] Completed in ${turn + 1} turns, ${totalToolCalls} tool calls`,
        )

        // Try to parse final output as JSON, fall back to raw text
        let output: Record<string, unknown>
        try {
          output = JSON.parse(response.content)
        } catch {
          output = { result: response.content }
        }

        return {
          output,
          toolCalls: totalToolCalls,
          turns: turn + 1,
          tokenUsage,
          conversation: messages,
        }
      }
    }

    // Max turns reached
    return {
      output: {
        error: 'Max turns reached',
        turns: maxTurns,
        toolCalls: totalToolCalls,
      },
      toolCalls: totalToolCalls,
      turns: maxTurns,
      tokenUsage,
      conversation: messages,
    }
  }
}
