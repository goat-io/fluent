import type { TypesenseContext } from '../../types'
import type { TypesenseCollectionOutput } from '../../typesense.model'

export async function getCollection(
  ctx: TypesenseContext,
  collectionName?: string,
): Promise<TypesenseCollectionOutput> {
  const collection = collectionName || ctx.fqcn()

  const result = await ctx.httpClient.request<TypesenseCollectionOutput>(
    `/collections/${collection}`,
  )

  // Update cache
  ctx.schemaManager.setCachedSchema(collection, result)

  return result
}
