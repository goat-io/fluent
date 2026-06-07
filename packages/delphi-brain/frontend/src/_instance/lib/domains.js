/**
 * Company-specific domain colour mapping for catalog badges.
 *
 * This is the company instance's taxonomy override. Every company adopting
 * Brain replaces this file (or returns an equivalent shape from the backend
 * `GET /api/catalog/facets/domains`).
 *
 * Brain's generic `badgeRegistry.js` imports `DOMAIN_CONFIG` from here.
 * If you fork Brain for another company, swap this file and leave the rest
 * untouched.
 *
 * Shipped here as a minimal GENERIC EXAMPLE — extend with your own domains.
 */
export const DOMAIN_CONFIG = {
  platform:       { color: '#3B82F6' },
  product:        { color: '#F5913E' },
  data:           { color: '#336791' },
  infrastructure: { color: '#6B7280' },
  docs:           { color: '#94A3B8' },
}
