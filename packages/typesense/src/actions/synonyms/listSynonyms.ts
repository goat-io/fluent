import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseSynonymResponse,
} from '../../typesense.model'

export async function listSynonyms(
  ctx: TypesenseContext,
  options?: TypesenseCollectionOptions,
): Promise<{ synonyms: TypesenseSynonymResponse[] }> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<{ synonyms: TypesenseSynonymResponse[] }>(
    `/collections/${collectionName}/synonyms`,
  )
}
