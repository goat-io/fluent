import type { Options } from 'keyv'
import { Cache, type CacheOptions } from './Cache'
import { LazyRedisStore } from './cache/LazyRedisStore'
import { RedisConnectionPool } from './cache/RedisConnectionPool'

export { Cache, LazyRedisStore, RedisConnectionPool }
export type { CacheOptions, Options }

export type * from '@trpc/server'
export { TRPCError } from '@trpc/server'
export type * from '@trpc/server/unstable-core-do-not-import'
////////////////////////
// Container System
////////////////////////
export { Container } from './container/Container'
export {
  DistributedCacheInvalidator,
  getDistributedCacheInvalidator,
} from './container/DistributedCacheInvalidator'
export { createServiceCache } from './container/LruCache'
export type {
  BatchBootstrapOptions,
  BatchBootstrapResult,
  BatchInvalidationResult,
  ContainerBootstrapResult,
  ContainerContext,
  ContainerFactories,
  ContainerMetadata,
  ContainerOptions,
  Factory,
  MapInterface,
  PreloadStructure,
} from './container/types'
export type { ExpressTrpcAppConfig } from './server/bootstraps/ExpressTrpcAppConfig'
export { getDefaultConfig } from './server/bootstraps/ExpressTrpcAppConfig'
// New backend package
export { getExpressTrpcApp } from './server/bootstraps/getExpressTrpcApp'
export type { PackageInfo } from './server/consts'
export { config } from './server/consts'
export type { LocationOutput } from './server/context/context.model'
export { requestContext } from './server/context/request.context'
export { useCloudTaskDecryptMiddleware } from './server/middleware/cloudTaskDecrypt.middleware'
export { handleRequest } from './server/middleware/handleRequest.middleware'
export { getLogger } from './server/middleware/logger/logger.service'
export { getSentry } from './server/sentry/getSentry'
export { SentryService } from './server/sentry/sentry.service'
export type {
  EmailAttachment,
  EmailTemplates,
  Theme,
} from './server/services/email/email.model'
export {
  Content,
  EmailCategory,
  Layout,
} from './server/services/email/email.model'
export { EmailService } from './server/services/email/email.service'
export { getGcpServiceAccountFromBase64 } from './server/services/gcp/getGcpServiceAccountFromBase64'
export type {
  SecretProvider,
  VaultConfig,
} from './server/services/secrets/secret.service'
export { SecretService } from './server/services/secrets/secret.service'
export type { SendGridEmailResponse } from './server/services/sendgrid/sendgrid.model'
export { SendgridService } from './server/services/sendgrid/sendgridApi.service'
export {
  tr,
  translationService,
} from './server/services/translations/translation.service'
export { paginationUtility } from './server/services/util/pagination'
export { UrlService } from './server/services/util/url.service'
export { mockedAuthenticatedTrpcRouter } from './server/test/trpc.mock'
export { getTrpc } from './server/trpc'
export type { Environment } from './server/types/Envinronment'

////////////////////////
// Zod Compatibility
////////////////////////
export * as zodCompat from './server/zod-compat'
