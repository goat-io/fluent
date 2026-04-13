import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseOverrideResponse,
} from '../../typesense.model'

export async function listOverrides(
  ctx: TypesenseContext,
  options?: TypesenseCollectionOptions,
): Promise<{ overrides: TypesenseOverrideResponse[] }> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<{
    overrides: TypesenseOverrideResponse[]
  }>(`/collections/${collectionName}/overrides`)
}
