import type { Server } from 'node:http'
import { Time, Units } from '@goatlab/js-utils'
import * as Sentry from '@sentry/node'
import * as trpcExpress from '@trpc/server/adapters/express'
import type { Express, NextFunction, Request, Response } from 'express'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cors = require('cors')
// eslint-disable-next-line @typescript-eslint/no-require-imports
import express = require('express')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helmet = require('helmet')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const timeout = require('connect-timeout')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const responseTime = require('response-time')

import { yellow } from 'kleur/colors'
import { createOpenApiExpressMiddleware } from 'trpc-to-openapi'
import { createContext } from '../context/trpc.context'
import { initOpenApiDocs } from '../initOpenApiDocs'
import { genericErrorMiddleware } from '../middleware/error.middleware'
import { expressRequestLogger } from '../middleware/logs.middleware'
import { createMemoryMonitorMiddleware } from '../middleware/memoryMonitor.middleware'
import { productionErrorHandler } from '../middleware/productionError.middleware'
import {
  additionalSecurityHeaders,
  createRateLimiter,
  getCorsOptions,
  getHelmetOptions
} from '../middleware/security.middleware'
import { trpcErrorMiddleware } from '../middleware/trpcError.middleware'
import type { ExpressTrpcAppConfigInput } from './ExpressTrpcAppConfig'
import { getDefaultConfig } from './ExpressTrpcAppConfig'

// Helper to detect if running on Cloud Run
function isCloudRun(): boolean {
  return !!process.env.K_SERVICE
}

export function getExpressTrpcApp(config: ExpressTrpcAppConfigInput): {
  app: Express
  server?: Server
  memoryMonitor?: any
  waitForShutdown: () => Promise<void>
} {
  // Apply defaults
  const fullConfig = getDefaultConfig(config)
  const {
    appName,
    appVersion,
    port,
    baseUrl,
    environment,
    trpcRouter,
    sentryService,
    logger = console,
    expressResources,
    customHandlers,
    features,
    security,
    bodyParsing,
    performance,
    server: serverConfig,
    healthCheck,
    readyCheck,
    processManagement
  } = fullConfig

  logger.log(`Starting ${appName}`)
  const app = express()

  // Performance: Enable compression with optimized settings
  if (performance?.compression?.enabled !== false) {
    app.use(
      compression({
        level: performance?.compression?.level || 6,
        threshold: performance?.compression?.threshold || 1024,
        chunkSize: performance?.compression?.chunkSize || 16 * 1024,
        memLevel: performance?.compression?.memLevel || 8,

        // Custom filter to handle various edge cases
        filter: (req: Request, res: Response) => {
          // Skip compression for already compressed content types
          const contentType = res.getHeader('Content-Type') as string
          const compressedTypes = [
            'image/',
            'audio/',
            'video/',
            'font/',
            'application/pdf',
            'application/zip',
            'application/gzip',
            'application/x-gzip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/vnd.ms-fontobject',
            'application/font-woff',
            'application/font-woff2',
            'application/x-font-ttf',
            'application/x-font-truetype',
            'application/x-font-opentype'
          ]

          if (
            contentType &&
            compressedTypes.some(type => contentType.includes(type))
          ) {
            return false
          }

          // Skip compression for Server-Sent Events
          if (contentType?.includes('text/event-stream')) {
            return false
          }

          // Skip compression for WebSocket upgrade requests
          if (req.headers.upgrade === 'websocket') {
            return false
          }

          // Skip compression if Cache-Control contains no-transform directive
          const cacheControl =
            req.headers['cache-control'] ||
            (res.getHeader('Cache-Control') as string)
          if (cacheControl?.includes('no-transform')) {
            return false
          }

          // Skip compression for HEAD requests
          if (req.method === 'HEAD') {
            return false
          }

          // Skip compression if response already has Content-Encoding header
          const encoding = res.getHeader('Content-Encoding')
          if (encoding && encoding !== 'identity') {
            return false
          }

          // Use the default compression filter for all other cases
          return compression.filter(req, res)
        }
      })
    )
  }

  // Performance: Add response time header
  app.use(responseTime())

  // Performance: Add memory monitoring middleware
  let memoryMonitor: any
  if (performance?.memoryMonitoring?.enabled !== false) {
    const { middleware: memoryMiddleware, monitor } =
      createMemoryMonitorMiddleware({
        logger,
        warningThreshold: performance?.memoryMonitoring?.warningThreshold || 90,
        criticalThreshold:
          performance?.memoryMonitoring?.criticalThreshold || 95,
        monitorInterval:
          performance?.memoryMonitoring?.monitorInterval || 30000,
        enableGarbageCollection:
          performance?.memoryMonitoring?.enableGarbageCollection || false,
        addHeaders:
          performance?.memoryMonitoring?.addHeaders ?? environment !== 'prod'
      })
    app.use(memoryMiddleware)
    memoryMonitor = monitor
  }

  // Security: Configure CORS with proper settings
  const corsOptions = security?.cors
    ? {
        origin: security.cors.allowedOrigins || false,
        credentials: security.cors.credentials ?? true,
        maxAge: security.cors.maxAge || 86400
      }
    : getCorsOptions()
  app.use(cors(corsOptions))

  // Security: Configure Helmet with enhanced settings
  const helmetOptions = security?.helmet
    ? {
        contentSecurityPolicy:
          security.helmet.contentSecurityPolicy ?? environment === 'prod',
        crossOriginEmbedderPolicy:
          security.helmet.crossOriginEmbedderPolicy ??
          (environment !== 'local' && environment !== 'dev')
      }
    : getHelmetOptions()
  app.use(helmet(helmetOptions))

  // Security: Additional security headers
  app.use(additionalSecurityHeaders())

  // Security: Add request timeout
  if (security?.requestTimeout) {
    app.use(timeout(security.requestTimeout))
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (!(req as any).timedout) {
        next()
      }
    })
  }

  // Security: Rate limiting - global
  if (security?.rateLimit?.global) {
    app.use(
      createRateLimiter({
        windowMs: security.rateLimit.global.windowMs,
        max: security.rateLimit.global.max
      })
    )
  }

  // Security: Stricter rate limiting for auth endpoints
  if (security?.rateLimit?.auth) {
    app.use((req, res, next) => {
      if (
        req.path.startsWith('/trpc/auth') ||
        req.path.startsWith('/api/auth')
      ) {
        createRateLimiter({
          windowMs: security.rateLimit.auth.windowMs || 15 * 60 * 1000,
          max: security.rateLimit.auth.max || 5,
          skipSuccessfulRequests: true,
          message: 'Too many authentication attempts, please try again later.'
        })(req, res, next)
      } else {
        next()
      }
    })
  }

  // Security: API rate limiting
  if (security?.rateLimit?.api) {
    app.use(
      '/trpc/',
      createRateLimiter({
        windowMs: security.rateLimit.api.windowMs,
        max: security.rateLimit.api.max,
        message: 'API rate limit exceeded, please try again later.'
      })
    )
    app.use(
      '/api/',
      createRateLimiter({
        windowMs: security.rateLimit.api.windowMs,
        max: security.rateLimit.api.max,
        message: 'API rate limit exceeded, please try again later.'
      })
    )
  }

  // Enable ETags for better caching
  if (features?.etag !== false) {
    app.set('etag', features?.etag || 'strong')
  }

  // Enable trust proxy
  if (features?.trustProxy !== false) {
    app.set('trust proxy', true)
  }

  if (features?.sentry && sentryService) {
    Sentry.setupExpressErrorHandler(app)
  }

  // Configure body parsing with security limits
  app.use(
    express.json({
      limit: bodyParsing?.json?.limit || '100kb',
      type: bodyParsing?.json?.type || ['application/json', 'text/plain'],
      verify: (req: Request, _res: Response, buf: Buffer) => {
        // Store raw body for webhook signature verification if needed
        ;(req as any).rawBody = buf.toString('utf8')
      }
    })
  )

  app.use(
    express.urlencoded({
      limit: bodyParsing?.urlencoded?.limit || '100kb',
      extended: bodyParsing?.urlencoded?.extended ?? true
    })
  )

  app.use(
    express.raw({
      inflate: bodyParsing?.raw?.inflate ?? true,
      limit: bodyParsing?.raw?.limit || '100kb'
    })
  )

  // Add cache headers for static content
  if (performance?.caching?.staticAssets?.maxAge) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)
      ) {
        res.setHeader(
          'Cache-Control',
          `public, max-age=${performance.caching.staticAssets.maxAge}, immutable`
        )
      }
      next()
    })
  }

  app.use((req, _res, next) => expressRequestLogger(req, _res, next, logger))

  app.use(
    genericErrorMiddleware({
      sentryService: features?.sentry ? sentryService : undefined
    })
  )

  // Add production error handler for sanitized error responses
  if (environment === 'prod') {
    app.use(productionErrorHandler())
  }

  customHandlers?.forEach(customHandler => {
    app.use(customHandler)
  })

  // TRPC endpoint
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware<typeof trpcRouter>({
      router: trpcRouter,
      createContext,
      onError: e => trpcErrorMiddleware({ sentryService, ...e })
    })
  )

  expressResources?.forEach(expressResource => {
    app.use(expressResource)
  })

  if (features?.openApiDocs) {
    initOpenApiDocs({
      app,
      appName,
      appVersion,
      trpcRouter,
      baseUrl: baseUrl || `http://localhost:${port}`
    })

    // Apply the OpenAPI Express middleware only when OpenAPI docs are enabled
    app.use(
      '/',
      createOpenApiExpressMiddleware({
        router: trpcRouter,
        createContext,
        onError: trpcErrorMiddleware
      })
    )
  }

  app.use(async (req, _res, next) => {
    req.context = await createContext({
      req
    } as trpcExpress.CreateExpressContextOptions)
    next()
  })

  // Configure view engine
  if (serverConfig?.viewEngine) {
    app.set('view engine', serverConfig.viewEngine)
  }
  if (serverConfig?.viewPaths && serverConfig.viewPaths.length > 0) {
    app.set('views', serverConfig.viewPaths)
  }

  // Health check endpoints
  app.get(
    healthCheck?.path || '/health',
    async (_req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage()
      const lastMetrics = memoryMonitor?.getLastMetrics()

      const baseHealth = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: appName,
        version: appVersion,
        uptime: process.uptime(),
        memory: {
          used: Units.humanByteSize(memoryUsage.heapUsed),
          total: Units.humanByteSize(memoryUsage.heapTotal),
          percentage: lastMetrics
            ? `${lastMetrics.heapUsedPercentage.toFixed(1)}%`
            : 'N/A',
          rss: Units.humanByteSize(memoryUsage.rss),
          external: Units.humanByteSize(memoryUsage.external),
          monitoring: performance?.memoryMonitoring?.enabled
            ? {
                lastCheck: lastMetrics
                  ? new Date(lastMetrics.timestamp).toISOString()
                  : 'N/A',
                warningThreshold: `${performance.memoryMonitoring.warningThreshold}%`,
                criticalThreshold: `${performance.memoryMonitoring.criticalThreshold}%`
              }
            : undefined
        }
      }

      if (healthCheck?.customChecks) {
        try {
          const customResults = await healthCheck.customChecks()
          res.json({ ...baseHealth, custom: customResults })
        } catch (error) {
          res.status(503).json({
            ...baseHealth,
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } else {
        res.json(baseHealth)
      }
    }
  )

  // Readiness check endpoint
  app.get(
    readyCheck?.path || '/ready',
    async (_req: Request, res: Response) => {
      try {
        const baseChecks = {
          service: 'ready',
          timestamp: new Date().toISOString()
        }

        if (readyCheck?.customChecks) {
          const customResults = await readyCheck.customChecks()
          res.json({ ...baseChecks, ...customResults })
        } else {
          res.json(baseChecks)
        }
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  /**
   * Start the app with graceful shutdown support
   */
  let server: Server | undefined

  // Don't start server in test environment
  if (environment !== 'test') {
    if (isCloudRun()) {
      server = app.listen(port, '0.0.0.0')
    } else {
      server = app.listen(port, '::')
    }
  }

  // Graceful shutdown handler
  const gracefulShutdown = async () => {
    logger.log('SIGTERM signal received: closing HTTP server')

    // Stop memory monitoring
    memoryMonitor?.stopMonitoring()

    // Call custom shutdown handler if provided
    if (processManagement?.gracefulShutdown?.onShutdown) {
      await processManagement.gracefulShutdown.onShutdown()
    }

    if (server) {
      server.close(() => {
        logger.log('HTTP server closed')
        process.exit(0)
      })

      // Force shutdown after timeout
      const shutdownTimeout =
        processManagement?.gracefulShutdown?.timeout || 30000
      setTimeout(() => {
        logger.error(
          'Could not close connections in time, forcefully shutting down'
        )
        process.exit(1)
      }, shutdownTimeout)
    }
  }

  // Only add process listeners if enabled and server was started (not in test env)
  if (processManagement?.gracefulShutdown?.enabled !== false && server) {
    // Listen for termination signals
    process.once('SIGTERM', gracefulShutdown)
    process.once('SIGINT', gracefulShutdown)

    // Handle uncaught errors
    if (processManagement?.uncaughtException?.handler) {
      process.once(
        'uncaughtException',
        processManagement.uncaughtException.handler
      )
    } else {
      process.once('uncaughtException', error => {
        logger.error('Uncaught Exception:', error)
        if (features?.sentry && sentryService) {
          Sentry.captureException(error)
        }
        gracefulShutdown()
      })
    }

    if (processManagement?.unhandledRejection?.handler) {
      process.on(
        'unhandledRejection',
        processManagement.unhandledRejection.handler
      )
    } else {
      process.on('unhandledRejection', (reason, _promise) => {
        logger.error('Unhandled Rejection at:', _promise, 'reason:', reason)
        if (features?.sentry && sentryService) {
          Sentry.captureException(reason)
        }
      })
    }
  }

  const address = `http://localhost:${port}`
  const used = Units.humanByteSize(process.memoryUsage().heapUsed)

  console.log(
    `App Local Url: 
    ${yellow(address)} 
    in ${Time.ms(process.uptime() * 1000)}, used ${used}`
  )

  // Create a function to wait for server shutdown
  const waitForShutdown = (): Promise<void> => {
    if (!server) {
      // If no server (test environment), resolve immediately
      return Promise.resolve()
    }

    return new Promise<void>(resolve => {
      server.once('close', () => {
        logger.log('Server closed')
        resolve()
      })
    })
  }

  return { app, server, memoryMonitor, waitForShutdown }
}
