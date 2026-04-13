// Example demonstrating TypeScript type inference for Typesense
// npx vitest run ./src/tests/type-inference-example.ts

import { describe, expect, it } from 'vitest'
import {
  createSchemaTypedApi,
  defineCollection,
  type InferDocumentType,
} from '../index'

describe('Type Inference Example', () => {
  it('should demonstrate proper type inference', () => {
    // Define a strongly-typed collection
    const ProductCollection = defineCollection({
      name: 'products',
      fields: [
        { name: 'id', type: 'string' as const },
        { name: 'title', type: 'string' as const },
        { name: 'description', type: 'string' as const, optional: true },
        { name: 'price', type: 'float' as const },
        { name: 'inStock', type: 'bool' as const },
        { name: 'tags', type: 'string[]' as const, optional: true },
      ] as const,
    } as const)

    // Verify the inferred type
    type ProductDoc = InferDocumentType<typeof ProductCollection>

    // These should compile without errors
    const _validDoc1: ProductDoc = {
      title: 'Laptop',
      price: 999.99,
      inStock: true,
    }

    const _validDoc2: ProductDoc = {
      title: 'Gaming Laptop',
      description: 'High-performance laptop',
      price: 1999.99,
      inStock: true,
      tags: ['gaming', 'performance'],
    }

    // Create typed API
    const api = createSchemaTypedApi(ProductCollection)({
      prefixUrl: 'http://localhost:8108',
      token: 'xyz',
    })

    // Verify API structure
    expect(api).toBeDefined()
    expect(api.documents).toBeDefined()
    expect(typeof api.documents.insert).toBe('function')

    // The following would be compile errors if uncommented:
    // ❌ Missing required field
    // const invalidDoc1: ProductDoc = {
    //   price: 99.99,
    //   inStock: true
    // }

    // ❌ Wrong type for price
    // const invalidDoc2: ProductDoc = {
    //   title: 'Product',
    //   price: '99.99', // should be number
    //   inStock: true
    // }

    // ❌ Wrong type for optional field
    // const invalidDoc3: ProductDoc = {
    //   title: 'Product',
    //   price: 99.99,
    //   inStock: true,
    //   tags: 'single-tag' // should be string[]
    // }
  })

  it('should handle complex field types', () => {
    const EventCollection = defineCollection({
      name: 'events',
      fields: [
        { name: 'id', type: 'string' as const },
        { name: 'name', type: 'string' as const },
        { name: 'timestamp', type: 'int64' as const },
        { name: 'location', type: 'geopoint' as const },
        { name: 'attendees', type: 'int32[]' as const, optional: true },
        { name: 'metadata', type: 'object' as const, optional: true },
      ] as const,
    } as const)

    type EventDoc = InferDocumentType<typeof EventCollection>

    const validEvent: EventDoc = {
      name: 'Tech Conference',
      timestamp: Date.now(),
      location: [37.7749, -122.4194],
    }

    const validEventWithOptionals: EventDoc = {
      name: 'Meetup',
      timestamp: Date.now(),
      location: [40.7128, -74.006],
      attendees: [10, 20, 30],
      metadata: { organizer: 'John', venue: 'Tech Hub' },
    }

    expect(validEvent).toBeDefined()
    expect(validEventWithOptionals).toBeDefined()
  })
})
