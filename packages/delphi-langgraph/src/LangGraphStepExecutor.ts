// npx vitest run src/__tests__/langgraph-executor.spec.ts
import type {
  StepExecutor,
  StepPayload,
  StepResult,
} from '@goatlab/delphi-core'

import type {
  GraphFactory,
  LangGraphExecutorConfig,
  LangGraphStepConfig,
} from './LangGraphStepExecutor.types.js'

export class LangGraphStepExecutor implements StepExecutor {
  readonly type = 'langgraph'
  private config: LangGraphExecutorConfig
  private checkpointer: any | null = null

  constructor(config: LangGraphExecutorConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    if (this.config.postgresConnectionString) {
      try {
        const { PostgresSaver } = await import(
          '@langchain/langgraph-checkpoint-postgres'
        )
        this.checkpointer = PostgresSaver.fromConnString(
          this.config.postgresConnectionString,
        )
        await this.checkpointer.setup()
      } catch (error: any) {
        console.warn(
          `LangGraphStepExecutor: Failed to initialize Postgres checkpointer: ${error.message}. Running without checkpointing.`,
        )
      }
    }
  }

  async execute(payload: StepPayload): Promise<StepResult> {
    const stepConfig = payload.executorConfig as LangGraphStepConfig
    const { graphName, ...graphConfig } = stepConfig

    if (!graphName) {
      throw new Error(
        `LangGraphStepExecutor: executorConfig.graphName is required for step "${payload.stepName}"`,
      )
    }

    const factory = this.config.graphs.get(graphName)
    if (!factory) {
      throw new Error(
        `LangGraphStepExecutor: no graph registered for "${graphName}". Available: ${Array.from(this.config.graphs.keys()).join(', ')}`,
      )
    }

    // Create graph from factory
    const graph = factory(graphConfig)

    // Thread ID = workflowRunId:stepName for deterministic resume
    const threadId = `${payload.workflowRunId}:${payload.stepName}`

    // Compile with optional checkpointer
    const compileOptions: Record<string, unknown> = {}
    if (this.checkpointer) {
      compileOptions.checkpointer = this.checkpointer
    }

    const compiled =
      typeof graph.compile === 'function'
        ? graph.compile(compileOptions)
        : graph // Already compiled

    // Invoke the graph
    const result = await compiled.invoke(payload.input, {
      configurable: { thread_id: threadId },
    })

    // Check for human interrupt (pending nodes in checkpoint)
    if (this.checkpointer) {
      try {
        const snapshot = await compiled.getState({
          configurable: { thread_id: threadId },
        })
        if (snapshot?.next?.length > 0) {
          return {
            output: result as any,
            waitForHuman: {
              prompt: (result as any)?.__humanPrompt ?? 'Human input required',
              schema: (result as any)?.__humanSchema,
            },
          }
        }
      } catch {
        // getState may not be available for all graph types
      }
    }

    return { output: result as any }
  }

  /** Register a new graph at runtime */
  registerGraph(name: string, factory: GraphFactory): void {
    this.config.graphs.set(name, factory)
  }

  /** Unregister a graph */
  unregisterGraph(name: string): boolean {
    return this.config.graphs.delete(name)
  }

  /** List registered graph names */
  listGraphs(): string[] {
    return Array.from(this.config.graphs.keys())
  }

  /** Shutdown and cleanup resources */
  async shutdown(): Promise<void> {
    if (this.checkpointer?.end) {
      await this.checkpointer.end()
    }
  }
}
