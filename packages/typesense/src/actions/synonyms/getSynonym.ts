import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseSynonymResponse,
} from '../../typesense.model'

export async function getSynonym(
  ctx: TypesenseContext,
  synonymId: string,
  options?: TypesenseCollectionOptions,
): Promise<TypesenseSynonymResponse> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseSynonymResponse>(
    `/collections/${collectionName}/synonyms/${synonymId}`,
  )
}
