/**
 * Discussion Builder
 * Fluent API for defining and initiating agent discussions
 */
import { z } from 'zod'
import { LLMAdapter } from '../llm/adapter.js'
import {
  ModelConfig,
  ModelConfigSchema,
  modelSelector
} from './model-config.js'
import { Agent, AgreementOrchestrator } from './orchestrator.js'
import { AgentRole, AgreementSessionConfig } from './protocol.js'
import { ConsensusResult } from './types.js'

// Discussion context schema
export const DiscussionContextSchema = z.object({
  goal: z.string(),
  constraints: z.array(z.string()).optional(),
  deliverables: z.array(z.string()),
  successCriteria: z.array(z.string()),
  context: z.record(z.string(), z.unknown()).optional(),
  examples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
        explanation: z.string().optional()
      })
    )
    .optional(),
  domain: z
    .enum(['code', 'architecture', 'testing', 'review', 'design'])
    .optional()
    .default('code')
})

export type DiscussionContext = z.infer<typeof DiscussionContextSchema>

// Agent configuration schema
export const AgentConfigSchema = z.object({
  id: z.string(),
  role: z.nativeEnum(AgentRole),
  model: z.union([z.string(), ModelConfigSchema]).optional(),
  expertise: z.array(z.string()).optional(),
  personality: z
    .enum(['analytical', 'creative', 'critical', 'supportive'])
    .optional(),
  weight: z.number().min(0).max(1).default(1),
  systemPrompt: z.string().optional()
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

// Discussion parameters
export const DiscussionParametersSchema = z.object({
  maxTurns: z.number().min(1).max(10).default(5),
  maxDurationMs: z.number().min(1000).max(300000).default(90000),
  tokenBudgetPerTurn: z.number().min(100).max(10000).default(2000),
  consensusThreshold: z.number().min(0.5).max(1).default(0.66),
  conflictResolution: z
    .enum(['majority', 'arbiter', 'weighted', 'unanimous'])
    .default('majority'),
  parallelExecution: z.boolean().default(true),
  requireExplanation: z.boolean().default(true),
  allowDissent: z.boolean().default(true)
})

export type DiscussionParameters = z.infer<typeof DiscussionParametersSchema>

/**
 * Discussion Builder - Fluent API for configuring agent discussions
 */
export class DiscussionBuilder<_T = any> {
  private context: Partial<DiscussionContext> = {}
  private agents: AgentConfig[] = []
  private parameters: Partial<DiscussionParameters> = {}
  private llmAdapter?: LLMAdapter
  private timeoutMs?: number
  private strategy?: string

  /**
   * Set the main goal of the discussion
   */
  goal(goal: string): this {
    this.context.goal = goal
    return this
  }

  /**
   * Add constraints that must be respected
   */
  withConstraints(...constraints: string[]): this {
    this.context.constraints = [
      ...(this.context.constraints || []),
      ...constraints
    ]
    return this
  }

  /**
   * Define expected deliverables
   */
  expecting(...deliverables: string[]): this {
    this.context.deliverables = [
      ...(this.context.deliverables || []),
      ...deliverables
    ]
    return this
  }

  /**
   * Define success criteria
   */
  successWhen(...criteria: string[]): this {
    this.context.successCriteria = [
      ...(this.context.successCriteria || []),
      ...criteria
    ]
    return this
  }

  /**
   * Add contextual information
   */
  withContext(key: string, value: unknown): this {
    this.context.context = { ...this.context.context, [key]: value }
    return this
  }

  /**
   * Add examples to guide the discussion
   */
  withExample(input: string, output: string, explanation?: string): this {
    this.context.examples = [
      ...(this.context.examples || []),
      { input, output, explanation }
    ]
    return this
  }

  /**
   * Set the domain of discussion
   */
  inDomain(domain: DiscussionContext['domain']): this {
    this.context.domain = domain
    return this
  }

  /**
   * Add a proposer agent with optional model configuration
   */
  withProposer(config: Omit<AgentConfig, 'role'>): this {
    // If model is specified as a string, try to resolve it from presets
    if (config.model && typeof config.model === 'string') {
      const resolved = modelSelector.resolveModelConfig(config.model)
      if (resolved) {
        config = { ...config, model: resolved }
      }
    }
    this.agents.push({ ...config, role: AgentRole.PROPOSER })
    return this
  }

  /**
   * Add a reviewer agent with optional model configuration
   */
  withReviewer(config: Omit<AgentConfig, 'role'>): this {
    // If model is specified as a string, try to resolve it from presets
    if (config.model && typeof config.model === 'string') {
      const resolved = modelSelector.resolveModelConfig(config.model)
      if (resolved) {
        config = { ...config, model: resolved }
      }
    }
    this.agents.push({ ...config, role: AgentRole.REVIEWER })
    return this
  }

  /**
   * Add an arbiter agent for tie-breaking with optional model configuration
   */
  withArbiter(config: Omit<AgentConfig, 'role'>): this {
    // If model is specified as a string, try to resolve it from presets
    if (config.model && typeof config.model === 'string') {
      const resolved = modelSelector.resolveModelConfig(config.model)
      if (resolved) {
        config = { ...config, model: resolved }
      }
    }
    this.agents.push({ ...config, role: AgentRole.ARBITER })
    return this
  }

  /**
   * Add multiple reviewers with similar config
   */
  withReviewers(
    count: number,
    baseConfig: Partial<Omit<AgentConfig, 'role' | 'id'>>
  ): this {
    for (let i = 0; i < count; i++) {
      this.agents.push({
        id: `reviewer-${i + 1}`,
        role: AgentRole.REVIEWER,
        weight: 1,
        ...baseConfig
      })
    }
    return this
  }

  /**
   * Configure discussion parameters
   */
  configure(params: Partial<DiscussionParameters>): this {
    this.parameters = { ...this.parameters, ...params }
    return this
  }

  /**
   * Set maximum discussion duration
   */
  timeLimit(ms: number): this {
    this.parameters.maxDurationMs = ms
    return this
  }

  /**
   * Set maximum discussion turns
   */
  maxTurns(turns: number): this {
    this.parameters.maxTurns = turns
    return this
  }

  /**
   * Set consensus threshold
   */
  requireConsensus(threshold: number): this {
    this.parameters.consensusThreshold = threshold
    return this
  }

  /**
   * Use specific LLM adapter
   */
  withLLM(adapter: LLMAdapter): this {
    this.llmAdapter = adapter
    return this
  }

  /**
   * Use a predefined strategy with optimized model mapping
   */
  useStrategy(strategy: string): this {
    this.strategy = strategy
    return this
  }

  /**
   * Build the discussion configuration
   */
  build(): {
    context: DiscussionContext
    agents: Agent[]
    config: AgreementSessionConfig
  } {
    // Validate context
    const validatedContext = DiscussionContextSchema.parse({
      ...this.context,
      deliverables: this.context.deliverables || [],
      successCriteria: this.context.successCriteria || []
    })

    // Validate parameters
    const validatedParams = DiscussionParametersSchema.parse(this.parameters)

    // Ensure we have required agents
    if (!this.agents.some(a => a.role === AgentRole.PROPOSER)) {
      throw new Error('At least one proposer agent is required')
    }

    if (!this.agents.some(a => a.role === AgentRole.REVIEWER)) {
      throw new Error('At least one reviewer agent is required')
    }

    // Create LLM adapter if not provided
    const adapter = this.llmAdapter || new LLMAdapter()

    // Create agent instances
    const agentInstances = this.agents.map(config =>
      this.createAgent(config, validatedContext, adapter)
    )

    // Create session config
    const sessionConfig: AgreementSessionConfig = {
      sessionId: crypto.randomUUID(),
      maxTurns: validatedParams.maxTurns,
      maxDurationMs: validatedParams.maxDurationMs,
      tokenBudgetPerTurn: validatedParams.tokenBudgetPerTurn,
      minConsensusScore: validatedParams.consensusThreshold,
      conflictResolution: validatedParams.conflictResolution as any,
      agents: this.agents.map(a => ({
        id: a.id,
        role: a.role,
        weight: a.weight,
        model: typeof a.model === 'string' ? a.model : a.model?.model
      }))
    }

    return {
      context: validatedContext,
      agents: agentInstances,
      config: sessionConfig
    }
  }

  /**
   * Build and run the discussion with timeout protection
   */
  async run(): Promise<ConsensusResult | null> {
    const { context, agents, config } = this.build()

    // Create orchestrator
    const orchestrator = new AgreementOrchestrator(config, agents, {
      enableTracing: true
    })

    try {
      // Format initial proposal from context
      const proposal = this.formatProposal(context)

      // Create timeout promise if configured
      const timeoutMs = this.timeoutMs || this.parameters.maxDurationMs || 90000
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Discussion timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      })

      // Race between agreement and timeout
      const result = await Promise.race([
        orchestrator.runAgreement(proposal),
        timeoutPromise
      ])

      // Transform to ConsensusResult
      if (result) {
        return {
          proposalId: result.proposalId,
          finalContent: result.finalContent,
          consensus: result.consensus,
          auditTrail: result.auditTrail,
          sessionId: config.sessionId,
          duration: Date.now() - orchestrator.getStartTime(),
          iterations: orchestrator.getIterationCount()
        } as ConsensusResult
      }

      return null
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw error
      }
      throw new Error(`Discussion failed: ${error}`)
    } finally {
      await orchestrator.close()
    }
  }

  /**
   * Set explicit timeout for discussion
   */
  withTimeout(ms: number): this {
    this.timeoutMs = ms
    return this
  }

  private createAgent(
    config: AgentConfig,
    context: DiscussionContext,
    adapter: LLMAdapter
  ): Agent {
    const systemPrompt =
      config.systemPrompt || this.generateSystemPrompt(config, context)

    // Use model from agent config directly, or fall back to strategy mapping
    let modelConfig: ModelConfig | undefined
    if (config.model) {
      // Model specified directly on the agent
      modelConfig =
        typeof config.model === 'string'
          ? modelSelector.resolveModelConfig(config.model)
          : config.model
    } else {
      // Fall back to strategy-based model mapping if available
      modelConfig = this.getModelForAgent(config)
    }

    const modelName =
      modelConfig?.model ||
      (typeof config.model === 'string' ? config.model : undefined)

    return {
      id: config.id,
      role: config.role,
      weight: config.weight,
      model: modelName,
      execute: async (prompt: string, execContext: any) => {
        const messages = [
          {
            role: 'system' as const,
            content: systemPrompt
          },
          {
            role: 'user' as const,
            content: prompt
          }
        ]

        const response = await adapter.chat({
          messages,
          temperature: this.getTemperatureForRole(config.role),
          maxTokens: this.parameters.tokenBudgetPerTurn || 2000,
          useSmall:
            (typeof config.model === 'string' &&
              (config.model.includes('small') ||
                config.model.includes('haiku'))) ||
            (typeof config.model === 'object' &&
              config.model?.model &&
              (config.model.model.includes('small') ||
                config.model.model.includes('haiku')))
        })

        return {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          role: config.role,
          agentId: config.id,
          step: execContext.step,
          payload: this.parseAgentResponse(
            response.content,
            config.role,
            execContext.step
          ),
          tokenUsage: response.usage
            ? {
                prompt: response.usage.promptTokens,
                completion: response.usage.completionTokens,
                total: response.usage.totalTokens
              }
            : undefined
        }
      }
    }
  }

  private generateSystemPrompt(
    config: AgentConfig,
    context: DiscussionContext
  ): string {
    const rolePrompts = {
      [AgentRole.PROPOSER]: `You are a proposer agent responsible for creating and refining proposals.`,
      [AgentRole.REVIEWER]: `You are a reviewer agent responsible for critically evaluating proposals.`,
      [AgentRole.ARBITER]: `You are an arbiter agent responsible for resolving conflicts and making final decisions.`,
      [AgentRole.OBSERVER]: `You are an observer agent monitoring the discussion.`
    }

    const personalityTraits = {
      analytical:
        'You approach problems systematically and value data-driven decisions.',
      creative: 'You think outside the box and propose innovative solutions.',
      critical:
        'You identify potential issues and edge cases others might miss.',
      supportive:
        "You build on others' ideas and find ways to make proposals work."
    }

    return `
${rolePrompts[config.role]}

Domain: ${context.domain}
Goal: ${context.goal}

${config.expertise ? `Your expertise: ${config.expertise.join(', ')}` : ''}
${config.personality ? personalityTraits[config.personality] : ''}

Constraints:
${context.constraints?.map(c => `- ${c}`).join('\n') || 'None specified'}

Expected Deliverables:
${context.deliverables.map(d => `- ${d}`).join('\n')}

Success Criteria:
${context.successCriteria.map(c => `- ${c}`).join('\n')}

${
  context.examples
    ? `
Examples:
${context.examples
  .map(
    e => `
Input: ${e.input}
Output: ${e.output}
${e.explanation ? `Explanation: ${e.explanation}` : ''}
`
  )
  .join('\n')}
`
    : ''
}

When participating in the discussion:
1. Stay focused on the goal and constraints
2. Provide structured, actionable feedback
3. Support your arguments with reasoning
4. Be concise but thorough
5. Respond in JSON format matching the agreement protocol
`
  }

  private formatProposal(context: DiscussionContext): string {
    return JSON.stringify(
      {
        goal: context.goal,
        constraints: context.constraints,
        deliverables: context.deliverables,
        successCriteria: context.successCriteria,
        context: context.context,
        examples: context.examples
      },
      null,
      2
    )
  }

  private getTemperatureForRole(role: AgentRole): number {
    switch (role) {
      case AgentRole.PROPOSER:
        return 0.7 // Creative but controlled
      case AgentRole.REVIEWER:
        return 0.3 // More deterministic
      case AgentRole.ARBITER:
        return 0.1 // Very deterministic
      default:
        return 0.5
    }
  }

  private parseAgentResponse(
    content: string,
    _role: AgentRole,
    step: string
  ): any {
    try {
      return JSON.parse(content)
    } catch {
      // Fallback parsing based on role and step
      if (step === 'propose') {
        return {
          content: content,
          rationale: 'Generated proposal',
          confidence: 0.7
        }
      }
      if (step === 'critique') {
        return {
          proposalId: 'current',
          concerns: [],
          overallAssessment: 'refine',
          confidence: 0.6
        }
      }
      return {
        content: content
      }
    }
  }

  /**
   * Get the model configuration for a specific agent based on strategy
   */
  private getModelForAgent(config: AgentConfig): ModelConfig | undefined {
    if (!this.strategy) {
      return undefined
    }

    // Get strategy models
    const strategyModels = modelSelector.getStrategyModels(this.strategy)

    // Get model based on role
    let modelOrConfig: string | ModelConfig | undefined

    if (config.role === AgentRole.PROPOSER) {
      modelOrConfig = strategyModels.proposer
    } else if (config.role === AgentRole.ARBITER) {
      modelOrConfig = strategyModels.arbiter
    } else if (config.role === AgentRole.REVIEWER) {
      // For reviewers, distribute models if multiple are configured
      const reviewerModels = Array.isArray(strategyModels.reviewer)
        ? strategyModels.reviewer
        : [strategyModels.reviewer]

      // Find the index of this reviewer
      const reviewerIndex = this.agents
        .filter(a => a.role === AgentRole.REVIEWER)
        .findIndex(a => a.id === config.id)

      if (reviewerIndex >= 0 && reviewerModels.length > 0) {
        modelOrConfig = reviewerModels[reviewerIndex % reviewerModels.length]
      }
    }

    // Resolve to model config
    if (modelOrConfig) {
      return modelSelector.resolveModelConfig(modelOrConfig)
    }

    return undefined
  }
}
