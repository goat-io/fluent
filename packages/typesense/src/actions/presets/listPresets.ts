import type { TypesensePresetResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function listPresets(
  ctx: TypesenseContext
): Promise<{ presets: TypesensePresetResponse[] }> {
  return await ctx.httpClient.request<{ presets: TypesensePresetResponse[] }>(
    '/presets'
  )
}