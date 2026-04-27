import { initTRPC, TRPCError } from '@trpc/server'
import type {
  DefaultErrorShape,
  ErrorFormatter,
} from '@trpc/server/unstable-core-do-not-import'
import type { OpenApiMeta } from 'trpc-to-openapi'
import type { TrpcContext } from './context/trpc.context'
import { DecodedUserToken } from './schemas/user.schema'

export function getTrpc<
  ExtendedAuthenticatedContext = Record<string, unknown>,
  ExtendedContext = Record<string, unknown>,
>(params?: {
  /** Extend authenticated context with additional data (e.g., account context) */
  extendAuthenticatedContext?: (params: {
    user: DecodedUserToken
    ctx: TrpcContext
  }) => ExtendedAuthenticatedContext
  /** Extend base context (runs for all requests) - use for tenant services, etc. */
  extendContext?: (ctx: TrpcContext) => Promise<ExtendedContext>
  /** Custom error formatter for tRPC errors */
  errorFormatter?: ErrorFormatter<TrpcContext, DefaultErrorShape>
}) {
  const t = initTRPC
    .context<TrpcContext>()
    .meta<OpenApiMeta>()
    .create({
      errorFormatter: params?.errorFormatter,
      sse: {
        maxDurationMs: 5 * 60 * 1000,
        ping: { enabled: true, intervalMs: 3000 },
        client: { reconnectAfterInactivityMs: 5000 },
      },
    })

  const router = t.router

  const extendContext = params?.extendContext ?? (() => ({}) as ExtendedContext)

  const extendedMiddleware = t.middleware(async ({ ctx, next }) => {
    return await next({
      ctx: {
        ...ctx,
        extended: await extendContext(ctx),
      },
    })
  })

  const publicEndpoint = t.procedure.use(extendedMiddleware)

  // Default to a function returning an empty object if not provided
  const extendAuthenticatedContext =
    params?.extendAuthenticatedContext ??
    (() => ({}) as ExtendedAuthenticatedContext)

  const isMaybeLoggedIn = t.middleware(async ({ ctx, next }) => {
    let isLoggedIn = false

    const tokenPurpose =
      ctx.user && 'tokenPurpose' in ctx.user.decodedToken
        ? ctx.user.decodedToken.tokenPurpose
        : undefined

    if (
      ctx.user?.userId ||
      ctx.user?.email ||
      tokenPurpose === 'INTERNAL_SERVICE'
    ) {
      isLoggedIn = true
    }

    const extra = ctx.user
      ? (extendAuthenticatedContext({
          user: ctx.user.decodedToken,
          ctx,
        }) as ExtendedAuthenticatedContext)
      : undefined

    return await next({
      ctx: {
        ...ctx,
        isLoggedIn,
        user: ctx.user ? ctx.user : undefined,
        authenticated: extra,
      },
    })
  })

  const isLoggedIn = t.middleware(async ({ ctx, next }) => {
    const tokenPurpose =
      ctx.user && 'tokenPurpose' in ctx.user.decodedToken
        ? ctx.user.decodedToken.tokenPurpose
        : undefined

    if (
      (!ctx.user?.userId || !ctx.user.email) &&
      tokenPurpose !== 'INTERNAL_SERVICE'
    ) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message:
          'No user in the request. Make sure to include a valid auth token.',
      })
    }

    const extra = extendAuthenticatedContext({
      user: ctx.user!.decodedToken,
      ctx,
    }) as ExtendedAuthenticatedContext

    // Explicitly type the new context as TrpcContext & T
    return await next({
      ctx: {
        ...ctx,
        user: ctx.user!,
        authenticated: extra,
      },
    })
  })

  const authenticatedEndpoint = t.procedure
    .use(extendedMiddleware)
    .use(isLoggedIn)
  const maybeAuthenticatedEnpoint = t.procedure
    .use(extendedMiddleware)
    .use(isMaybeLoggedIn)

  return {
    authenticatedEndpoint,
    maybeAuthenticatedEnpoint,
    publicEndpoint,
    router,
    t,
  }
}
