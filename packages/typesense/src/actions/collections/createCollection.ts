import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollection,
  TypesenseCollectionOutput,
} from '../../typesense.model'

export async function createCollection(
  ctx: TypesenseContext,
  collection: TypesenseCollection,
): Promise<TypesenseCollectionOutput> {
  // Use fqcn for the collection name if tenant is configured
  const collectionWithFqcn = {
    ...collection,
    name: ctx.fqcn(collection.name),
  }

  const result = await ctx.httpClient.request<TypesenseCollectionOutput>(
    '/collections',
    {
      method: 'POST',
      body: collectionWithFqcn,
    },
  )

  // Cache the schema with the fully qualified name
  ctx.schemaManager.setCachedSchema(collectionWithFqcn.name, collectionWithFqcn)

  return result
}
