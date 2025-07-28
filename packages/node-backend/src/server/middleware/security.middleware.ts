import type { CorsOptions } from 'cors'
import type { HelmetOptions } from 'helmet'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import rateLimit from 'express-rate-limit'

/**
 * Get CORS configuration based on environment
 */
export function getCorsOptions(): CorsOptions {
  const allowedOrigins =
    process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || []

  // In development, allow localhost origins
  if (process.env.NODE_ENV !== 'prod' && allowedOrigins.length === 0) {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173'
    )
  }

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin && process.env.NODE_ENV !== 'prod') {
        return callback(null, true)
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  }
}

/**
 * Get Helmet configuration for enhanced security headers
 */
export function getHelmetOptions(): HelmetOptions {
  const isDevelopment = process.env.NODE_ENV !== 'prod'

  return {
    contentSecurityPolicy: isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Consider removing unsafe-inline in production
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: []
          }
        },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
    hidePoweredBy: true,
    ieNoOpen: true,
    frameguard: { action: 'deny' }
  }
}

/**
 * Create rate limiter with default configuration
 */
export function createRateLimiter(
  options?: Partial<Parameters<typeof rateLimit>[0]>
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    // Skip rate limiting validation errors in test environment
    validate: process.env.NODE_ENV === 'test' ? false : undefined,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
          retryAfter: res.getHeader('Retry-After')
        }
      })
    },
    ...options
  })
}

/**
 * Create stricter rate limiter for authentication endpoints
 */
export function createAuthRateLimiter(): RateLimitRequestHandler {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    skipSuccessfulRequests: true, // Don't count successful requests
    message: 'Too many authentication attempts, please try again later.'
  })
}

/**
 * Create rate limiter for API endpoints
 */
export function createApiRateLimiter(): RateLimitRequestHandler {
  const maxRequests = process.env.API_RATE_LIMIT
    ? parseInt(process.env.API_RATE_LIMIT, 10)
    : 100

  return createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: maxRequests,
    message: 'API rate limit exceeded, please try again later.'
  })
}

/**
 * Additional security headers not covered by Helmet
 */
export function additionalSecurityHeaders() {
  return (req: any, res: any, next: any) => {
    // Permissions Policy (formerly Feature Policy)
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=()'
    )

    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')

    // Clear site data on logout (if logout endpoint)
    if (req.path === '/logout' || req.path === '/api/logout') {
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"')
    }

    next()
  }
}
