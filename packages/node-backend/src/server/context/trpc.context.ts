import type { CommonLogger } from '@goatlab/js-utils'
import type * as trpcExpress from '@trpc/server/adapters/express'
import type { Request } from 'express'
import { ExtractJwt } from 'passport-jwt'
import type {
  AuthConfig,
  AuthValidationResult,
  ValidatedAuthUser,
} from '../bootstraps/ExpressTrpcAppConfig'
import { requestContext } from './request.context'

declare global {
  namespace Express {
    interface Request {
      context: ReturnType<typeof requestContext>
      /** Pre-validated Better Auth user (set by middleware) */
      betterAuthUser?: ValidatedAuthUser
    }
  }
}

/**
 * Options for creating the context factory
 */
export interface ContextFactoryOptions {
  /** Token validation callback from auth config */
  validateToken?: AuthConfig['validateToken']
  /** Logger instance */
  logger?: CommonLogger
}

/**
 * Create a context factory with the given auth configuration.
 * This allows injecting the auth validation logic at app startup.
 *
 * @param options - Configuration options including auth validator
 * @returns A createContext function for tRPC/Express
 */
export function createContextFactory(options: ContextFactoryOptions = {}) {
  const { validateToken, logger = console } = options

  /**
   * Validate a token using the configured validator
   */
  async function validateAuthToken(
    token: string,
    req: Request,
  ): Promise<AuthValidationResult> {
    // If no validator configured, return invalid
    if (!validateToken) {
      return {
        valid: false,
        error: 'No auth validator configured',
      }
    }

    try {
      return await validateToken(token, req)
    } catch (error) {
      logger.error?.('[Auth] Token validation error:', error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      }
    }
  }

  /**
   * Create the tRPC/Express context for a request.
   * Accepts optional `info` with `connectionParams` for SSE/subscription
   * connections where the browser's EventSource API cannot send custom headers.
   * The tRPC client passes the auth token via connectionParams instead.
   */
  async function createContext({
    req,
    info,
  }: trpcExpress.CreateExpressContextOptions & {
    info?: { connectionParams?: Record<string, unknown> | null }
  }): Promise<ReturnType<typeof requestContext>> {
    // Check if user was already validated by middleware (e.g., multi-tenant middleware)
    if (req.betterAuthUser) {
      return requestContext(req, {
        uid: req.betterAuthUser.id,
        email: req.betterAuthUser.email,
        email_verified: req.betterAuthUser.emailVerified ?? false,
        name: req.betterAuthUser.name,
        iss: 'better-auth',
        aud: 'app',
        auth_time: Math.floor(Date.now() / 1000),
        sub: req.betterAuthUser.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    }

    // Extract token from Authorization header first, then fall back to
    // connectionParams (SSE/EventSource connections cannot send custom headers,
    // so the tRPC client passes the auth token via connectionParams instead)
    let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req)
    if (!token && info?.connectionParams) {
      const cpAuth = info.connectionParams.authorization
      if (typeof cpAuth === 'string' && cpAuth.startsWith('Bearer ')) {
        token = cpAuth.slice(7)
      }
    }

    if (token) {
      // Validate using configured auth validator (Better Auth)
      const result = await validateAuthToken(token, req)

      if (result.valid && result.user) {
        return requestContext(req, {
          uid: result.user.id,
          email: result.user.email,
          email_verified: result.user.emailVerified ?? false,
          name: result.user.name,
          iss: 'better-auth',
          aud: 'app',
          auth_time: Math.floor(Date.now() / 1000),
          sub: result.user.id,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      }

      // Token provided but validation failed
      // Don't throw immediately - let protected procedures handle it
      // This allows for anonymous access to public endpoints
      if (result.error) {
        logger.warn?.(
          `[Auth] Token validation failed: ${result.error}. Proceeding without user context.`,
        )
      }
    }

    // No token or validation failed - return anonymous context
    return requestContext(req)
  }

  return createContext
}

/**
 * Default context creator (no auth validation)
 * Use createContextFactory for production with auth
 */
export const createContext = createContextFactory()

export type TrpcContext = Awaited<ReturnType<typeof createContext>>
