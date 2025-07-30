import { TypesenseApi, type TypesenseApiOptions } from '../TypesenseApi'
import type { TypesenseCollection } from '../typesense.model'
import { type InferFromCollection } from './schema-to-types'

/**
 * Creates a strongly-typed API instance from a collection definition
 *
 * @example
 * ```typescript
 * const ProductCollection = defineCollection({
 *   name: 'products',
 *   fields: [
 *     { name: 'id', type: 'string' },
 *     { name: 'name', type: 'string' },
 *     { name: 'price', type: 'float' },
 *     { name: 'inStock', type: 'bool' }
 *   ]
 * })
 *
 * const api = createSchemaTypedApi(ProductCollection)({
 *   prefixUrl: 'http://localhost:8108',
 *   token: 'xyz'
 * })
 *
 * // Fully typed operations
 * await api.documents.insert({
 *   id: '1',
 *   name: 'Widget',
 *   price: 99.99,
 *   inStock: true
 * })
 * ```
 */
export function createSchemaTypedApi<const C extends TypesenseCollection>(
  collection: C
) {
  type DocType = InferFromCollection<C>

  return (
    options: Omit<TypesenseApiOptions, 'collectionName'>
  ): TypesenseApi<DocType> => {
    return new TypesenseApi<DocType>({
      ...options,
      collectionName: collection.name
    } as TypesenseApiOptions)
  }
}
