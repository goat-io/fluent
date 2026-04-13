// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

import type { Container } from './Container'
import { DistributedCacheInvalidator } from './DistributedCacheInvalidator'

/**
 * Symbol that services can use to opt out of context proxy wrapping.
 * Set this property to `true` on any service object to prevent the
 * Container from wrapping it in a Proxy.
 *
 * This replaces brittle duck-typing checks for specific libraries
 * (Prisma, Redis, Keyv, etc.) with a universal opt-out mechanism.
 *
 * @example
 * ```typescript
 * import { NO_CONTAINER_PROXY } from './types'
 *
 * class PrismaService {
 *   [NO_CONTAINER_PROXY] = true
 *   // ... prisma methods
 * }
 * ```
 */
export const NO_CONTAINER_PROXY: unique symbol = Symbol.for(
  'goatlab.container.noProxy',
)

/**
 * Interface for disposable objects
 * Services implementing this interface will have their dispose method
 * called when they are evicted from cache or when caches are cleared
 */
export interface Disposable {
  dispose(): void | Promise<void>
}

export interface MapInterface<T> {
  clear(): void
  delete(key: string): boolean
  get(key: string): T | undefined
  set(key: string, value: T, ttl?: number): 1 | 0
  size?: number | (() => number)
  values?(): IterableIterator<T>
  entries?(): IterableIterator<[string, T]>
}

/**
 * A Factory can be either a class constructor or a factory function
 * that creates service instances. Supports parameters for dependency injection.
 *
 * @template T - The type of service instance this factory creates
 * @template P - Tuple type representing the constructor/function parameters
 *
 * Examples:
 * - Class constructor: `class UserService { constructor(db: Database) {} }`
 * - Factory function: `(db: Database) => new UserService(db)`
 */
export type Factory<T, P extends readonly unknown[] = []> =
  | ((...params: P) => T)
  | (new (
      ...params: P
    ) => T)

// ═══════════════════════════════════════════════════════════════════════════════
// 🏗️ STRUCTURE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PreloadStructure represents the "blueprint" phase of the container.
 * Each factory becomes a function that takes (id, ...params) and returns an instance.
 * This allows for parametric service creation during the initialization phase.
 *
 * Example transformation:
 * ```
 * factories: { userService: UserService }
 * preload: { userService: (id: string, db: Database) => UserService }
 * ```
 */
export type PreloadStructure<D> = {
  [K in keyof D]: D[K] extends Factory<infer T, infer P>
    ? (id: string, ...params: P) => T
    : D[K] extends Record<string, unknown>
      ? PreloadStructure<D[K]>
      : never
}

/**
 * InstancesStructure represents the final resolved services available at runtime.
 * All factories have been instantiated and are ready for use.
 *
 * Example transformation:
 * ```
 * factories: { userService: UserService }
 * instances: { userService: UserService instance }
 * ```
 */
export type InstancesStructure<D> = {
  [K in keyof D]: D[K] extends Factory<infer T, any>
    ? T
    : D[K] extends Record<string, unknown>
      ? InstancesStructure<D[K]>
      : never
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 CONTAINER INTROSPECTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the factory definitions from a Container type
 * Useful for TypeScript type manipulation and testing
 */
export type ContainerFactories<C> = C extends Container<infer Defs, any>
  ? Defs
  : never

/**
 * Extract the tenant metadata type from a Container
 * Helps maintain type safety when working with tenant-specific data
 */
export type ContainerMetadata<C> = C extends Container<any, infer Meta>
  ? Meta
  : never

/**
 * Extract the runtime context type (available services) from a Container
 * This is what you get when calling `container.context`
 */
export type ContainerContext<C> = C extends Container<any, any, infer TCtx>
  ? TCtx
  : never

/**
 * Extract the preload structure type from a Container
 * Useful for initializer function type checking
 */
export type ContainerPreload<C> = C extends Container<infer Defs, any>
  ? PreloadStructure<Defs>
  : never

/**
 * Extract the bootstrap result type from a Container
 * Contains both instances and any result from the bootstrap function
 */
export type ContainerBootstrapResult<C> = C extends Container<
  any,
  any,
  infer TCtx
>
  ? { instances: TCtx; result?: any }
  : never

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 SERVICE TYPE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the type of a specific service by its path (e.g., "database.userRepo")
 * Provides compile-time type safety when accessing nested services
 */
export type ServiceType<C, ServicePath extends string> = C extends Container<
  infer Defs,
  any
>
  ? GetServiceType<InstancesStructure<Defs>, ServicePath>
  : never

/**
 * Recursive type helper to resolve service types by dot-notation path
 * Supports deep nesting like "api.services.user.repository"
 */
type GetServiceType<
  T,
  Path extends string,
> = Path extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? GetServiceType<T[K], Rest>
    : never
  : Path extends keyof T
    ? T[Path]
    : never

/**
 * Get all possible service paths as string literal union types
 * Enables IDE autocomplete for service paths
 */
export type ServicePaths<C> = C extends Container<infer Defs, any>
  ? GetAllPaths<InstancesStructure<Defs>>
  : never

/**
 * Recursively build all possible dot-notation paths through the service tree
 * Creates union types like "user" | "user.repository" | "api.services.auth"
 */
type GetAllPaths<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? T[K] extends (...args: any[]) => any
      ? Prefix extends ''
        ? K
        : `${Prefix}.${K & string}`
      : GetAllPaths<
          T[K],
          Prefix extends '' ? K & string : `${Prefix}.${K & string}`
        >
    : Prefix extends ''
      ? K
      : `${Prefix}.${K & string}`
}[keyof T]

/**
 * Type-level check if a service exists at the given path
 * Returns true/false at compile time
 */
export type HasService<C, ServicePath extends string> = ServiceType<
  C,
  ServicePath
> extends never
  ? false
  : true

/**
 * Extract factory parameter types for a service at the given path
 * Useful for understanding what parameters a service factory expects
 */
export type ServiceFactoryParams<
  C,
  ServicePath extends string,
> = C extends Container<infer Defs, any>
  ? GetFactoryParams<Defs, ServicePath>
  : never

/**
 * Recursive helper to extract factory parameters by path
 */
type GetFactoryParams<
  T,
  Path extends string,
> = Path extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? GetFactoryParams<T[K], Rest>
    : never
  : Path extends keyof T
    ? T[Path] extends Factory<any, infer P>
      ? P
      : never
    : never

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH OPERATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of a single tenant bootstrap operation in a batch
 */
export interface BatchBootstrapResult<
  Defs,
  TMetadata,
  T,
  TContext = InstancesStructure<Defs>,
> {
  /** The tenant metadata for this operation */
  metadata: TMetadata
  /** Status of the operation */
  status: 'success' | 'error'
  /** Instances if successful */
  instances?: TContext
  /** Result from the function if successful */
  result?: T
  /** Error if the operation failed */
  error?: Error
  /** Performance metrics for this operation */
  metrics?: {
    startTime: number
    endTime: number
    duration: number
  }
}

/**
 * Options for batch bootstrap operations
 */
export interface BatchBootstrapOptions<TMetadata = unknown> {
  /** Maximum number of concurrent bootstraps (default: 10) */
  concurrency?: number
  /** Whether to continue on individual failures (default: true) */
  continueOnError?: boolean
  /** Timeout for each bootstrap operation in milliseconds */
  timeout?: number
  /** Progress callback */
  onProgress?: (completed: number, total: number, current?: TMetadata) => void
}

/**
 * Result of a batch invalidation operation
 */
export interface BatchInvalidationResult {
  /** Total number of items to invalidate */
  total: number
  /** Number of successfully invalidated items */
  succeeded: number
  /** Number of failed invalidations */
  failed: number
  /** Errors encountered during invalidation */
  errors: Array<{
    key: string
    error: Error
  }>
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ CONTAINER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Container configuration options for performance tuning and debugging
 */
export interface ContainerOptions {
  /** Maximum number of instances to cache per service (default: 100) */
  cacheSize?: number
  /** Maximum number of tenant initializations to cache (default: cacheSize) */
  maxInitializerCacheSize?: number
  /** Enable performance metrics collection (default: false) */
  enableMetrics?: boolean
  /** Enable detailed error logging and diagnostics (default: false) */
  enableDiagnostics?: boolean
  /** Enable distributed cache invalidation (default: false) */
  enableDistributedInvalidation?: boolean
  /** Distributed cache invalidator instance */
  distributedInvalidator?: DistributedCacheInvalidator
  /** Cooldown in ms before retrying a failed tenant initializer (default: 0 = no cooldown) */
  initializerCooldownMs?: number
  /** Optional event handler for structured container events */
  onEvent?: (event: ContainerEvent) => void
  /** Maximum heap usage ratio (0-1) before rejecting new bootstraps (default: 0 = disabled) */
  maxHeapUsageRatio?: number
  /** Check heap every Nth bootstrap call (default: 10). Avoids overhead on every call. */
  heapCheckInterval?: number
}

/**
 * Structured events emitted by the Container for observability
 */
export type ContainerEvent =
  | { type: 'bootstrap:start'; tenantId?: string; timestamp: number }
  | {
      type: 'bootstrap:complete'
      tenantId?: string
      durationMs: number
      cached: boolean
      timestamp: number
    }
  | {
      type: 'bootstrap:error'
      tenantId?: string
      error: Error
      durationMs: number
      timestamp: number
    }
  | {
      type: 'tenant:blocked'
      tenantId: string
      timestamp: number
    }
  | {
      type: 'tenant:invalidated'
      tenantId: string
      reason?: string
      timestamp: number
    }
  | {
      type: 'service:invalidated'
      serviceType: string
      reason?: string
      timestamp: number
    }
  | {
      type: 'disposal:error'
      error: Error
      timestamp: number
    }
  | {
      type: 'cooldown:active'
      tenantId?: string
      remainingMs: number
      timestamp: number
    }

/**
 * Result of a disposal operation
 */
export interface DisposalResult {
  /** Number of instances successfully disposed */
  disposed: number
  /** Number of disposal failures */
  failed: number
  /** Errors encountered during disposal */
  errors: Array<{
    instanceId?: string
    error: Error
  }>
  /** Total number of successful disposals */
  succeeded: number
}
