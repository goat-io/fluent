/**
 * Catalog taxonomy — small, principled classification helpers.
 *
 * Read EVERY value from the catalog's own fields (kind / category / service /
 * tags). Never regex on entity names. When the catalog gains a new database
 * service, it just needs the right `category: 'database'` (or `tags:
 * ['datastore']`) and these helpers find it — no JS edit.
 *
 * The "what counts as a datastore" set below is the only piece of taxonomy
 * vocabulary in the frontend. Move to `/api/catalog/facets/datastores` (Brain)
 * when we want this driven entirely from the backend.
 */

// kind:service `category` values that are persistent stores.
const DATASTORE_SERVICE_CATEGORIES = new Set([
  'database', 'cache', 'message-broker', 'search', 'cdc',
])

// kind:infra `service` values that are persistent stores.
const DATASTORE_INFRA_SERVICES = new Set([
  'rds', 'aurora', 'aurora-serverless', 'aurora-postgres',
  'dynamodb', 'elasticache', 's3', 'firestore',
  'sqs', 'sns', 'eventbridge', 'opensearch', 'redshift',
])

/** True when an entity is a persistent data store / stream / queue. */
export function isDataStore(entity) {
  if (!entity) return false
  // Explicit opt-in via tag wins.
  if ((entity.spec?.tags || []).includes('datastore')) return true
  if (entity.kind === 'dataAsset') return true
  if (entity.kind === 'service' && DATASTORE_SERVICE_CATEGORIES.has(entity.spec?.category)) return true
  if (entity.kind === 'infra'   && DATASTORE_INFRA_SERVICES.has(entity.spec?.service))   return true
  return false
}

/** Human-readable classification — the catalog's own field, not invented. */
export function classify(entity) {
  if (!entity) return ''
  if (entity.kind === 'service') return entity.spec?.category || 'service'
  if (entity.kind === 'infra')   return entity.spec?.service  || 'infra'
  if (entity.kind === 'dataAsset') {
    const cs = entity.spec?.classifiedAs?.[0]
    return cs?.target || 'data asset'
  }
  return entity.kind || ''
}

/** Vendor — read from spec.vendor (set on service / external entries). */
export function vendor(entity) {
  return entity?.spec?.vendor || ''
}
