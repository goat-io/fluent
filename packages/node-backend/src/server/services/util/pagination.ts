import type { z, ZodTypeAny } from 'zod'

interface PaginationParams<T> {
  cursor?: number | null
  perPage?: number
  total: number
  items: T[]
}

interface PaginationResult<T> {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  nextPage: number | null
  previousPage: number | null
  data: T[]
}

/**
 * Class to handle pagination calculations and operations.
 */
class PaginationUtility {
  /**
   * Calculates the page number and the number of items to skip based on the cursor and items per page.
   * @param cursor The current page number, defaults to 1 if not provided.
   * @param perPage The number of items per page, defaults to 10 if not provided.
   * @returns An object with the calculated page number and skip count.
   */
  calculatePaginationCursor({
    cursor = 1,
    perPage = 10,
  }: {
    cursor?: number | null
    perPage?: number | null
  }): { page: number; skip: number } {
    const page = Math.max(1, cursor ?? 1)
    const itemsPerPage = Math.max(1, perPage ?? 10)
    const skip = (page - 1) * itemsPerPage

    return { page, skip }
  }

  /**
   * Paginates an array of items.
   * @param cursor The page number to retrieve.
   * @param perPage The number of items per page.
   * @param total The total number of items.
   * @param items The array of items to paginate.
   * @returns The paginated result including metadata.
   */
  paginate<T>({
    cursor = 1,
    perPage = 10,
    total,
    items,
  }: PaginationParams<T>): PaginationResult<T> {
    const page = Math.max(1, cursor ?? 1)
    const itemsPerPage = Math.max(1, perPage || 10)
    const lastPage = Math.ceil(total / itemsPerPage)
    const nextPage = page + 1 <= lastPage ? page + 1 : null
    const previousPage = page - 1 >= 1 ? page - 1 : null

    return {
      total,
      perPage: itemsPerPage,
      currentPage: page,
      lastPage,
      nextPage,
      previousPage,
      data: items,
    }
  }

  getNextCursor<T extends ZodTypeAny>({
    limit,
    items,
    schema,
  }: {
    limit: number
    items: any[]
    schema: T
  }): z.infer<T> | undefined {
    let nextCursor: z.infer<T> | undefined

    if (items.length > limit) {
      const nextItem = items.pop()

      if (nextItem) {
        // Validate and pick properties based on the provided Zod schema
        nextCursor = schema.safeParse(nextItem).data
      }
    }

    return nextCursor
  }
}

export const paginationUtility = new PaginationUtility()
