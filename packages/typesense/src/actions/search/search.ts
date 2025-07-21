import type { 
  TypesenseQuery, 
  TypesenseQueryResults, 
  TypesenseCollectionOptions,
  TypesenseTextQuery,
  TypesenseVectorQuery 
} from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function search<T extends Record<string, any>>(
  ctx: TypesenseContext,
  query: TypesenseQuery,
  options?: TypesenseCollectionOptions
): Promise<TypesenseQueryResults<T>> {
  const collectionName = options?.collection || ctx.fqcn()

  return await ctx.httpClient.request<TypesenseQueryResults<T>>(
    `/collections/${collectionName}/documents/search`,
    {
      searchParams: query,
      timeout: ctx.httpClient.getOptions().searchTimeout
    }
  )
}

export async function searchVector<T extends Record<string, any>>(
  ctx: TypesenseContext,
  query: TypesenseVectorQuery,
  options?: TypesenseCollectionOptions
): Promise<TypesenseQueryResults<T>> {
  return search(ctx, query, options)
}

export async function searchText<T extends Record<string, any>>(
  ctx: TypesenseContext,
  query: TypesenseTextQuery,
  options?: TypesenseCollectionOptions
): Promise<TypesenseQueryResults<T>> {
  return search(ctx, query, options)
}