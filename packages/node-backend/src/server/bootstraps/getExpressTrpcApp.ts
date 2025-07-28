import { join } from 'path'
import type { BuiltRouter } from '@trpc/server/unstable-core-do-not-import'
import type { Express, RequestHandler, Router } from 'express'
import { CommonLogger, Time, Units } from '@goatlab/js-utils'
import * as Sentry from '@sentry/node'
import * as trpcExpress from '@trpc/server/adapters/express'
import cors from 'cors'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import express = require('express')
import helmet from 'helmet'
import { yellow } from 'kleur/colors'
import { createOpenApiExpressMiddleware } from 'trpc-to-openapi'
import { pkg } from '../consts'
import { createContext } from '../context/trpc.context'
import { initOpenApiDocs } from '../initOpenApiDocs'
import { genericErrorMiddleware } from '../middleware/error.middleware'
import { expressRequestLogger } from '../middleware/logs.middleware'
import { trpcErrorMiddleware } from '../middleware/trpcError.middleware'
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
}): Express {
  logger.log(`Starting ${pkg.name}`)
  const app = express()
  app.use(cors())
  app.use(helmet())

  app.disable('etag')
  app.set('trust proxy', true)

  if (shouldEnableSentry) {
    Sentry.setupExpressErrorHandler(app)
  }

  app.use(
    express.json({ limit: '1mb', type: ['application/json', 'text/plain'] })
  )
  app.use(express.urlencoded({ limit: '1mb', extended: true }))

  app.use(
    express.raw({
      inflate: true,
      limit: '100kb'
    })
  )

  app.use((req, resp, next) => expressRequestLogger(req, resp, next, logger))

  app.use(
    genericErrorMiddleware({
      sentryService: shouldEnableSentry ? sentryService : undefined
    })
  )

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
  }

  // Apply the OpenAPI Express middleware
  app.use(
    '/',
    createOpenApiExpressMiddleware({
      router: trpcRouter,
      createContext,
      onError: trpcErrorMiddleware
    })
  )

  app.use(async (req, res, next) => {
    req.context = await createContext({
      req
    } as trpcExpress.CreateExpressContextOptions)
    next()
  })

  app.set('view engine', 'ejs')
  app.set('views', [join(__dirname, './api/posts/views')])

  /**
   * Start the app
   */
  if (process.env.K_SERVICE) {
    app.listen(port, '0.0.0.0')
  } else {
    app.listen(port, '::')
  }

  const address = `http://localhost:${port}`

  const used = Units.humanByteSize(process.memoryUsage().heapUsed)

  console.log(
    `App Local Url: 
    ${yellow(address)} 
    in ${Time.ms(process.uptime() * 1000)}, used ${used}`
  )

  return app
}
