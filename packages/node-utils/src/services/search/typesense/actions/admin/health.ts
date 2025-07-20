import type { TypesenseHealthResponse } from '../../typesense.model'
import type { TypesenseContext } from '../../types'

export async function health(ctx: TypesenseContext): Promise<TypesenseHealthResponse> {
  return await ctx.httpClient.request<TypesenseHealthResponse>('/health')
}

export async function waitForHealth(
  ctx: TypesenseContext,
  maxRetries: number = 15,
  delayMs: number = 1000
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await health(ctx)
      return
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Typesense failed to become healthy after ${maxRetries} retries`)
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}