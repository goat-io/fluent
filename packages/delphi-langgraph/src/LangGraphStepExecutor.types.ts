// npx vitest run src/__tests__/langgraph-executor.spec.ts

export interface LangGraphExecutorConfig {
  /** Postgres connection string for LangGraph checkpointing */
  postgresConnectionString?: string
  /** Registry of named graphs: graphName -> factory function */
  graphs: Map<string, GraphFactory>
}

/**
 * A factory that creates a compiled LangGraph StateGraph.
 * Receives executor config from the step definition.
 */
export type GraphFactory = (config: Record<string, unknown>) => any

/**
 * Expected executorConfig shape for LangGraph steps:
 * {
 *   graphName: string    // Which registered graph to run
 *   model?: string       // Optional model override
 *   ...                  // Any additional config passed to the graph factory
 * }
 */
export interface LangGraphStepConfig {
  graphName: string
  [key: string]: unknown
}
