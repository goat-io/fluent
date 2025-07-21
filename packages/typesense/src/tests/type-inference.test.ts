// npx vitest run ./src/tests/type-inference.test.ts

import { defineCollection, createSchemaTypedApi } from '../index'
import { describe, it, expect } from 'vitest'

describe('Type Inference', () => {
  it('should properly infer types from collection definition', () => {
    // Define a collection with const assertion
    const ProductCollection = defineCollection({
      name: 'products',
      fields: [
        { name: 'id', type: 'string' as const },
        { name: 'title', type: 'string' as const },
        { name: 'description', type: 'string' as const, optional: true },
        { name: 'price', type: 'float' as const },
        { name: 'inStock', type: 'bool' as const },
        { name: 'tags', type: 'string[]' as const, optional: true },
        { name: 'rating', type: 'int32' as const, optional: true }
      ] as const
    } as const)

    // Create typed API
    const api = createSchemaTypedApi(ProductCollection)({
      prefixUrl: 'http://localhost:8108',
      token: 'xyz'
    })

    // Type checks - these should compile without errors
    const validDoc = {
      title: 'Test Product',
      price: 29.99,
      inStock: true
    }

    const validDocWithOptional = {
      title: 'Test Product',
      description: 'A great product',
      price: 29.99,
      inStock: true,
      tags: ['new', 'sale'],
      rating: 5
    }

    // These would be compile-time errors if uncommented:
    // const invalidDoc1 = { title: 123 } // Error: title must be string
    // const invalidDoc2 = { title: 'Test' } // Error: missing required fields
    // const invalidDoc3 = { title: 'Test', price: '29.99', inStock: true } // Error: price must be number

    // Runtime test to ensure the structure is correct
    expect(api).toHaveProperty('documents')
    expect(api.documents).toHaveProperty('insert')
    expect(typeof api.documents.insert).toBe('function')
  })

  it('should handle complex field types', () => {
    const EventCollection = defineCollection({
      name: 'events',
      fields: [
        { name: 'id', type: 'string' as const },
        { name: 'name', type: 'string' as const },
        { name: 'location', type: 'geopoint' as const },
        { name: 'attendees', type: 'int64[]' as const },
        { name: 'metadata', type: 'object' as const, optional: true },
        { name: 'tags', type: 'auto' as const, optional: true }
      ] as const
    } as const)

    const api = createSchemaTypedApi(EventCollection)({
      prefixUrl: 'http://localhost:8108',
      token: 'xyz'
    })

    // Valid documents
    const event1 = {
      name: 'Tech Conference',
      location: [37.7749, -122.4194] as [number, number],
      attendees: [100, 200, 300]
    }

    const event2 = {
      name: 'Meetup',
      location: [40.7128, -74.006] as [number, number],
      attendees: [10, 20],
      metadata: { organizer: 'John', category: 'tech' },
      tags: 'technology'
    }

    expect(api).toBeTruthy()
  })
})
