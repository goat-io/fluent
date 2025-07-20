import type { TypesenseCollectionOutput, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function getCollection(
  ctx: TypesenseContext,
  collectionName?: string
): Promise<TypesenseCollectionOutput> {
  const collection = collectionName || ctx.collectionName

  const result = await ctx.httpClient.request<TypesenseCollectionOutput>(
    `/collections/${collection}`
  )

  // Update cache
  ctx.schemaManager.setCachedSchema(collection, result)

  return result
}