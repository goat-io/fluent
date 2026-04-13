import type { TypesenseContext } from '../../types'
import type { TypesenseCollectionStats } from '../../typesense.model'

export async function getCollectionStats(
  ctx: TypesenseContext,
  collectionName?: string,
): Promise<TypesenseCollectionStats> {
  const collection = collectionName || ctx.fqcn()
  return await ctx.httpClient.request<TypesenseCollectionStats>(
    `/collections/${collection}/stats`,
  )
}
