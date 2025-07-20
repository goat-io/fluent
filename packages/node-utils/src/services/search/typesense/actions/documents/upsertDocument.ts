import type { TypesenseDocument, TypesenseCollectionOptions, WithRequiredId } from '../../typesense.model'
import { TypesenseError, isValidDocumentId } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function upsertDocument<T extends Record<string, any>>(
  ctx: TypesenseContext,
  document: WithRequiredId<T>,
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<T>> {
  if (!isValidDocumentId(document.id)) {
    throw new TypesenseError('Document must have a valid id', 400)
  }

  const collectionName = options?.collection || ctx.collectionName

  return await ctx.httpClient.request<TypesenseDocument<T>>(
    `/collections/${collectionName}/documents`,
    {
      method: 'POST',
      body: document,
      searchParams: { action: 'upsert' }
    }
  )
}