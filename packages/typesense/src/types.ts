import type { TypesenseHttpClient } from './components/http-client'
import type { ResiliencePolicy } from './components/resilience-policy'
import type { CollectionSchemaManager } from './components/schema-manager'

export interface TypesenseContext<TDoc = unknown> {
  httpClient: TypesenseHttpClient
  resilience: ResiliencePolicy
  schemaManager: CollectionSchemaManager
  tenantId?: string
  collectionName: string
  typesenseVersion?: string
  autoCreateCollection?: boolean
  suppressLogs?: boolean
  fqcn: (baseCollectionName?: string) => string
  docType?: TDoc // Placeholder for type information
}

// Type helper to extract remaining properties after context binding
export type Rest<Ctx, A> = Omit<A, keyof Ctx>

// Type for curried functions
export type Callable<F extends (a: any) => any, Ctx> = Rest<
  Ctx,
  Parameters<F>[0]
> extends Record<string, never>
  ? () => ReturnType<F>
  : (arg: Rest<Ctx, Parameters<F>[0]>) => ReturnType<F>
