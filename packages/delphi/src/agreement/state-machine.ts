/**
 * Finite State Machine for Agent Agreement
 * Manages state transitions and enforces protocol rules
 */
import { EventEmitter } from 'node:events'
import {
  AgreementMessage,
  AgreementSessionConfig,
  AgreementState,
} from './protocol.js'

export interface StateTransition {
  from: AgreementState
  to: AgreementState
  condition?: (context: AgreementContext) => boolean
  action?: (context: AgreementContext) => Promise<void>
}

export interface AgreementContext {
  sessionId: string
  currentState: AgreementState
  messages: AgreementMessage[]
  turnCount: number
  startTime: number
  config: AgreementSessionConfig
  consensusReached: boolean
  abortReason?: string
}

export class AgreementStateMachine extends EventEmitter {
  private context: AgreementContext
  private transitions: Map<string, StateTransition[]>
  private stateTimeouts: Map<AgreementState, NodeJS.Timeout>

  constructor(config: AgreementSessionConfig) {
    super()

    this.context = {
      sessionId: config.sessionId,
      currentState: AgreementState.PROPOSE,
      messages: [],
      turnCount: 0,
      startTime: Date.now(),
      config,
      consensusReached: false,
    }

    this.transitions = new Map()
    this.stateTimeouts = new Map()
    this.initializeTransitions()
  }

  private initializeTransitions() {
    // PROPOSE -> CRITIQUE
    this.addTransition({
      from: AgreementState.PROPOSE,
      to: AgreementState.CRITIQUE,
      condition: ctx => {
        const proposals = ctx.messages.filter(
          m => m.step === AgreementState.PROPOSE,
        )
        return proposals.length > 0
      },
    })

    // CRITIQUE -> CONVERGE
    this.addTransition({
      from: AgreementState.CRITIQUE,
      to: AgreementState.CONVERGE,
      condition: ctx => {
        const critiques = ctx.messages.filter(
          m => m.step === AgreementState.CRITIQUE,
        )
        const minCritiques = Math.floor(ctx.config.agents.length * 0.5)
        return critiques.length >= minCritiques
      },
    })

    // CONVERGE -> COMMIT (consensus reached)
    this.addTransition({
      from: AgreementState.CONVERGE,
      to: AgreementState.COMMIT,
      condition: ctx => ctx.consensusReached,
    })

    // CONVERGE -> PROPOSE (refine needed)
    this.addTransition({
      from: AgreementState.CONVERGE,
      to: AgreementState.PROPOSE,
      condition: ctx =>
        !ctx.consensusReached && ctx.turnCount < ctx.config.maxTurns,
    })

    // Any state -> ABORT (timeout or max turns)
    for (const state of Object.values(AgreementState)) {
      if (state !== AgreementState.ABORT && state !== AgreementState.COMMIT) {
        this.addTransition({
          from: state as AgreementState,
          to: AgreementState.ABORT,
          condition: ctx => {
            const elapsed = Date.now() - ctx.startTime
            return (
              elapsed > ctx.config.maxDurationMs ||
              ctx.turnCount >= ctx.config.maxTurns
            )
          },
          action: async ctx => {
            ctx.abortReason =
              ctx.turnCount >= ctx.config.maxTurns
                ? 'Max turns reached'
                : 'Timeout exceeded'
          },
        })
      }
    }
  }

  private addTransition(transition: StateTransition) {
    const key = transition.from
    if (!this.transitions.has(key)) {
      this.transitions.set(key, [])
    }
    this.transitions.get(key)!.push(transition)
  }

  async transition(targetState?: AgreementState): Promise<AgreementState> {
    const possibleTransitions =
      this.transitions.get(this.context.currentState) || []

    // Find valid transition
    let validTransition: StateTransition | undefined

    if (targetState) {
      // Try to find specific transition
      validTransition = possibleTransitions.find(
        t =>
          t.to === targetState && (!t.condition || t.condition(this.context)),
      )
    } else {
      // Find any valid transition
      validTransition = possibleTransitions.find(
        t => !t.condition || t.condition(this.context),
      )
    }

    if (!validTransition) {
      throw new Error(
        `No valid transition from ${this.context.currentState} to ${targetState || 'any state'}`,
      )
    }

    // Clear previous state timeout
    this.clearStateTimeout(this.context.currentState)

    // Execute transition action if defined
    if (validTransition.action) {
      await validTransition.action(this.context)
    }

    // Update state
    const previousState = this.context.currentState
    this.context.currentState = validTransition.to

    // Emit transition event
    this.emit('transition', {
      from: previousState,
      to: this.context.currentState,
      context: this.context,
    })

    // Set timeout for new state
    this.setStateTimeout(this.context.currentState)

    // Increment turn count on cycle completion
    if (
      this.context.currentState === AgreementState.PROPOSE &&
      previousState !== AgreementState.PROPOSE
    ) {
      this.context.turnCount++
    }

    return this.context.currentState
  }

  private setStateTimeout(state: AgreementState) {
    if (state === AgreementState.COMMIT || state === AgreementState.ABORT) {
      return // Terminal states don't timeout
    }

    const stateTimeout = Math.min(
      this.context.config.maxDurationMs / 4,
      30000, // Max 30s per state
    )

    const timeout = setTimeout(async () => {
      try {
        await this.transition(AgreementState.ABORT)
      } catch (error) {
        this.emit('error', error)
      }
    }, stateTimeout)

    this.stateTimeouts.set(state, timeout)
  }

  private clearStateTimeout(state: AgreementState) {
    const timeout = this.stateTimeouts.get(state)
    if (timeout) {
      clearTimeout(timeout)
      this.stateTimeouts.delete(state)
    }
  }

  addMessage(message: AgreementMessage) {
    // Validate message is appropriate for current state
    if (message.step !== this.context.currentState) {
      throw new Error(
        `Message step ${message.step} doesn't match current state ${this.context.currentState}`,
      )
    }

    this.context.messages.push(message)
    this.emit('message', message)
  }

  getCurrentState(): AgreementState {
    return this.context.currentState
  }

  getContext(): Readonly<AgreementContext> {
    return { ...this.context }
  }

  isTerminal(): boolean {
    return (
      this.context.currentState === AgreementState.COMMIT ||
      this.context.currentState === AgreementState.ABORT
    )
  }

  setConsensusReached(reached: boolean) {
    this.context.consensusReached = reached
  }

  cleanup() {
    // Clear all timeouts
    for (const [_, timeout] of this.stateTimeouts) {
      clearTimeout(timeout)
    }
    this.stateTimeouts.clear()
    this.removeAllListeners()
  }
}
