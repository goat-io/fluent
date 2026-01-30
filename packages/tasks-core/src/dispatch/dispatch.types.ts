/**
 * Dispatch mode: shared (dispatch-based) vs isolated (direct consume).
 * - shared: Multi-tenant dispatcher enabled. Jobs processed via dispatch queue.
 * - isolated: Dispatcher disabled. Adapter consumes jobs directly (existing behavior).
 */
export type DispatchMode = 'shared' | 'isolated'

/**
 * Tenant priority tier for dispatch scheduling.
 * Higher numeric value = higher priority in the dispatch queue.
 */
export interface TenantPriority {
  /** Tenant tier determines base priority */
  tier: 'free' | 'starter' | 'professional' | 'enterprise'
  /** Task importance within the tenant (0-10, higher = more important) */
  taskImportance?: number
}

/**
 * A lightweight pointer in the dispatch queue.
 * This is a HINT, not the source of truth. The real job lives in the tenant queue.
 * Dispatch hints are idempotent (duplicate hints are harmless).
 */
export interface DispatchHint {
  /** Tenant that owns the job */
  tenantId: string
  /** Queue name within the tenant's namespace */
  queueName: string
  /** Priority (BullMQ: lower number = higher priority, 1-2097152) */
  priority: number
  /** Original job ID for deduplication (optional) */
  jobId?: string
  /** Timestamp when the hint was created */
  createdAt: number
}

/**
 * Configuration for the dispatch system.
 */
export interface DispatchConfig {
  /** shared = dispatch-based multi-tenant, isolated = direct consume */
  mode: DispatchMode
  /** Time budget for processing a batch (ms). Default: 25000 (25s) */
  timeBudgetMs?: number
  /** Max jobs to process per dispatch cycle. Default: 50 */
  batchSize?: number
  /** Max parallel dispatch instances. Default: 20 */
  maxParallelism?: number
  /** Consecutive zero-work cycles before circuit breaker opens. Default: 3 */
  circuitBreakerThreshold?: number
  /** URL for self-fan-out HTTP requests (Cloud Run internal URL) */
  dispatchUrl?: string
}

/**
 * Status returned from dispatch operations.
 */
export interface DispatchStatus {
  /** Number of jobs processed in this cycle */
  processed: number
  /** Current dispatch queue backlog size */
  backlog: number
  /** Number of dispatch instances spawned */
  spawned: number
  /** Whether circuit breaker is open */
  circuitOpen: boolean
}

/**
 * Result of a dispatch cycle (batch processing).
 */
export interface DispatchCycleResult {
  processed: number
  skipped: number
  failed: number
  durationMs: number
}

/**
 * Calculate dispatch priority from tenant tier and task importance.
 * BullMQ uses lower number = higher priority (1 is highest).
 *
 * Priority bands:
 * - enterprise: 1-100
 * - professional: 101-200
 * - starter: 201-300
 * - free: 301-400
 *
 * Within each band, taskImportance (0-10) adjusts priority.
 *
 * @param priority - Tenant priority configuration
 * @returns Priority number for BullMQ (1-400)
 */
export function calculateDispatchPriority(priority: TenantPriority): number {
  const tierBase: Record<TenantPriority['tier'], number> = {
    enterprise: 1,
    professional: 101,
    starter: 201,
    free: 301,
  }
  const base = tierBase[priority.tier]
  const importance = Math.max(0, Math.min(10, priority.taskImportance ?? 5))
  // Higher importance = lower number = higher priority within the band
  return base + (10 - importance) * 10
}
