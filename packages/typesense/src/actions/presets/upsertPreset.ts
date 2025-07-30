import type { TypesenseContext } from '../../types'
import type {
  TypesensePreset,
  TypesensePresetResponse
} from '../../typesense.model'
import { createTenantQualifiedName } from '../../utils/tenant'

export async function upsertPreset(
  ctx: TypesenseContext,
  preset: TypesensePreset
): Promise<TypesensePresetResponse> {
  // Apply tenant prefix to preset name
  const qualifiedName = createTenantQualifiedName(ctx.tenantId, preset.name)
  const qualifiedPreset = { ...preset, name: qualifiedName }

  return await ctx.httpClient.request<TypesensePresetResponse>(
    `/presets/${qualifiedName}`,
    {
      method: 'PUT',
      body: qualifiedPreset
    }
  )
}
