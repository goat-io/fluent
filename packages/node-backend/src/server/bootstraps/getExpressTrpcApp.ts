import { join } from 'path'
import type { BuiltRouter } from '@trpc/server/unstable-core-do-not-import'
import type { Express, RequestHandler, Router, Request, Response, NextFunction } from 'express'
import type { Server } from 'http'
import { CommonLogger, Time, Units } from '@goatlab/js-utils'
import * as Sentry from '@sentry/node'
import * as trpcExpress from '@trpc/server/adapters/express'
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
import { pkg } from '../consts'
import { createContext } from '../context/trpc.context'
import { initOpenApiDocs } from '../initOpenApiDocs'
import { genericErrorMiddleware } from '../middleware/error.middleware'
import { expressRequestLogger } from '../middleware/logs.middleware'
import { trpcErrorMiddleware } from '../middleware/trpcError.middleware'
import { productionErrorHandler } from '../middleware/productionError.middleware'
import { createMemoryMonitorMiddleware } from '../middleware/memoryMonitor.middleware'
import { 
  getCorsOptions, 
  getHelmetOptions, 
  createRateLimiter, 
  createAuthRateLimiter, 
  createApiRateLimiter,
  additionalSecurityHeaders 
} from '../middleware/security.middleware'
import { SentryService } from '../sentry/sentry.service'

// There is an issue returning the
// row count in Mysql (bigint) and parsing
// it back to JSON
/* eslint-disable */
// BigInt.prototype.toJSON = function () {
//   return this.toString()
// }
/* eslint-enable */

export function getExpressTrpcApp({
  trpcRouter,
  port,
  expressResources,
  shouldInitOpenApiDocs,
  baseUrl = `http://localhost:${port}`,
  shouldEnableSentry,
  sentryService,
  logger = console,
  customHandlers
}: {
  appName?: string
  appVersion?: string
  port: number
  baseUrl?: string
  trpcRouter: BuiltRouter<any, any>
  expressResources?: Router[] | readonly Router[]
  sentryService: SentryService
  shouldInitOpenApiDocs?: boolean
  shouldEnableSentry?: boolean
  logger?: CommonLogger
  customHandlers?: RequestHandler[]
}): { app: Express; server?: Server } {
  logger.log(`Starting ${pkg.name}`)
  const app = express()
  
  // Performance: Enable compression with optimized settings
  app.use(compression({
    // Compression level: 6 provides a good balance between speed and compression ratio
    level: 6,
    
    // Skip compression for small responses (< 1KB)
    threshold: 1024,
    
    // Optimize compression buffer sizes for better performance
    chunkSize: 16 * 1024, // 16KB chunks
    memLevel: 8, // Memory usage level (1-9)
    
    // Custom filter to handle various edge cases
    filter: (req: Request, res: Response) => {
      // Skip compression for already compressed content types
      const contentType = res.getHeader('Content-Type') as string
      const compressedTypes = [
        'image/', 'audio/', 'video/', 'font/',
        'application/pdf', 'application/zip',
        'application/gzip', 'application/x-gzip',
        'application/x-rar-compressed', 'application/x-7z-compressed',
        'application/vnd.ms-fontobject', 'application/font-woff',
        'application/font-woff2', 'application/x-font-ttf',
        'application/x-font-truetype', 'application/x-font-opentype'
      ]
      
      if (contentType && compressedTypes.some(type => contentType.includes(type))) {
        return false
      }
      
      // Skip compression for Server-Sent Events
      if (contentType && contentType.includes('text/event-stream')) {
        return false
      }
      
      // Skip compression for WebSocket upgrade requests
      if (req.headers.upgrade === 'websocket') {
        return false
      }
      
      // Skip compression if Cache-Control contains no-transform directive
      const cacheControl = req.headers['cache-control'] || res.getHeader('Cache-Control') as string
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
  }))
  
  // Performance: Add response time header
  app.use(responseTime())
  
  // Performance: Add memory monitoring middleware
  const { middleware: memoryMiddleware, monitor: memoryMonitor } = createMemoryMonitorMiddleware({
    logger,
    warningThreshold: 90,
    criticalThreshold: 95,
    monitorInterval: 30000, // Check every 30 seconds
    enableGarbageCollection: process.env.NODE_ENV === 'prod', // Only enable GC in production
    addHeaders: process.env.NODE_ENV !== 'prod' // Add headers in non-production environments
  })
  app.use(memoryMiddleware)
  
  // Security: Configure CORS with proper settings
  app.use(cors(getCorsOptions()))
  
  // Security: Configure Helmet with enhanced settings
  app.use(helmet(getHelmetOptions()))
  
  // Security: Additional security headers
  app.use(additionalSecurityHeaders())
  
  // Security: Add request timeout (30 seconds default)
  app.use(timeout(process.env.REQUEST_TIMEOUT || '30s'))
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!(req as any).timedout) next()
  })
  
  // Security: Rate limiting - global
  app.use(createRateLimiter())
  
  // Security: Stricter rate limiting for auth endpoints
  app.use((req, res, next) => {
    if (req.path.startsWith('/trpc/auth') || req.path.startsWith('/api/auth')) {
      createAuthRateLimiter()(req, res, next)
    } else {
      next()
    }
  })
  
  // Security: API rate limiting
  app.use('/trpc/', createApiRateLimiter())
  app.use('/api/', createApiRateLimiter())

  // Enable ETags for better caching
  app.set('etag', 'strong')
  app.set('trust proxy', true)

  if (shouldEnableSentry) {
    Sentry.setupExpressErrorHandler(app)
  }

  // Configure body parsing with security limits
  const jsonLimit = process.env.JSON_BODY_LIMIT || '100kb'
  const urlEncodedLimit = process.env.URL_ENCODED_LIMIT || '100kb'
  const rawLimit = process.env.RAW_BODY_LIMIT || '100kb'
  
  app.use(
    express.json({ 
      limit: jsonLimit, 
      type: ['application/json', 'text/plain'],
      verify: (req: Request, res: Response, buf: Buffer) => {
        // Store raw body for webhook signature verification if needed
        (req as any).rawBody = buf.toString('utf8')
      }
    })
  )
  app.use(express.urlencoded({ limit: urlEncodedLimit, extended: true }))

  app.use(
    express.raw({
      inflate: true,
      limit: rawLimit
    })
  )
  
  // Add cache headers for static content
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
    next()
  })

  app.use((req, resp, next) => expressRequestLogger(req, resp, next, logger))

  app.use(
    genericErrorMiddleware({
      sentryService: shouldEnableSentry ? sentryService : undefined
    })
  )
  
  // Add production error handler for sanitized error responses
  if (process.env.NODE_ENV === 'prod') {
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

  if (shouldInitOpenApiDocs) {
    initOpenApiDocs({
      app,
      appName: 'somename',
      appVersion: 'someversion',
      trpcRouter,
      baseUrl
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

  app.use(async (req, res, next) => {
    req.context = await createContext({
      req
    } as trpcExpress.CreateExpressContextOptions)
    next()
  })

  app.set('view engine', 'ejs')
  app.set('views', [join(__dirname, './api/posts/views')])
  
  // Health check endpoints
  app.get('/health', (req: Request, res: Response) => {
    const memoryUsage = process.memoryUsage()
    const lastMetrics = memoryMonitor.getLastMetrics()
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: pkg.name,
      version: pkg.version,
      uptime: process.uptime(),
      memory: {
        used: Units.humanByteSize(memoryUsage.heapUsed),
        total: Units.humanByteSize(memoryUsage.heapTotal),
        percentage: lastMetrics ? lastMetrics.heapUsedPercentage.toFixed(1) + '%' : 'N/A',
        rss: Units.humanByteSize(memoryUsage.rss),
        external: Units.humanByteSize(memoryUsage.external),
        monitoring: {
          lastCheck: lastMetrics ? new Date(lastMetrics.timestamp).toISOString() : 'N/A',
          warningThreshold: '90%',
          criticalThreshold: '95%'
        }
      }
    })
  })
  
  // Readiness check endpoint
  app.get('/ready', async (req: Request, res: Response) => {
    try {
      // Add your readiness checks here
      // For example: check database connection, external services, etc.
      const checks = {
        service: 'ready',
        timestamp: new Date().toISOString()
      }
      
      res.json(checks)
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * Start the app with graceful shutdown support
   */
  let server: Server | undefined
  
  // Don't start server in test environment
  if (process.env.NODE_ENV !== 'test') {
    if (process.env.K_SERVICE) {
      server = app.listen(port, '0.0.0.0')
    } else {
      server = app.listen(port, '::')
    }
  }
  
  // Graceful shutdown handler
  const gracefulShutdown = () => {
    logger.log('SIGTERM signal received: closing HTTP server')
    
    // Stop memory monitoring
    memoryMonitor.stopMonitoring()
    
    if (server) {
      server.close(() => {
        logger.log('HTTP server closed')
        
        // Perform cleanup tasks here
        // Close database connections, message queues, etc.
        
        process.exit(0)
      })
      
      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down')
        process.exit(1)
      }, 30000)
    }
  }
  
  // Only add process listeners if server was started (not in test env)
  if (server) {
    // Listen for termination signals
    process.once('SIGTERM', gracefulShutdown)
    process.once('SIGINT', gracefulShutdown)
    
    // Handle uncaught errors
    process.once('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error)
      if (shouldEnableSentry && sentryService) {
        Sentry.captureException(error)
      }
      gracefulShutdown()
    })
    
    process.on('unhandledRejection', (reason, _promise) => {
      logger.error('Unhandled Rejection at:', _promise, 'reason:', reason)
      if (shouldEnableSentry && sentryService) {
        Sentry.captureException(reason)
      }
    })
  }

  const address = `http://localhost:${port}`

  const used = Units.humanByteSize(process.memoryUsage().heapUsed)

  console.log(
    `App Local Url: 
    ${yellow(address)} 
    in ${Time.ms(process.uptime() * 1000)}, used ${used}`
  )

  return { app, server }
}
