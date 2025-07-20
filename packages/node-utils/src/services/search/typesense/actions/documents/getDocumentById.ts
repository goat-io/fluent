import type { TypesenseDocument, TypesenseCollectionOptions } from '../../typesense.model'
import { isValidDocumentId } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function getDocumentById<T extends Record<string, any>>(
  ctx: TypesenseContext,
  id: string | number,
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<T>> {
  if (!isValidDocumentId(id)) {
    throw new Error('Invalid document id')
  }

  const collectionName = options?.collection || ctx.collectionName

  return await ctx.httpClient.request<TypesenseDocument<T>>(
    `/collections/${collectionName}/documents/${id}`
  )
}