import type { TypesenseContext } from '../../types'
import type { TypesenseCollectionOutput } from '../../typesense.model'

export async function listCollections(
  ctx: TypesenseContext,
): Promise<TypesenseCollectionOutput[]> {
  return ctx.httpClient.request<TypesenseCollectionOutput[]>('/collections')
}
