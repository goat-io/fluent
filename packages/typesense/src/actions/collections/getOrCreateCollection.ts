import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollection,
  TypesenseCollectionOutput
} from '../../typesense.model'
import { createCollection } from './createCollection'
import { getCollection } from './getCollection'

export async function getOrCreateCollection(
  ctx: TypesenseContext,
  collection: TypesenseCollection
): Promise<TypesenseCollectionOutput> {
  try {
    // Try to get existing collection
    return await getCollection(ctx, collection.name)
  } catch (error: any) {
    // If collection doesn't exist (404), create it
    if (error.status === 404 || error.response?.status === 404) {
      return await createCollection(ctx, collection)
    }
    throw error
  }
}
