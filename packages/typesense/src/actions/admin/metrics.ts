import type { TypesenseMetrics } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function getMetrics(ctx: TypesenseContext): Promise<TypesenseMetrics> {
  return await ctx.httpClient.request<TypesenseMetrics>('/metrics.json')
}

export async function getStats(ctx: TypesenseContext): Promise<any> {
  return await ctx.httpClient.request<any>('/stats.json')
}