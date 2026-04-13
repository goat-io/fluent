import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseDeleteByFilterOptions,
} from '../../typesense.model'

export async function deleteByFilter(
  ctx: TypesenseContext,
  filter: string,
  options?: TypesenseDeleteByFilterOptions & TypesenseCollectionOptions,
): Promise<{ num_deleted: number }> {
  const collectionName = options?.collection || ctx.fqcn()

  const params = new URLSearchParams({ filter_by: filter })

  if (options?.batch_size) {
    params.set('batch_size', options.batch_size.toString())
  }

  return await ctx.httpClient.request<{ num_deleted: number }>(
    `/collections/${collectionName}/documents`,
    {
      method: 'DELETE',
      searchParams: params,
    },
  )
}
