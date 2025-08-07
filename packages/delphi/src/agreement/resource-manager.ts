/**
 * Resource Manager for Agreement System
 * Manages LLM adapter instances and agent lifecycle
 */

import pino from 'pino'
import type { Logger } from 'pino'
import { LLMAdapter } from '../llm/adapter.js'
import { Agent } from './orchestrator.js'

/**
 * Singleton resource manager for LLM adapters
 */
export class ResourceManager {
  private static instance: ResourceManager
  private adapters: Map<string, LLMAdapter> = new Map()
  private agents: Map<string, Agent> = new Map()
  private logger: Logger

  private constructor() {
    this.logger = (pino as any)({
      name: 'delphi-agreement',
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: label => ({ level: label })
      }
    })
  }

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager()
    }
    return ResourceManager.instance
  }

  /**
   * Get or create LLM adapter for model
   */
  getLLMAdapter(model?: string): LLMAdapter {
    const key = model || 'default'

    if (!this.adapters.has(key)) {
      this.logger.info({ model }, 'Creating LLM adapter')

      const config = model ? { model } : undefined
      const adapter = new LLMAdapter(config)
      this.adapters.set(key, adapter)
    }

    return this.adapters.get(key)!
  }

  /**
   * Register reusable agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent)
    this.logger.debug({ agentId: agent.id }, 'Agent registered')
  }

  /**
   * Get registered agent
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id)
  }

  /**
   * Get or create agent
   */
  getOrCreateAgent(id: string, factory: () => Agent): Agent {
    if (!this.agents.has(id)) {
      const agent = factory()
      this.registerAgent(agent)
    }
    return this.agents.get(id)!
  }

  /**
   * Clean up specific agent
   */
  async closeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id)
    if (agent && 'close' in agent && typeof agent.close === 'function') {
      await agent.close()
    }
    this.agents.delete(id)
    this.logger.debug({ agentId: id }, 'Agent closed')
  }

  /**
   * Clean up all resources
   */
  async closeAll(): Promise<void> {
    this.logger.info('Closing all resources')

    // Close all agents
    for (const [_id, agent] of this.agents) {
      if ('close' in agent && typeof agent.close === 'function') {
        await agent.close()
      }
    }
    this.agents.clear()

    // Close all adapters
    for (const [_key, adapter] of this.adapters) {
      if ('close' in adapter && typeof adapter.close === 'function') {
        await adapter.close()
      }
    }
    this.adapters.clear()
  }

  /**
   * Get resource statistics
   */
  getStats(): {
    adapters: number
    agents: number
    memory: NodeJS.MemoryUsage
  } {
    return {
      adapters: this.adapters.size,
      agents: this.agents.size,
      memory: process.memoryUsage()
    }
  }

  /**
   * Get logger instance
   */
  getLogger(): Logger {
    return this.logger
  }
}

// Export singleton instance
export const resourceManager = ResourceManager.getInstance()
