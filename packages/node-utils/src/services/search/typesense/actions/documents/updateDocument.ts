import type { TypesenseDocument, TypesenseCollectionOptions } from '../../typesense.model'
import { TypesenseError, isValidDocumentId } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function updateDocument<T extends Record<string, any>>(
  ctx: TypesenseContext,
  document: Partial<TypesenseDocument<T>> & { id: string | number },
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<T>> {
  if (!isValidDocumentId(document.id)) {
    throw new TypesenseError('updateDocument requires a valid document id', 400)
  }

  const collectionName = options?.collection || ctx.collectionName

  return await ctx.httpClient.request<TypesenseDocument<T>>(
    `/collections/${collectionName}/documents/${document.id}`,
    {
      method: 'PATCH',
      body: document
    }
  )
}