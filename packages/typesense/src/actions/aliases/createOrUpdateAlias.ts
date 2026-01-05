import type { TypesenseContext } from '../../types'
import type { TypesenseAliasResponse } from '../../typesense.model'
import { createTenantQualifiedName } from '../../utils/tenant'

export async function createOrUpdateAlias(
  ctx: TypesenseContext,
  aliasName: string,
  collectionName: string,
): Promise<TypesenseAliasResponse> {
  // Apply tenant prefix to alias name if tenant is set
  const qualifiedAliasName = createTenantQualifiedName(ctx.tenantId, aliasName)

  // Collection name should already be qualified via fqcn
  const qualifiedCollectionName = ctx.fqcn(collectionName)

  return await ctx.httpClient.request<TypesenseAliasResponse>(
    `/aliases/${qualifiedAliasName}`,
    {
      method: 'PUT',
      body: { collection_name: qualifiedCollectionName },
    },
  )
}
