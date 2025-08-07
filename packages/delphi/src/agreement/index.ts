/**
 * Agreement Module Exports
 * Public API for agent consensus system
 */

export * from './blackboard.js'
export * from './orchestrator.js'
export * from './protocol.js'
export * from './risk-guard.js'
export * from './state-machine.js'

// Integration with LangGraph
import { Annotation } from '@langchain/langgraph'
import { context, SpanStatusCode, trace } from '@opentelemetry/api'
import { Agent, AgreementOrchestrator } from './orchestrator.js'
import { AgentRole, AgreementSessionConfig } from './protocol.js'

const tracer = trace.getTracer('delphi-agreement')

/**
 * LangGraph annotation for agreement state
 */
export const AgreementAnnotation = Annotation.Root({
  agreementSessionId: Annotation<string>(),
  agreementResult: Annotation<any>(),
  consensusScore: Annotation<number>(),
  agreementDuration: Annotation<number>()
})

/**
 * Run agent agreement as a LangGraph node
 */
export async function runAgreementNode(
  state: any,
  agents: Agent[],
  config?: Partial<AgreementSessionConfig>
): Promise<any> {
  const span = tracer.startSpan('agreement.node')
  const ctx = trace.setSpan(context.active(), span)

  return await context.with(ctx, async () => {
    const startTime = Date.now()

    try {
      // Create session config
      const sessionConfig: AgreementSessionConfig = {
        sessionId: state.agreementSessionId || crypto.randomUUID(),
        maxTurns: config?.maxTurns || 5,
        maxDurationMs: config?.maxDurationMs || 90000,
        tokenBudgetPerTurn: config?.tokenBudgetPerTurn || 2000,
        minConsensusScore: config?.minConsensusScore || 0.66,
        conflictResolution: config?.conflictResolution || 'majority',
        agents: agents.map(a => ({
          id: a.id,
          role: a.role,
          weight: a.weight || 1,
          model: a.model
        }))
      }

      // Create orchestrator
      const orchestrator = new AgreementOrchestrator(sessionConfig, agents, {
        enableTracing: true
      })

      // Track events
      orchestrator.on('stateChange', ({ from, to }) => {
        span.addEvent('state_change', {
          'agreement.state.from': from,
          'agreement.state.to': to
        })
      })

      orchestrator.on('message', message => {
        span.addEvent('agent_message', {
          'agreement.agent': message.agentId,
          'agreement.step': message.step
        })
      })

      // Run agreement
      const proposal = state.spec || state.task || 'No proposal provided'
      const result = await orchestrator.runAgreement(proposal)

      const duration = Date.now() - startTime

      if (result) {
        span.setStatus({ code: SpanStatusCode.OK })
        span.setAttributes({
          'agreement.consensus.score': result.consensus.score,
          'agreement.consensus.method': result.consensus.method,
          'agreement.duration_ms': duration
        })

        // Update state
        return {
          ...state,
          agreementSessionId: sessionConfig.sessionId,
          agreementResult: result,
          consensusScore: result.consensus.score,
          agreementDuration: duration,
          spec: result.finalContent // Update spec with agreed content
        }
      }
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Agreement failed'
      })

      // Return state with failure marker
      return {
        ...state,
        agreementSessionId: sessionConfig.sessionId,
        agreementResult: null,
        consensusScore: 0,
        agreementDuration: duration,
        approved: false,
        reviewFeedback: 'Agreement protocol failed to reach consensus'
      }
    } catch (error: any) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Create agent from LLM configuration
 */
export function createLLMAgent(
  id: string,
  role: AgentRole,
  llmAdapter: any,
  weight: number = 1
): Agent {
  return {
    id,
    role,
    weight,
    execute: async (prompt: string, context: any) => {
      const response = await llmAdapter.chat({
        messages: [
          {
            role: 'system',
            content: `You are an agent with role ${role} participating in a consensus protocol. 
                     Current step: ${context.step}. 
                     Session facts: ${JSON.stringify(context.sessionFacts || [])}
                     
                     Respond with a structured JSON message following the agreement protocol.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        maxTokens: 2000
      })

      // Parse and structure response
      const content = response.content
      let payload: any

      try {
        payload = JSON.parse(content)
      } catch {
        // Fallback for non-JSON responses
        payload = {
          content: content,
          rationale: 'Generated response',
          confidence: 0.7
        }
      }

      return {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        role,
        agentId: id,
        step: context.step,
        payload,
        tokenUsage: response.usage
      }
    }
  }
}
