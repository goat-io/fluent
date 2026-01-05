/**
 * Tenant utility functions for multitenancy support
 */

/**
 * Validates and sanitizes a tenant ID for use in collection names
 * - Enforces allowed characters: a-zA-Z0-9_-
 * - Converts to lowercase to avoid case-sensitivity issues
 * - Enforces max length of 128 characters
 *
 * @param tenantId - Raw tenant ID to validate
 * @returns Sanitized tenant ID
 * @throws Error if tenant ID is invalid
 */
export function sanitizeTenantId(tenantId: string): string {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Tenant ID must be a non-empty string')
  }

  // Trim whitespace
  const trimmed = tenantId.trim()

  if (!trimmed) {
    throw new Error('Tenant ID cannot be empty or whitespace only')
  }

  // Check allowed characters
  const allowedPattern = /^[a-zA-Z0-9_-]+$/
  if (!allowedPattern.test(trimmed)) {
    throw new Error(
      'Tenant ID can only contain alphanumeric characters, underscores, and hyphens',
    )
  }

  // Check max length
  if (trimmed.length > 128) {
    throw new Error('Tenant ID cannot exceed 128 characters')
  }

  // Convert to lowercase
  return trimmed.toLowerCase()
}

/**
 * Creates a fully qualified collection name by prepending tenant ID
 * Format: <tenantId>__<baseCollectionName>
 *
 * @param tenantId - Sanitized tenant ID
 * @param baseCollectionName - Base collection name without tenant prefix
 * @returns Fully qualified collection name
 */
export function createFQCN(
  tenantId: string,
  baseCollectionName: string,
): string {
  return `${tenantId}__${baseCollectionName}`
}

/**
 * Extracts tenant ID and base collection name from a fully qualified collection name
 *
 * @param fqcn - Fully qualified collection name
 * @returns Object with tenantId and baseCollectionName, or null if not a tenant collection
 */
export function parseFQCN(
  fqcn: string,
): { tenantId: string; baseCollectionName: string } | null {
  const separatorIndex = fqcn.indexOf('__')

  if (separatorIndex === -1 || separatorIndex === 0) {
    return null
  }

  return {
    tenantId: fqcn.substring(0, separatorIndex),
    baseCollectionName: fqcn.substring(separatorIndex + 2),
  }
}

/**
 * Checks if a collection name is tenant-prefixed
 *
 * @param collectionName - Collection name to check
 * @returns True if the collection has a tenant prefix
 */
export function isTenantCollection(collectionName: string): boolean {
  return collectionName.includes('__') && !collectionName.startsWith('__')
}

/**
 * Filters collections by tenant ID
 *
 * @param collections - Array of collection names
 * @param tenantId - Tenant ID to filter by
 * @returns Collections belonging to the specified tenant
 */
export function filterCollectionsByTenant(
  collections: string[],
  tenantId: string,
): string[] {
  const prefix = `${tenantId}__`
  return collections.filter(name => name.startsWith(prefix))
}

/**
 * Creates a tenant-qualified resource name for aliases, synonyms, presets, etc.
 * This ensures tenant isolation for all Typesense resources, not just collections
 *
 * @param tenantId - Optional tenant ID (if not provided, returns the resource name as-is)
 * @param resourceName - Base resource name
 * @returns Tenant-qualified resource name or original name
 */
export function createTenantQualifiedName(
  tenantId: string | undefined,
  resourceName: string,
): string {
  return tenantId ? `${tenantId}__${resourceName}` : resourceName
}
