import type { TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function clearCollection(
  ctx: TypesenseContext,
  options?: TypesenseCollectionOptions
): Promise<{ num_deleted: number }> {
  const collectionName = options?.collection || ctx.collectionName
  
  return await ctx.httpClient.request<{ num_deleted: number }>(
    `/collections/${collectionName}/documents`,
    {
      method: 'DELETE',
      searchParams: { filter_by: '*' }
    }
  )
}