import type { TypesenseContext } from '../../types'
import type { TypesenseMetrics } from '../../typesense.model'

export async function getMetrics(
  ctx: TypesenseContext,
): Promise<TypesenseMetrics> {
  return await ctx.httpClient.request<TypesenseMetrics>('/metrics.json')
}

export async function getStats(ctx: TypesenseContext): Promise<any> {
  return await ctx.httpClient.request<any>('/stats.json')
}
