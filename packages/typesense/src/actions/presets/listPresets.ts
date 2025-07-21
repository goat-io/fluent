import type { TypesensePresetResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function listPresets(
  ctx: TypesenseContext
): Promise<{ presets: TypesensePresetResponse[] }> {
  const response = await ctx.httpClient.request<{ presets: TypesensePresetResponse[] }>(
    '/presets'
  )
  
  // Filter presets by tenant if tenantId is set
  if (ctx.tenantId) {
    const tenantPrefix = `${ctx.tenantId}__`
    const filteredPresets = response.presets.filter(preset => 
      preset.name.startsWith(tenantPrefix)
    )
    
    // Remove tenant prefix from names for clean API response
    const cleanedPresets = filteredPresets.map(preset => ({
      ...preset,
      name: preset.name.substring(tenantPrefix.length)
    }))
    
    return { presets: cleanedPresets }
  }
  
  return response
}