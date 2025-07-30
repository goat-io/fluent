// npx vitest run ./src/tests/static-api.test.ts

import { describe, expect, it } from 'vitest'
import { TypesenseApi } from '../index'

describe('TypesenseApi Static Methods', () => {
  it('should have static defineCollection method', () => {
    expect(TypesenseApi.defineCollection).toBeDefined()
    expect(typeof TypesenseApi.defineCollection).toBe('function')
  })

  it('should have static createSchemaTypedApi method', () => {
    expect(TypesenseApi.createSchemaTypedApi).toBeDefined()
    expect(typeof TypesenseApi.createSchemaTypedApi).toBe('function')
  })

  it('should have static createFromSchema method', () => {
    expect(TypesenseApi.createFromSchema).toBeDefined()
    expect(typeof TypesenseApi.createFromSchema).toBe('function')
  })

  it('should define collection using static method', () => {
    const collection = TypesenseApi.defineCollection({
      name: 'test',
      fields: [
        { name: 'id', type: 'string' as const },
        { name: 'title', type: 'string' as const }
      ] as const
    } as const)

    expect(collection).toEqual({
      name: 'test',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'title', type: 'string' }
      ]
    })
  })

  it('should create typed API using static methods', () => {
    const collection = TypesenseApi.defineCollection({
      name: 'products',
      fields: [
        { name: 'id', type: 'string' as const },
        { name: 'title', type: 'string' as const },
        { name: 'price', type: 'float' as const }
      ] as const
    } as const)

    const api = TypesenseApi.createSchemaTypedApi(collection)({
      prefixUrl: 'http://localhost:8108',
      token: 'xyz'
    })

    expect(api).toBeInstanceOf(TypesenseApi)
    expect(api.documents).toBeDefined()
    expect(api.collections).toBeDefined()
  })

  it('should create API using createFromSchema convenience method', () => {
    const api = TypesenseApi.createFromSchema({
      name: 'users',
      fields: [
        { name: 'id', type: 'string' as const },
        { name: 'name', type: 'string' as const },
        { name: 'email', type: 'string' as const }
      ] as const
    } as const)({
      prefixUrl: 'http://localhost:8108',
      token: 'xyz'
    })

    expect(api).toBeInstanceOf(TypesenseApi)
    expect(api.documents).toBeDefined()
  })
})
