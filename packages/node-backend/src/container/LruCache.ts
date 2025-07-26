import type { MapInterface } from './types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tinyLRU = require('tiny-lru')

// Default cache size - can be overridden per container
const DEFAULT_CACHE_SIZE = 100

/**
 * Creates an LRU cache for service instances
 *
 * @param max Maximum number of entries before LRU eviction (default: 100)
 * @returns LRU cache instance optimized for service caching
 *
 * Note: tiny-lru is optimal for this use case because:
 * - Lightweight (~2KB)
 * - Fast O(1) operations
 * - Simple LRU eviction
 * - No unnecessary features (TTL, async, etc.)
 */
export function createServiceCache<T>(max?: number): MapInterface<T> {
  return new tinyLRU.LRU(max || DEFAULT_CACHE_SIZE) as MapInterface<T>
}
