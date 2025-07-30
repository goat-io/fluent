import { AsyncPredicate } from './transform/transformMap'

/**
 * Optimized async filter that minimizes memory allocations
 */
export async function pFilter<T>(
  iterable: Iterable<T>,
  filterFn: AsyncPredicate<T>,
): Promise<T[]> {
  // Handle arrays more efficiently
  if (Array.isArray(iterable)) {
    const len = iterable.length
    
    // Fast path for empty arrays
    if (len === 0) return []
    
    // Fast path for single item
    if (len === 1) {
      const item = iterable[0]
      return (await filterFn(item, 0)) ? [item] : []
    }
    
    // For small arrays, process sequentially to avoid Promise.all overhead
    if (len <= 3) {
      const result: T[] = []
      for (let i = 0; i < len; i++) {
        if (await filterFn(iterable[i], i)) {
          result.push(iterable[i])
        }
      }
      return result
    }
    
    // For larger arrays, use Promise.all but pre-allocate result array
    const predicates = await Promise.all(
      iterable.map((item, i) => filterFn(item, i))
    )
    
    // Count true values first to pre-allocate result array with exact size
    let count = 0
    for (let i = 0; i < len; i++) {
      if (predicates[i]) count++
    }
    
    if (count === 0) return []
    if (count === len) return [...iterable] // All passed, return copy
    
    // Pre-allocate result array with exact size
    const result = new Array<T>(count)
    let resultIndex = 0
    for (let i = 0; i < len; i++) {
      if (predicates[i]) {
        result[resultIndex++] = iterable[i]
      }
    }
    return result
  }
  
  // Fallback for non-array iterables
  const items = [...iterable]
  const predicates = await Promise.all(
    items.map((item, i) => filterFn(item, i))
  )
  return items.filter((_, i) => predicates[i])
}
