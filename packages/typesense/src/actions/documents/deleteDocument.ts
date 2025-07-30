import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseDocument
} from '../../typesense.model'
import { isValidDocumentId } from '../../typesense.model'

export async function deleteDocument<T extends Record<string, any>>(
  ctx: TypesenseContext,
  id: string | number,
  options?: TypesenseCollectionOptions
): Promise<TypesenseDocument<T>> {
  if (!isValidDocumentId(id)) {
    throw new Error('Invalid document id')
  }

  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseDocument<T>>(
    `/collections/${collectionName}/documents/${id}`,
    {
      method: 'DELETE'
    }
  )
}
