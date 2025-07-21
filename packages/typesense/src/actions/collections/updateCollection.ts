import type { TypesenseCollection, TypesenseCollectionOutput, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function updateCollection(
  ctx: TypesenseContext,
  collection: Partial<TypesenseCollection>,
  options?: TypesenseCollectionOptions
): Promise<TypesenseCollectionOutput> {
  const collectionName = options?.collection || collection.name || ctx.fqcn()

  const result = await ctx.httpClient.request<TypesenseCollectionOutput>(
    `/collections/${collectionName}`,
    {
      method: 'PATCH',
      body: collection
    }
  )

  // Update cache
  ctx.schemaManager.setCachedSchema(collectionName, result)

  return result
}