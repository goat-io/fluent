import type { TypesenseCollectionOutput, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function deleteCollection(
  ctx: TypesenseContext,
  collectionName?: string
): Promise<TypesenseCollectionOutput> {
  const collection = collectionName || ctx.fqcn()

  const result = await ctx.httpClient.request<TypesenseCollectionOutput>(
    `/collections/${collection}`,
    {
      method: 'DELETE'
    }
  )

  // Remove from cache
  ctx.schemaManager.deleteCachedSchema(collection)

  return result
}