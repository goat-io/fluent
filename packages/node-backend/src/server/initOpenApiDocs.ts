import type { BuiltRouter } from '@trpc/server/unstable-core-do-not-import'
import type express from 'express'
import { generateOpenApiDocument } from 'trpc-to-openapi'

const swaggerUi = require('swagger-ui-express')

export function initOpenApiDocs({
  app,
  appName,
  appVersion,
  trpcRouter,
  baseUrl,
}: {
  app: express.Application
  trpcRouter: BuiltRouter<any, any>
  appName: string
  appVersion: string
  baseUrl: string
}) {
  const openApiDocument = generateOpenApiDocument(trpcRouter, {
    title: appName,
    version: appVersion,
    baseUrl,
  })
  // Serve the OpenAPI document at /openapi
  app.use('/openapi', (req, res) => {
    res.json(openApiDocument)
  })

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))
}
