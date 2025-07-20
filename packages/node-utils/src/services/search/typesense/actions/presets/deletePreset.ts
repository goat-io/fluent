import type { TypesensePresetResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function deletePreset(
  ctx: TypesenseContext,
  presetName: string
): Promise<TypesensePresetResponse> {
  return await ctx.httpClient.request<TypesensePresetResponse>(
    `/presets/${presetName}`,
    { method: 'DELETE' }
  )
}