import type { TypesenseCollectionOutput } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function listCollections(
  ctx: TypesenseContext
): Promise<TypesenseCollectionOutput[]> {
  return ctx.httpClient.request<TypesenseCollectionOutput[]>('/collections')
}