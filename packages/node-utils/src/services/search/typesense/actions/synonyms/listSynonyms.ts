import type { TypesenseSynonymResponse, TypesenseCollectionOptions } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function listSynonyms(
  ctx: TypesenseContext,
  options?: TypesenseCollectionOptions
): Promise<{ synonyms: TypesenseSynonymResponse[] }> {
  const collectionName = options?.collection || ctx.collectionName

  return await ctx.httpClient.request<{ synonyms: TypesenseSynonymResponse[] }>(
    `/collections/${collectionName}/synonyms`
  )
}