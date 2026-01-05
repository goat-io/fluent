// npx vitest run ./src/xlsxStream.test.ts

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { xlsxStream } from './xlsxStream'

type Header = 'COLA' | 'COLB' | 'COLC' | 'COLD'

describe('xlsxStream', () => {
  describe('xlsxStream', () => {
    it('[batchStream] Should create a stream from a xlsx file', async () => {
      const results: any[] = []
      await xlsxStream.batchStream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => {
          return {
            HELLO: row.COLB,
            WORLD: row.COLC,
          }
        },
        batchSize: 5,
        fx: async row => {
          results.push(...row)
        },
        mapOptions: {
          concurrency: 1,
        },
      })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('HELLO')
      expect(results[0]).toHaveProperty('WORLD')
    })

    it('[batchStream] Should process all rows in correct batches', async () => {
      const batchSizes: number[] = []
      await xlsxStream.batchStream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => row,
        batchSize: 10,
        fx: async rows => {
          batchSizes.push(rows.length)
        },
        mapOptions: {
          concurrency: 1,
        },
      })
      // Should have processed 44 rows in batches of 10 (last batch smaller)
      expect(batchSizes.slice(0, -1).every(size => size === 10)).toBe(true)
      expect(batchSizes[batchSizes.length - 1]).toBe(44 % 10)
    })

    it('[batchStream] Should map and filter rows correctly', async () => {
      const mapped: number[] = []

      await xlsxStream.batchStream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => {
          // Only map rows where COLA is even
          if (row.COLA && Number(row.COLA) % 2 === 0) {
            return Number(row.COLA)
          }
          return null
        },
        batchSize: 8,
        fx: async rows => {
          mapped.push(...rows)
        },
        mapOptions: {
          concurrency: 2,
        },
      })
      expect(mapped.every(n => n % 2 === 0)).toBe(true)
      expect(mapped.length).toBe(0)
    })

    it('[batchStream] hould support different concurrency levels', async () => {
      const batches: number[] = []
      await xlsxStream.batchStream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => row,
        batchSize: 7,
        fx: async rows => {
          batches.push(rows.length)
        },
        mapOptions: {
          concurrency: 4,
        },
      })
      expect(batches.length).toBeGreaterThan(0)
      expect(batches.reduce((a, b) => a + b, 0)).toBe(44)
    })

    it('[batchStream] Should handle empty files gracefully', async () => {
      // Assuming you have an empty.xlsx file with only headers
      const processed: any[] = []
      await xlsxStream.batchStream({
        file: {
          filePath: join(__dirname, './empty.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => row,
        batchSize: 5,
        fx: async rows => {
          processed.push(...rows)
        },
        mapOptions: {
          concurrency: 1,
        },
      })
      expect(processed.length).toBe(0)
    })

    it('[stream] Should process all rows individually', async () => {
      const rows: any[] = []
      await xlsxStream.stream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => row,
        batchSize: 1,
        fx: async row => {
          rows.push(row)
        },
        mapOptions: {
          concurrency: 1,
        },
      })
      // Should have processed 44 rows (assuming test.xlsx has 44 rows)
      expect(rows.length).toBe(44)
      expect(rows[0]).toHaveProperty('COLA')
      expect(rows[0]).toHaveProperty('COLB')
      expect(rows[0]).toHaveProperty('COLC')
      expect(rows[0]).toHaveProperty('COLD')
    })

    it('[stream] Should map and filter rows correctly', async () => {
      const mapped: number[] = []
      await xlsxStream.stream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => {
          // Only map rows where COLA is odd
          if (row.COLA && Number(row.COLA) % 2 === 1) {
            return Number(row.COLA)
          }
          return null
        },
        batchSize: 1,
        fx: async row => {
          mapped.push(row)
        },
        mapOptions: {
          concurrency: 2,
        },
      })
      expect(mapped.every(n => n % 2 === 1)).toBe(true)
      expect(mapped.length).toBeGreaterThan(0)
    })

    it('[stream] Should support different concurrency levels', async () => {
      const processed: any[] = []
      await xlsxStream.stream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => row,
        batchSize: 1,
        fx: async row => {
          processed.push(row)
        },
        mapOptions: {
          concurrency: 4,
        },
      })
      expect(processed.length).toBe(44)
    })

    it('[stream] Should handle empty files gracefully', async () => {
      const processed: any[] = []
      await xlsxStream.stream({
        file: {
          filePath: join(__dirname, './empty.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (row: Record<Header, string>) => row,
        batchSize: 1,
        fx: async row => {
          processed.push(row)
        },
        mapOptions: {
          concurrency: 1,
        },
      })
      expect(processed.length).toBe(0)
    })

    it('[stream] Should skip rows when rowMapper returns null', async () => {
      const processed: any[] = []
      await xlsxStream.stream({
        file: {
          filePath: join(__dirname, './test.xlsx'),
          sheet: 0,
          withHeader: true,
        },
        rowMapper: (_row: Record<Header, string>) => {
          // Skip all rows
          return null
        },
        batchSize: 1,
        fx: async row => {
          processed.push(row)
        },
        mapOptions: {
          concurrency: 1,
        },
      })
      expect(processed.length).toBe(0)
    })
  })
})
