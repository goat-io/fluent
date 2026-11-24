// cd packages/node-backend && pnpm exec vitest run --config vitest.config-regression.config.ts
import { initTRPC } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { getDefaultConfig } from '../ExpressTrpcAppConfig'

describe('router configuration identity', () => {
  it('keeps the actual nested router identity and its caller intact', async () => {
    const t = initTRPC.context<{ request: string }>().create()
    const router = t.router({
      posts: t.router({
        homeFeed: t.procedure.query(({ ctx }) => ctx.request),
      }),
    })
    const registry = new WeakMap<object, string>([[router, 'registered']])
    const config = getDefaultConfig({ trpcRouter: router })

    expect(config.trpcRouter).toBe(router)
    expect(config.trpcRouter._def).toBe(router._def)
    expect(registry.get(config.trpcRouter)).toBe('registered')
    expect(config.trpcRouter._def.procedures['posts.homeFeed']).toBe(
      router._def.procedures['posts.homeFeed'],
    )
    await expect(
      (config.trpcRouter as typeof router)
        .createCaller({ request: 'same-request' })
        .posts.homeFeed(),
    ).resolves.toBe('same-request')
  })

  it('still merges nested options and leaves caller options untouched', () => {
    const t = initTRPC.create()
    const router = t.router({ health: t.procedure.query(() => 'ok') })
    const options = {
      trpcRouter: router,
      security: { cors: { maxAge: 123 } },
      performance: { compression: { level: 1 } },
    }
    const config = getDefaultConfig(options)

    expect(config.trpcRouter).toBe(router)
    expect(config.security?.cors?.maxAge).toBe(123)
    expect(config.security?.cors?.credentials).toBe(true)
    expect(config.security?.rateLimit?.global?.max).toBe(100)
    expect(config.performance?.compression?.level).toBe(1)
    expect(config.performance?.compression?.threshold).toBe(1024)
    expect(options.security).toEqual({ cors: { maxAge: 123 } })
    expect(options.performance).toEqual({ compression: { level: 1 } })
  })
})
