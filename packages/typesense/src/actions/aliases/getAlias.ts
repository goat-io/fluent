import type { TypesenseContext } from '../../types'
import type { TypesenseAliasResponse } from '../../typesense.model'
import { createTenantQualifiedName } from '../../utils/tenant'

export async function getAlias(
  ctx: TypesenseContext,
  aliasName: string
): Promise<TypesenseAliasResponse> {
  const qualifiedAliasName = createTenantQualifiedName(ctx.tenantId, aliasName)
  return await ctx.httpClient.request<TypesenseAliasResponse>(
    `/aliases/${qualifiedAliasName}`
  )
}
