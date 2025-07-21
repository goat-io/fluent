import type { TypesensePreset, TypesensePresetResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function upsertPreset(
  ctx: TypesenseContext,
  preset: TypesensePreset
): Promise<TypesensePresetResponse> {
  return await ctx.httpClient.request<TypesensePresetResponse>(
    `/presets/${preset.name}`,
    {
      method: 'PUT',
      body: preset
    }
  )
}