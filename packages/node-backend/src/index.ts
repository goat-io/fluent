import { Cache } from './Cache'
import type { Options } from 'keyv'

export { Cache }
export type { Options }

// New backend package
export { getExpressTrpcApp } from './server/bootstraps/getExpressTrpcApp'
export type { ExpressTrpcAppConfig } from './server/bootstraps/ExpressTrpcAppConfig'
export { getDefaultConfig } from './server/bootstraps/ExpressTrpcAppConfig'
export { SentryService } from './server/sentry/sentry.service'
export { getSentry } from './server/sentry/getSentry'
export { getLogger } from './server/middleware/logger/logger.service'
export { handleRequest } from './server/middleware/handleRequest.middleware'
export { useCloudTaskDecryptMiddleware } from './server/middleware/cloudTaskDecrypt.middleware'
export { getTrpc } from './server/trpc'
export { requestContext } from './server/context/request.context'

export { mockedAuthenticatedTrpcRouter } from './server/test/trpc.mock'
export type * from '@trpc/server/unstable-core-do-not-import'
export type * from '@trpc/server'
export type { LocationOutput } from './server/context/context.model'

export type { PackageInfo } from './server/consts'
export { config } from './server/consts'
export { EmailService } from './server/services/email/email.service'
export {
  Layout,
  Content,
  EmailCategory
} from './server/services/email/email.model'
export type {
  EmailTemplates,
  Theme,
  EmailAttachment
} from './server/services/email/email.model'
export { SendgridService } from './server/services/sendgrid/sendgridApi.service'
export { getGcpServiceAccountFromBase64 } from './server/services/gcp/getGcpServiceAccountFromBase64'

export type {
  SecretProvider,
  VaultConfig
} from './server/services/secrets/secret.service'
export { SecretService } from './server/services/secrets/secret.service'
export { UrlService } from './server/services/util/url.service'
export { paginationUtility } from './server/services/util/pagination'
export type { SendGridEmailResponse } from './server/services/sendgrid/sendgrid.model'
export { TRPCError } from '@trpc/server'
export {
  translationService,
  tr
} from './server/services/translations/translation.service'

export type { Environment } from './server/types/Envinronment'

////////////////////////
// Container System
////////////////////////
export { Container } from './container/Container'
export type {
  Factory,
  ContainerOptions,
  PreloadStructure,
  ContainerFactories,
  ContainerMetadata,
  ContainerContext,
  MapInterface,
  ContainerBootstrapResult,
  BatchBootstrapOptions,
  BatchBootstrapResult,
  BatchInvalidationResult
} from './container/types'

export { createServiceCache } from './container/LruCache'
export {
  DistributedCacheInvalidator,
  getDistributedCacheInvalidator
} from './container/DistributedCacheInvalidator'

////////////////////////
// Zod Compatibility
////////////////////////
export * as zodCompat from './server/zod-compat'
