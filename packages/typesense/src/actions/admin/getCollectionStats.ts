import type { TypesenseCollectionStats } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function getCollectionStats(
  ctx: TypesenseContext,
  collectionName?: string
): Promise<TypesenseCollectionStats> {
  const collection = collectionName || ctx.fqcn()
  return await ctx.httpClient.request<TypesenseCollectionStats>(
    `/collections/${collection}/stats`
  )
}