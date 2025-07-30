// npx vitest run ./src/server/services/util/pagination.test.ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { paginationUtility } from './pagination'

describe('PaginationUtility', () => {
  describe('calculatePaginationCursor', () => {
    it('should return default values when no parameters provided', () => {
      const result = paginationUtility.calculatePaginationCursor({})
      expect(result).toEqual({ page: 1, skip: 0 })
    })

    it('should handle standard pagination parameters', () => {
      const result = paginationUtility.calculatePaginationCursor({
        cursor: 3,
        perPage: 20
      })
      expect(result).toEqual({ page: 3, skip: 40 })
    })

    it('should handle null cursor gracefully', () => {
      const result = paginationUtility.calculatePaginationCursor({
        cursor: null,
        perPage: 15
      })
      expect(result).toEqual({ page: 1, skip: 0 })
    })

    it('should handle null perPage gracefully', () => {
      const result = paginationUtility.calculatePaginationCursor({
        cursor: 2,
        perPage: null
      })
      expect(result).toEqual({ page: 2, skip: 10 })
    })

    it('should enforce minimum values', () => {
      const result = paginationUtility.calculatePaginationCursor({
        cursor: -5,
        perPage: -10
      })
      expect(result).toEqual({ page: 1, skip: 0 })
    })

    it('should handle zero values', () => {
      const result = paginationUtility.calculatePaginationCursor({
        cursor: 0,
        perPage: 0
      })
      expect(result).toEqual({ page: 1, skip: 0 })
    })

    it('should calculate correct skip for large page numbers', () => {
      const result = paginationUtility.calculatePaginationCursor({
        cursor: 100,
        perPage: 50
      })
      expect(result).toEqual({ page: 100, skip: 4950 })
    })
  })

  describe('paginate', () => {
    const mockData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
      { id: 4, name: 'Item 4' },
      { id: 5, name: 'Item 5' }
    ]

    it('should paginate with default parameters', () => {
      const result = paginationUtility.paginate({
        total: 100,
        items: mockData
      })

      expect(result).toEqual({
        total: 100,
        perPage: 10,
        currentPage: 1,
        lastPage: 10,
        nextPage: 2,
        previousPage: null,
        data: mockData
      })
    })

    it('should handle first page correctly', () => {
      const result = paginationUtility.paginate({
        cursor: 1,
        perPage: 3,
        total: 15,
        items: mockData.slice(0, 3)
      })

      expect(result).toEqual({
        total: 15,
        perPage: 3,
        currentPage: 1,
        lastPage: 5,
        nextPage: 2,
        previousPage: null,
        data: mockData.slice(0, 3)
      })
    })

    it('should handle middle page correctly', () => {
      const result = paginationUtility.paginate({
        cursor: 3,
        perPage: 2,
        total: 10,
        items: mockData.slice(4, 6)
      })

      expect(result).toEqual({
        total: 10,
        perPage: 2,
        currentPage: 3,
        lastPage: 5,
        nextPage: 4,
        previousPage: 2,
        data: mockData.slice(4, 6)
      })
    })

    it('should handle last page correctly', () => {
      const result = paginationUtility.paginate({
        cursor: 5,
        perPage: 2,
        total: 9,
        items: [mockData[8]]
      })

      expect(result).toEqual({
        total: 9,
        perPage: 2,
        currentPage: 5,
        lastPage: 5,
        nextPage: null,
        previousPage: 4,
        data: [mockData[8]]
      })
    })

    it('should handle single page scenario', () => {
      const result = paginationUtility.paginate({
        cursor: 1,
        perPage: 10,
        total: 5,
        items: mockData
      })

      expect(result).toEqual({
        total: 5,
        perPage: 10,
        currentPage: 1,
        lastPage: 1,
        nextPage: null,
        previousPage: null,
        data: mockData
      })
    })

    it('should handle empty data', () => {
      const result = paginationUtility.paginate({
        cursor: 1,
        perPage: 10,
        total: 0,
        items: []
      })

      expect(result).toEqual({
        total: 0,
        perPage: 10,
        currentPage: 1,
        lastPage: 0,
        nextPage: null,
        previousPage: null,
        data: []
      })
    })

    it('should handle null cursor', () => {
      const result = paginationUtility.paginate({
        cursor: null,
        perPage: 5,
        total: 20,
        items: mockData
      })

      expect(result).toEqual({
        total: 20,
        perPage: 5,
        currentPage: 1,
        lastPage: 4,
        nextPage: 2,
        previousPage: null,
        data: mockData
      })
    })

    it('should enforce minimum values', () => {
      const result = paginationUtility.paginate({
        cursor: -1,
        perPage: -5,
        total: 20,
        items: mockData
      })

      expect(result).toEqual({
        total: 20,
        perPage: 1,
        currentPage: 1,
        lastPage: 20,
        nextPage: 2,
        previousPage: null,
        data: mockData
      })
    })
  })

  describe('getNextCursor', () => {
    const schema = z.object({
      id: z.number(),
      createdAt: z.string()
    })

    it('should return undefined when items length equals limit', () => {
      const items = [
        { id: 1, createdAt: '2023-01-01', name: 'Item 1' },
        { id: 2, createdAt: '2023-01-02', name: 'Item 2' }
      ]

      const result = paginationUtility.getNextCursor({
        limit: 2,
        items,
        schema
      })

      expect(result).toBeUndefined()
      expect(items).toHaveLength(2) // Items should not be modified
    })

    it('should return cursor and remove last item when items exceed limit', () => {
      const items = [
        { id: 1, createdAt: '2023-01-01', name: 'Item 1' },
        { id: 2, createdAt: '2023-01-02', name: 'Item 2' },
        { id: 3, createdAt: '2023-01-03', name: 'Item 3' }
      ]

      const result = paginationUtility.getNextCursor({
        limit: 2,
        items,
        schema
      })

      expect(result).toEqual({ id: 3, createdAt: '2023-01-03' })
      expect(items).toHaveLength(2) // Last item should be removed
      expect(items[items.length - 1]).toEqual({
        id: 2,
        createdAt: '2023-01-02',
        name: 'Item 2'
      })
    })

    it('should handle invalid schema data gracefully', () => {
      const items = [
        { id: 1, createdAt: '2023-01-01', name: 'Item 1' },
        { id: 2, createdAt: '2023-01-02', name: 'Item 2' },
        { invalidId: 'not-a-number', invalidDate: 123, name: 'Item 3' }
      ]

      const result = paginationUtility.getNextCursor({
        limit: 2,
        items,
        schema
      })

      expect(result).toBeUndefined() // Should return undefined when validation fails
      expect(items).toHaveLength(2) // Item should still be removed
    })

    it('should handle empty items array', () => {
      const items: any[] = []

      const result = paginationUtility.getNextCursor({
        limit: 2,
        items,
        schema
      })

      expect(result).toBeUndefined()
      expect(items).toHaveLength(0)
    })

    it('should work with different schema types', () => {
      const stringSchema = z.object({
        name: z.string(),
        category: z.string()
      })

      const items = [
        { name: 'Item 1', category: 'A', id: 1 },
        { name: 'Item 2', category: 'B', id: 2 },
        { name: 'Item 3', category: 'C', id: 3 }
      ]

      const result = paginationUtility.getNextCursor({
        limit: 2,
        items,
        schema: stringSchema
      })

      expect(result).toEqual({ name: 'Item 3', category: 'C' })
      expect(items).toHaveLength(2)
    })

    it('should handle items with extra properties', () => {
      const items = [
        {
          id: 1,
          createdAt: '2023-01-01',
          name: 'Item 1',
          extraProp: 'extra',
          anotherProp: 123
        },
        {
          id: 2,
          createdAt: '2023-01-02',
          name: 'Item 2',
          extraProp: 'extra2',
          anotherProp: 456
        },
        {
          id: 3,
          createdAt: '2023-01-03',
          name: 'Item 3',
          extraProp: 'extra3',
          anotherProp: 789
        }
      ]

      const result = paginationUtility.getNextCursor({
        limit: 2,
        items,
        schema
      })

      // Should only include properties defined in schema
      expect(result).toEqual({ id: 3, createdAt: '2023-01-03' })
      expect(items).toHaveLength(2)
    })
  })
})
