import type { CommonLogger } from '@goatlab/js-utils'
import type { BuiltRouter } from '@trpc/server/unstable-core-do-not-import'
import type { Request, RequestHandler, Router } from 'express'
import { pkg } from '../consts'
import type {
  RequestLoggerOptions,
  RequestLogPrefixFn,
} from '../middleware/logs.middleware'
import type { SentryService } from '../sentry/sentry.service'
import type { Environment } from '../types/Envinronment'

/**
 * Validated user from Better Auth or other auth provider
 */
export interface ValidatedAuthUser {
  /** User's unique ID */
  id: string
  /** User's email address */
  email: string
  /** Whether email has been verified */
  emailVerified?: boolean
  /** User's display name */
  name?: string
  /** User's profile image URL */
  image?: string
  /** Session ID if using session-based auth */
  sessionId?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Result of token validation
 */
export interface AuthValidationResult {
  /** Whether the token is valid */
  valid: boolean
  /** Validated user info (only present if valid) */
  user?: ValidatedAuthUser
  /** Error message (only present if invalid) */
  error?: string
}

/**
 * Auth configuration for Better Auth integration
 */
export interface AuthConfig {
  /**
   * Validate a token and return the authenticated user.
   * This callback is called for each request with a Bearer token.
   *
   * @param token - The token from Authorization header (without "Bearer " prefix)
   * @param req - The Express request object (for accessing headers, tenant info, etc.)
   * @returns Validation result with user info or error
   *
   * @example
   * ```typescript
   * validateToken: async (token, req) => {
   *   const tenantId = req.headers['x-tenant-id'] as string
   *   const auth = await getBetterAuthForTenant(tenantId)
   *   const session = await auth.api.getSession({
   *     headers: new Headers({ authorization: `Bearer ${token}` })
   *   })
   *   if (!session?.user) {
   *     return { valid: false, error: 'Invalid session' }
   *   }
   *   return {
   *     valid: true,
   *     user: {
   *       id: session.user.id,
   *       email: session.user.email,
   *       emailVerified: session.user.emailVerified,
   *       name: session.user.name,
   *     }
   *   }
   * }
   * ```
   */
  validateToken?: (token: string, req: Request) => Promise<AuthValidationResult>
}

// Required configuration - only what's absolutely necessary
export interface RequiredExpressTrpcAppConfig {
  trpcRouter: BuiltRouter<any, any>
}

// Optional configuration with all possible options
export interface OptionalExpressTrpcAppConfig {
  // Basic app info
  appName?: string
  appVersion?: string
  port?: number
  baseUrl?: string

  // Environment
  environment?: Environment

  // Core dependencies
  sentryService?: SentryService
  logger?: CommonLogger

  // Express extensions
  expressResources?: Router[] | readonly Router[]
  customHandlers?: RequestHandler[]

  /**
   * Optional function to extract a prefix for request log lines.
   * Called on each request's `finish` event.
   * Useful for multi-tenant apps to prepend tenant ID.
   *
   * @example
   * ```typescript
   * requestLogPrefix: (req) => req.headers['x-tenant-id'] as string
   * ```
   */
  requestLogPrefix?: RequestLogPrefixFn

  /**
   * Logging configuration for request logs.
   * Passed through to the Express request logger middleware.
   */
  logging?: RequestLoggerOptions

  // Authentication configuration (Better Auth)
  auth?: AuthConfig

  // Feature flags
  features?: {
    openApiDocs?: boolean
    sentry?: boolean
    trustProxy?: boolean
    etag?: 'weak' | 'strong' | boolean
  }

  // Security configuration
  security?: {
    cors?: {
      allowedOrigins?: string[]
      credentials?: boolean
      maxAge?: number
    }
    helmet?: {
      contentSecurityPolicy?: boolean | object
      crossOriginEmbedderPolicy?: boolean
    }
    rateLimit?: {
      global?: {
        windowMs?: number
        max?: number
      }
      auth?: {
        windowMs?: number
        max?: number
      }
      api?: {
        windowMs?: number
        max?: number
      }
    }
    requestTimeout?: number // in milliseconds
  }

  // Body parsing limits
  bodyParsing?: {
    json?: {
      limit?: string
      type?: string[]
    }
    urlencoded?: {
      limit?: string
      extended?: boolean
    }
    raw?: {
      limit?: string
      inflate?: boolean
    }
  }

  // Performance settings
  performance?: {
    compression?: {
      enabled?: boolean
      level?: number
      threshold?: number
      chunkSize?: number
      memLevel?: number
    }
    memoryMonitoring?: {
      enabled?: boolean
      warningThreshold?: number
      criticalThreshold?: number
      monitorInterval?: number
      enableGarbageCollection?: boolean
      addHeaders?: boolean
    }
    caching?: {
      staticAssets?: {
        maxAge?: number // in seconds
      }
    }
  }

  // Server configuration
  server?: {
    viewEngine?: string
    viewPaths?: string[]
  }

  // Health check configuration
  healthCheck?: {
    path?: string
    customChecks?: () => Promise<any>
  }

  // Ready check configuration
  readyCheck?: {
    path?: string
    customChecks?: () => Promise<any>
  }

  // Process management
  processManagement?: {
    gracefulShutdown?: {
      enabled?: boolean
      timeout?: number
      onShutdown?: () => Promise<void>
    }
    uncaughtException?: {
      handler?: (error: Error) => void
    }
    unhandledRejection?: {
      handler?: (reason: any, promise: Promise<any>) => void
    }
  }
}

// Full configuration type combining required and optional
export type ExpressTrpcAppConfig = RequiredExpressTrpcAppConfig &
  Required<OptionalExpressTrpcAppConfig>

// Type for user input - only requires the required fields
export type ExpressTrpcAppConfigInput = RequiredExpressTrpcAppConfig &
  Partial<OptionalExpressTrpcAppConfig>

/**
 * Deep merge utility for configuration objects
 * Arrays are replaced, not merged
 */
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (sourceValue === undefined) {
        continue
      }

      if (
        sourceValue === null ||
        typeof sourceValue !== 'object' ||
        Array.isArray(sourceValue)
      ) {
        // For primitives, null, and arrays, replace the value
        ;(result as any)[key] = sourceValue
      } else if (
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // For objects, merge recursively
        ;(result as any)[key] = deepMerge(targetValue, sourceValue)
      } else {
        // If target doesn't have this object, just assign it
        ;(result as any)[key] = sourceValue
      }
    }
  }

  return result
}

/**
 * Get complete default configuration
 */
export function getDefaultConfig(
  userConfig: ExpressTrpcAppConfigInput,
): ExpressTrpcAppConfig {
  // Determine environment from user config or default
  const environment = userConfig.environment || 'local'
  const isProduction = environment === 'prod'
  const isDevelopment = environment === 'local' || environment === 'dev'

  // Determine port from user config or default
  const port = userConfig.port || 3000

  // Build complete default configuration
  const defaults: ExpressTrpcAppConfig = {
    // Required fields from user config
    trpcRouter: userConfig.trpcRouter,

    // Basic app info with defaults
    appName: pkg.name || 'express-trpc-app',
    appVersion: pkg.version || '1.0.0',
    port,
    environment,
    baseUrl: `http://localhost:${port}`,

    // Optional dependencies
    sentryService: undefined,
    logger: console,

    // Express extensions
    expressResources: [],
    customHandlers: [],
    requestLogPrefix: undefined,

    // Logging configuration
    logging: {
      suppressedPaths: ['/livez', '/readyz', '/health', '/ready'],
    },

    // Authentication (Better Auth) - no default validator
    auth: {
      validateToken: undefined,
    },

    // Feature flags
    features: {
      openApiDocs: false,
      sentry: isProduction,
      trustProxy: true,
      etag: 'strong',
    },

    // Security configuration
    security: {
      cors: {
        allowedOrigins: isProduction
          ? []
          : ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
        maxAge: 86400,
      },
      helmet: {
        contentSecurityPolicy: isProduction,
        crossOriginEmbedderPolicy: !isDevelopment,
      },
      rateLimit: {
        global: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100,
        },
        auth: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 5,
        },
        api: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100,
        },
      },
      requestTimeout: 30000, // 30 seconds
    },

    // Body parsing configuration
    bodyParsing: {
      json: {
        limit: '100kb',
        type: ['application/json', 'text/plain'],
      },
      urlencoded: {
        limit: '100kb',
        extended: true,
      },
      raw: {
        limit: '100kb',
        inflate: true,
      },
    },

    // Performance settings
    performance: {
      compression: {
        enabled: true,
        level: 6,
        threshold: 1024,
        chunkSize: 16 * 1024,
        memLevel: 8,
      },
      memoryMonitoring: {
        enabled: true,
        warningThreshold: 90,
        criticalThreshold: 95,
        monitorInterval: 30000,
        enableGarbageCollection: isProduction,
        addHeaders: !isProduction,
      },
      caching: {
        staticAssets: {
          maxAge: 31536000, // 1 year
        },
      },
    },

    // Server configuration
    server: {
      viewEngine: 'ejs',
      viewPaths: [],
    },

    // Health check configuration
    healthCheck: {
      path: '/health',
      customChecks: undefined,
    },

    // Ready check configuration
    readyCheck: {
      path: '/ready',
      customChecks: undefined,
    },

    // Process management
    processManagement: {
      gracefulShutdown: {
        enabled: true,
        timeout: 30000,
        onShutdown: undefined,
      },
      uncaughtException: undefined,
      unhandledRejection: undefined,
    },
  }

  // Deep merge user configuration with defaults
  const merged = deepMerge(defaults, userConfig)

  // Special handling for baseUrl - use user-provided value if given
  if (userConfig.baseUrl) {
    merged.baseUrl = userConfig.baseUrl
  }

  return merged
}
