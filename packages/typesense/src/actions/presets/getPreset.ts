import type { TypesenseContext } from '../../types'
import type { TypesensePresetResponse } from '../../typesense.model'
import { createTenantQualifiedName } from '../../utils/tenant'

export async function getPreset(
  ctx: TypesenseContext,
  presetName: string
): Promise<TypesensePresetResponse> {
  // Apply tenant prefix to preset name
  const qualifiedName = createTenantQualifiedName(ctx.tenantId, presetName)

  return await ctx.httpClient.request<TypesensePresetResponse>(
    `/presets/${qualifiedName}`
  )
}
