import type { TypesenseCollection, TypesenseCollectionOutput } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function createCollection(
  ctx: TypesenseContext,
  collection: TypesenseCollection
): Promise<TypesenseCollectionOutput> {
  const result = await ctx.httpClient.request<TypesenseCollectionOutput>(
    '/collections',
    {
      method: 'POST',
      body: collection
    }
  )

  // Cache the schema
  ctx.schemaManager.setCachedSchema(collection.name, collection)

  return result
}