import type { AppError, ErrorData } from '@goatlab/js-utils'
import { Objects } from '@goatlab/js-utils'
// import { dedupeIntegration } from '@sentry/integrations'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { ZodError } from 'zod'
import { pkg } from '../consts'
import { SentryService } from './sentry.service'

// https://docs.sentry.io/platforms/node/usage/sdk-fingerprinting/
// https://docs.sentry.io/product/data-management-settings/event-grouping/fingerprint-rules/#variables
const DEFAULT = '{{ default }}'

export const getSentry = ({
  dns,
  appVersion,
  environment,
}: {
  dns?: string
  appVersion?: string
  environment: string
}) => {
  const sentryService = new SentryService({
    dsn: dns,
    release: appVersion || pkg.version,
    environment: environment,
    tracesSampleRate: 1,
    profilesSampleRate: 1,
    integrations: [nodeProfilingIntegration() as any],
    beforeSend(event, hint) {
      const error: any = hint?.originalException

      if (!error) {
        return event
      }

      if (
        error instanceof ZodError && // Group by Zod objectName
        error.name
      ) {
        event.fingerprint = [DEFAULT, 'ZodError', error.name]

        return event
      }

      const data = (error as AppError).data as ErrorData | undefined

      if (data?.fingerprint) {
        event.fingerprint = data.fingerprint
        return event
      }

      return event
    },
  })

  sentryService.sentry().setTags(
    Objects.deleteNulls({
      ver: pkg.version,
    }),
  )

  return sentryService
}
