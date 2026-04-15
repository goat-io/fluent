// npx vitest run src/__tests__/executors/ai-tool-loop.spec.ts

import type { Skill, StepPayload } from '@goatlab/delphi-core'
import { SkillRegistry } from '@goatlab/delphi-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIStepExecutor } from '../../executors/AIStepExecutor.js'
import type { ChatResponse } from '../../llm/LLMAdapter.types.js'

// Mock the LLMAdapter
vi.mock('../../llm/LLMAdapter.js', () => {
  return {
    LLMAdapter: vi.fn().mockImplementation(() => ({
      chat: vi.fn(),
      chatFromConfig: vi.fn(),
    })),
  }
})

// Mock ModelSelector
vi.mock('../../llm/ModelSelector.js', () => ({
  modelSelector: {
    resolveModelConfig: (name: string) => ({
      provider: 'openai' as const,
      model: name,
      temperature: 0.7,
      maxTokens: 1000,
    }),
  },
}))

function makePayload(overrides?: Partial<StepPayload>): StepPayload {
  return {
    workflowRunId: 'wf-1',
    stepName: 'ai_step',
    tenantId: 'test',
    input: { question: 'What is 2+2?' },
    attempt: 1,
    executorType: 'ai',
    executorConfig: {
      model: 'gpt-4o',
      systemPrompt: 'You are a helpful assistant.',
    },
    ...overrides,
  }
}

function makeSearchSkill(): Skill {
  return {
    name: 'web_search',
    description: 'Search the web',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    execute: vi.fn().mockResolvedValue({
      results: [{ title: 'Result 1', url: 'https://example.com' }],
    }),
  }
}

describe('AIStepExecutor Tool-Calling Loop', () => {
  let mockChat: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function getAdapter(executor: AIStepExecutor): any {
    return (executor as any).adapter
  }

  it('executes without tools when no skills provided', async () => {
    const executor = new AIStepExecutor({})
    mockChat = getAdapter(executor).chat

    const finalResponse: ChatResponse = {
      content: 'The answer is 4',
      model: 'openai/gpt-4o',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }
    mockChat.mockResolvedValueOnce(finalResponse)

    const result = await executor.execute(makePayload())

    expect(result.output.response).toBe('The answer is 4')
    expect(result.output.turns).toBe(1)
    expect(mockChat).toHaveBeenCalledTimes(1)
    // Should not pass tools
    expect(mockChat.mock.calls[0][0].tools).toBeUndefined()
  })

  it('executes tool-calling loop: tool call → skill execute → final answer', async () => {
    const skills = new SkillRegistry()
    const searchSkill = makeSearchSkill()
    skills.register(searchSkill)

    const executor = new AIStepExecutor({ skills })
    mockChat = getAdapter(executor).chat

    // First call: LLM requests a tool call
    const toolCallResponse: ChatResponse = {
      content: '',
      model: 'openai/gpt-4o',
      usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      toolCalls: [
        {
          id: 'tc-1',
          name: 'web_search',
          arguments: { query: 'what is 2+2' },
        },
      ],
    }

    // Second call: LLM returns final answer
    const finalResponse: ChatResponse = {
      content: 'Based on my search, 2+2=4',
      model: 'openai/gpt-4o',
      usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
    }

    mockChat
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(finalResponse)

    const result = await executor.execute(makePayload())

    // Verify the loop executed
    expect(mockChat).toHaveBeenCalledTimes(2)
    expect(result.output.response).toBe('Based on my search, 2+2=4')
    expect(result.output.turns).toBe(2)

    // Verify skill was executed with the correct arguments
    expect(searchSkill.execute).toHaveBeenCalledWith({ query: 'what is 2+2' })

    // Verify usage is accumulated
    expect(result.output.usage).toEqual({
      promptTokens: 50,
      completionTokens: 25,
      totalTokens: 75,
    })

    // Verify _usage for cost tracking
    expect(result.output._usage).toEqual({
      tokens: 75,
      model: 'gpt-4o',
      promptTokens: 50,
      completionTokens: 25,
    })

    // Verify second call includes tool result in messages
    const secondCallMessages = mockChat.mock.calls[1][0].messages
    expect(
      secondCallMessages.some(
        (m: any) =>
          m.role === 'user' && m.content.includes('Tool web_search result:'),
      ),
    ).toBe(true)
  })

  it('enforces maxToolTurns limit', async () => {
    const skills = new SkillRegistry()
    const searchSkill = makeSearchSkill()
    skills.register(searchSkill)

    const executor = new AIStepExecutor({ skills })
    mockChat = getAdapter(executor).chat

    // LLM always returns tool calls (infinite loop scenario)
    const toolCallResponse: ChatResponse = {
      content: '',
      model: 'openai/gpt-4o',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      toolCalls: [
        {
          id: 'tc-loop',
          name: 'web_search',
          arguments: { query: 'loop' },
        },
      ],
    }

    mockChat.mockResolvedValue(toolCallResponse)

    const payload = makePayload({
      executorConfig: {
        model: 'gpt-4o',
        systemPrompt: 'Test',
        maxToolTurns: 3,
      },
    })

    const result = await executor.execute(payload)

    // Should stop after maxToolTurns
    expect(mockChat).toHaveBeenCalledTimes(3)
    expect(result.output.turns).toBe(3)

    // Usage should be accumulated across all turns
    expect(result.output.usage).toEqual({
      promptTokens: 30,
      completionTokens: 15,
      totalTokens: 45,
    })
  })

  it('accumulates usage across multiple tool turns', async () => {
    const skills = new SkillRegistry()
    skills.register(makeSearchSkill())

    const executor = new AIStepExecutor({ skills })
    mockChat = getAdapter(executor).chat

    // 3 turns: tool call → tool call → final answer
    mockChat
      .mockResolvedValueOnce({
        content: '',
        model: 'openai/gpt-4o',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        toolCalls: [
          { id: 'tc-1', name: 'web_search', arguments: { query: 'a' } },
        ],
      })
      .mockResolvedValueOnce({
        content: '',
        model: 'openai/gpt-4o',
        usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
        toolCalls: [
          { id: 'tc-2', name: 'web_search', arguments: { query: 'b' } },
        ],
      })
      .mockResolvedValueOnce({
        content: 'Final answer',
        model: 'openai/gpt-4o',
        usage: { promptTokens: 300, completionTokens: 100, totalTokens: 400 },
      })

    const result = await executor.execute(makePayload())

    expect(result.output.usage).toEqual({
      promptTokens: 600,
      completionTokens: 230,
      totalTokens: 830,
    })
    expect(result.output.turns).toBe(3)
  })

  it('stops loop when maxTokenBudget is exceeded', async () => {
    const skills = new SkillRegistry()
    skills.register(makeSearchSkill())

    const executor = new AIStepExecutor({ skills })
    mockChat = getAdapter(executor).chat

    // Each call uses 80 tokens; budget is 100 → should stop after 2nd call
    const toolCallResponse: ChatResponse = {
      content: '',
      model: 'openai/gpt-4o',
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      toolCalls: [
        {
          id: 'tc-budget',
          name: 'web_search',
          arguments: { query: 'test' },
        },
      ],
    }

    mockChat.mockResolvedValue(toolCallResponse)

    const payload = makePayload({
      executorConfig: {
        model: 'gpt-4o',
        systemPrompt: 'Test',
        maxToolTurns: 10,
        maxTokenBudget: 100,
      },
    })

    const result = await executor.execute(payload)

    // Should stop after 2 turns (80 tokens first, then 160 total > 100 budget)
    expect(mockChat).toHaveBeenCalledTimes(2)
    expect(result.output.turns).toBe(2)
    expect(result.output.budgetExceeded).toBe(true)
    expect(result.output.budgetLimit).toBe(100)
    expect((result.output.usage as { totalTokens: number }).totalTokens).toBe(
      160,
    )
  })

  it('returns budgetExceeded flag in output when budget exceeded', async () => {
    const executor = new AIStepExecutor({})
    mockChat = getAdapter(executor).chat

    // Single call that exceeds the budget
    mockChat.mockResolvedValueOnce({
      content: 'Partial answer',
      model: 'openai/gpt-4o',
      usage: { promptTokens: 80, completionTokens: 30, totalTokens: 110 },
    })

    const payload = makePayload({
      executorConfig: {
        model: 'gpt-4o',
        systemPrompt: 'Test',
        maxTokenBudget: 50,
      },
    })

    const result = await executor.execute(payload)

    expect(result.output.budgetExceeded).toBe(true)
    expect(result.output.budgetLimit).toBe(50)
    expect(result.output.response).toBe('Partial answer')
  })

  it('passes tool definitions to LLM when skills are registered', async () => {
    const skills = new SkillRegistry()
    skills.register({
      name: 'calculator',
      description: 'Do math',
      inputSchema: { type: 'object', properties: { expr: { type: 'string' } } },
      execute: vi.fn().mockResolvedValue({ result: 42 }),
    })

    const executor = new AIStepExecutor({ skills })
    mockChat = getAdapter(executor).chat

    mockChat.mockResolvedValueOnce({
      content: 'Done',
      model: 'openai/gpt-4o',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    })

    await executor.execute(makePayload())

    const chatOptions = mockChat.mock.calls[0][0]
    expect(chatOptions.tools).toBeDefined()
    expect(chatOptions.tools).toHaveLength(1)
    expect(chatOptions.tools[0].name).toBe('calculator')
    expect(chatOptions.tools[0].description).toBe('Do math')
  })
})
