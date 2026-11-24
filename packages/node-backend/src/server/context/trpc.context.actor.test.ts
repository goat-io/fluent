// pnpm exec vitest run src/server/context/trpc.context.actor.test.ts
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { Request } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { createContextFactory } from './trpc.context'

const user = { id: 'authenticated-user', email: 'user@example.test' }
function options(
  actor: unknown,
  headers: Record<string, string> = {},
  prevalidated = true,
) {
  return {
    req: {
      headers,
      socket: { remoteAddress: '127.0.0.1' },
      method: 'GET',
      url: '/trpc/realtime.subscribe',
      get: () => undefined,
      ...(prevalidated ? { betterAuthUser: user } : {}),
    },
    res: {},
    info: {
      connectionParams: {
        authorization: 'Bearer test-session',
        'x-acting-account-id': actor,
      },
    },
  } as unknown as CreateExpressContextOptions
}
describe('SSE acting account context', () => {
  it('hydrates the actor before validating the SSE token', async () => {
    const validateToken = vi.fn(async (_token: string, req: Request) => {
      expect(req.headers['x-acting-account-id']).toBe('business-a')
      return { valid: true, user }
    })
    const context = await createContextFactory({ validateToken })(
      options('business-a', {}, false),
    )
    expect(validateToken).toHaveBeenCalledOnce()
    expect(context.actingAccountId).toBe('business-a')
    expect(context.user?.userId).toBe(user.id)
  })
  it('hydrates the actor when middleware already authenticated the user', async () => {
    const validateToken = vi.fn()
    const context = await createContextFactory({ validateToken })(
      options('business-b'),
    )
    expect(context.actingAccountId).toBe('business-b')
    expect(context.user?.userId).toBe(user.id)
    expect(validateToken).not.toHaveBeenCalled()
  })
  it('preserves an existing acting header over connection parameters', async () => {
    const context = await createContextFactory()(
      options('connection-actor', { 'x-acting-account-id': 'header-actor' }),
    )
    expect(context.actingAccountId).toBe('header-actor')
  })
  it.each([undefined, null, '', '   ', 42, ['business'], { id: 'business' }])(
    'ignores invalid connection actor %j',
    async actor => {
      const input = options(actor)
      const context = await createContextFactory()(input)
      expect(context.actingAccountId).toBeUndefined()
      expect(input.req.headers['x-acting-account-id']).toBeUndefined()
    },
  )
  it('keeps actor selection local to each request', async () => {
    const createContext = createContextFactory()
    const contexts = await Promise.all(
      ['business-a', 'business-b'].map(actor => createContext(options(actor))),
    )
    expect(contexts.map(context => context.actingAccountId)).toEqual([
      'business-a',
      'business-b',
    ])
    expect(
      (await createContext(options(undefined))).actingAccountId,
    ).toBeUndefined()
  })
})
