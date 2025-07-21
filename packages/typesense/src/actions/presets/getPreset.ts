import type { TypesensePresetResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function getPreset(
  ctx: TypesenseContext,
  presetName: string
): Promise<TypesensePresetResponse> {
  return await ctx.httpClient.request<TypesensePresetResponse>(
    `/presets/${presetName}`
  )
}