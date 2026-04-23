// Backwards-compatibility re-export.
// PgQueueDispatcher was renamed to PgConnector — import from './PgConnector.js' instead.

export type { PgConnectorConfig as PgQueueDispatcherConfig } from './PgConnector.js'
export { PgConnector as PgQueueDispatcher } from './PgConnector.js'
