import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { flock } from '../TypeOrmConnector/test/flock'

// Define a minimal interface for what we need from connectors
interface TestConnector {
  insert(data: any): Promise<any>
  insertMany(data: any[]): Promise<any[]>
  findById(id: string, query?: any): Promise<any>
  findByIds(ids: string[], query?: any): Promise<any[]>
  findMany(query?: any): Promise<any[]>
  findFirst(query?: any): Promise<any>
  requireFirst(query?: any): Promise<any>
  updateById(id: string, data: any): Promise<any>
  replaceById(id: string, data: any): Promise<any>
  deleteById(id: string): Promise<string>
  clear(): Promise<boolean>
  pluck(field: string): Promise<any[]>
}

export interface GenericUnifiedTestOptions {
  // Factory functions that return connector instances
  createGoatConnector: () => TestConnector
  createTypeOrmConnector: () => TestConnector
  dbType: 'mysql' | 'postgresql' | 'mongodb' | 'sqlite' | 'firebase' | 'formio' | 'loki' | 'pouchdb'
}

export const genericUnifiedTestSuite = (options: GenericUnifiedTestOptions) => {
  const { createGoatConnector, createTypeOrmConnector, dbType } = options
  
  let GoatRepo: TestConnector
  let TypeOrmRepo: TestConnector

  beforeAll(() => {
    GoatRepo = createGoatConnector()
    TypeOrmRepo = createTypeOrmConnector()
  })

  describe('Basic Tests', () => {
    beforeEach(async () => {
      // Clear data before each test to ensure clean state
      await GoatRepo.clear()
    })
    
    it('insert - Should insert data', async () => {
      const a = await GoatRepo.insert({ name: 'myGoat', age: 13 })
      expect(typeof a.id).toBe('string')
      expect(a.name).toBe('myGoat')
    })

    it('insert - Should insert data with customId', async () => {
      const customId = dbType === 'postgresql' 
        ? '550e8400-e29b-41d4-a716-446655440000'
        : '631ce4304f9183f61ffb613a'
        
      const a = await GoatRepo.insert({
        id: customId,
        name: 'myGoat',
        age: 13
      })
      expect(typeof a.id).toBe('string')
      expect(a.id).toBe(customId)
    })

    it('insertMany - Should insert Multiple elements', async () => {
      const insertedFlock = await GoatRepo.insertMany(flock)
      expect(insertedFlock[0].name).toBe('Goatee')
    })

    it('findById - Should GET an object by its ID', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const goat = await GoatRepo.findById(goats[0].id!)
      expect(goat?.id).toBe(goats[0].id)
      expect(typeof goat?.id).toBe('string')

      const anotherGoat = await GoatRepo.findById('507f1f77bcf86cd799439011')
      expect(anotherGoat).toBe(null)
    })

    it('findById - Should GET selected Data', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const goat = await GoatRepo.findById(goats[0].id, {
        select: { name: true }
      })
      expect(goat?.name).toBe(goats[0].name)
      expect((goat as any)?.age).toBeUndefined()
    })

    it('findByIds - Should GET data', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const storedGoats = await GoatRepo.findByIds([goats[0].id, goats[1].id])
      expect(storedGoats.length).toBe(2)
    })

    it('findByIds - Should GET selectedData', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const storedGoats = await GoatRepo.findByIds(
        [goats[0].id, goats[1].id],
        { select: { name: true } }
      )
      expect(storedGoats[0]?.name).toBe(goats[0].name)
      expect((storedGoats[0] as any)?.age).toBeUndefined()
    })

    it('findMany - Should GET data', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany()
      expect(goats.length).toBeGreaterThanOrEqual(flock.length)
    })

    it('findMany - Should FILTER data', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany({
        where: { breed: { family: 'Angora' } }
      })
      expect(goats.length).toBe(2)
    })

    it('findMany - Should FILTER not existing data', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany({
        where: { name: 'TESTESTEST' }
      })
      expect(goats.length).toBe(0)
    })

    it('findMany - Should SELECT attributes', async () => {
      await GoatRepo.insertMany(flock)
      const goats = await GoatRepo.findMany({
        select: { name: true }
      })
      expect(goats[0]?.name).toBeDefined()
      expect((goats[0] as any)?.age).toBeUndefined()
    })

    it('findFirst - Should get only 1 object back', async () => {
      await GoatRepo.insertMany(flock)
      const goat = await GoatRepo.findFirst()
      expect(goat).toBeDefined()
      expect(goat?.name).toBeDefined()
    })

    it('findFirst - Should FILTER AND SELECT DATA', async () => {
      await GoatRepo.insertMany(flock)
      const goat = await GoatRepo.findFirst({
        where: { breed: { family: 'Angora' } },
        select: { name: true }
      })
      expect(goat?.name).toBeDefined()
      expect((goat as any)?.age).toBeUndefined()
    })

    it('requireFirst - Should fail if not found', async () => {
      await expect(GoatRepo.requireFirst()).rejects.toThrow()
    })

    it('requireFirst - Should find first item', async () => {
      await GoatRepo.insertMany(flock)
      const goat = await GoatRepo.requireFirst()
      expect(goat).toBeDefined()
      expect(goat.name).toBeDefined()
    })

    it('UpdateById - Should Update a single element', async () => {
      const goats = await GoatRepo.insertMany(flock)
      await GoatRepo.updateById(goats[0].id, { name: 'MyNewName' })
      const goat = await GoatRepo.findById(goats[0].id)
      expect(goat?.name).toBe('MyNewName')
    })

    it('ReplaceById - Should Update a single element', async () => {
      const goats = await GoatRepo.insertMany(flock)
      await GoatRepo.replaceById(goats[0].id, { name: 'MyNewName' })
      const goat = await GoatRepo.findById(goats[0].id)
      expect(goat?.name).toBe('MyNewName')
      expect((goat as any)?.age).toBeUndefined()
    })

    it('deleteById - Should delete an item', async () => {
      const goats = await GoatRepo.insertMany(flock)
      const id = await GoatRepo.deleteById(goats[0].id)
      expect(id).toBe(goats[0].id)
      const findDeleted = await GoatRepo.findById(goats[0].id)
      expect(findDeleted).toBe(null)
    })
  })

  describe('Advanced Tests', () => {
    beforeEach(async () => {
      await TypeOrmRepo.clear()
    })

    it('Should get local data', async () => {
      await TypeOrmRepo.insert({ test: true })
      const value = await TypeOrmRepo.findFirst()
      expect(value?.test).toBe(true)
    })

    it('pluck() should return a single array', async () => {
      await TypeOrmRepo.insertMany([
        { test: true, order: 2 },
        { test: false, order: 3 },
        { test: true, order: 1 }
      ])

      const plucked = await TypeOrmRepo.pluck('order')
      expect(Array.isArray(plucked)).toBe(true)
      expect(plucked).toContain(1)
      expect(plucked).toContain(2)
      expect(plucked).toContain(3)
    })

    it('limit() should limit the amount of results', async () => {
      await TypeOrmRepo.insertMany([
        { test: true },
        { test: false },
        { test: true }
      ])

      const results = await TypeOrmRepo.findMany({ limit: 2 })
      expect(results.length).toBe(2)
    })

    it('offset() should start at the given position', async () => {
      const inserted = await TypeOrmRepo.insertMany([
        { test: true, order: 1 },
        { test: false, order: 2 },
        { test: true, order: 3 }
      ])

      const results = await TypeOrmRepo.findMany({
        offset: 1,
        orderBy: [{ order: 'asc' }]
      })

      expect(results.length).toBe(2)
      expect(results[0].order).toBe(2)
    })

    it('orWhere() should filter the data', async () => {
      await TypeOrmRepo.insertMany([
        { test: true, order: 1 },
        { test: false, order: 2 },
        { test: true, order: 3 }
      ])

      const results = await TypeOrmRepo.findMany({
        where: {
          OR: [
            { test: true },
            { order: 2 }
          ]
        }
      })

      expect(results.length).toBe(3)
    })

    it('orderBy() should order results desc', async () => {
      await TypeOrmRepo.insertMany([
        { test: true, order: 2 },
        { test: false, order: 3 },
        { test: true, order: 1 }
      ])

      const results = await TypeOrmRepo.findMany({
        orderBy: [{ order: 'desc' }]
      })

      expect(results[0].order).toBe(3)
      expect(results[1].order).toBe(2)
      expect(results[2].order).toBe(1)
    })

    it('orderBy() should order results asc', async () => {
      await TypeOrmRepo.insertMany([
        { test: true, order: 2 },
        { test: false, order: 3 },
        { test: true, order: 1 }
      ])

      const results = await TypeOrmRepo.findMany({
        orderBy: [{ order: 'asc' }]
      })

      expect(results[0].order).toBe(1)
      expect(results[1].order).toBe(2)
      expect(results[2].order).toBe(3)
    })

    it('orderBy() should order by Dates with Select()', async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      const first = await TypeOrmRepo.insert({ test: true })
      await new Promise(resolve => setTimeout(resolve, 10))
      const second = await TypeOrmRepo.insert({ test: true })
      await new Promise(resolve => setTimeout(resolve, 10))
      const third = await TypeOrmRepo.insert({ test: true })

      const results = await TypeOrmRepo.findMany({
        orderBy: [{ created: 'desc' }],
        select: { id: true, created: true }
      })

      expect(results[0]?.id).toBe(third.id)
      expect(results[1]?.id).toBe(second.id)
      expect(results[2]?.id).toBe(first.id)
    })

    it('orderBy() should order by Dates without Select()', async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      const first = await TypeOrmRepo.insert({ test: true })
      await new Promise(resolve => setTimeout(resolve, 10))
      const second = await TypeOrmRepo.insert({ test: true })
      await new Promise(resolve => setTimeout(resolve, 10))
      const third = await TypeOrmRepo.insert({ test: true })

      const results = await TypeOrmRepo.findMany({
        orderBy: [{ created: 'desc' }]
      })

      expect(results[0]?.id).toBe(third.id)
      expect(results[1]?.id).toBe(second.id)
      expect(results[2]?.id).toBe(first.id)
    })
  })
}