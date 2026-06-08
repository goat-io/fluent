/**
 * Brain API client — fetches data from the Go Fiber backend.
 * Markdown is the source of truth. API reads .md + .json from disk on every request.
 */

const BASE = 'http://localhost:7613/api'

/**
 * Instance config — company identity served by the backend.
 * Returns { org, branding, chat } or null when unavailable.
 * Cached after the first successful fetch so callers can await it cheaply.
 */
let _configPromise = null
export async function fetchConfig() {
  if (!_configPromise) {
    _configPromise = fetch(`${BASE}/config`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
  }
  return _configPromise
}

export async function fetchStats() {
  const res = await fetch(`${BASE}/stats`)
  return res.json()
}

export async function fetchDomains() {
  const res = await fetch(`${BASE}/domains`)
  return res.json()
}

export async function fetchCatalog(domain) {
  const url = domain ? `${BASE}/catalog?domain=${domain}` : `${BASE}/catalog`
  const res = await fetch(url)
  return res.json()
}

export async function fetchCatalogEntry(domain, name) {
  const res = await fetch(`${BASE}/catalog/${domain}/${name}`)
  if (!res.ok) return null
  return res.json()
}

/**
 * Fetch every catalog-info.json spec across the entire catalog (repos, services,
 * infra, external, products) in a single request. Returns one flat array
 * with each entry's full `catalog-info.json` plus a `_domain` hint.
 *
 * This is what views should call when they want to assemble a graph from
 * the catalog without hardcoding any node or edge.
 */
export async function fetchAllSpecs() {
  const res = await fetch(`${BASE}/repos`)
  if (!res.ok) return []
  const rows = await res.json()
  return rows
    .filter(r => r?.spec?.name)
    .map(r => ({ ...r.spec, _domain: r.domain }))
}

export async function fetchDocument(path) {
  const res = await fetch(`${BASE}/documents/${encodeURIComponent(path)}`)
  if (!res.ok) return null
  return res.json()
}

export async function searchDocuments(query) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`)
  return res.json()
}

/**
 * Repos list — all 171 repos enriched with catalog README + catalog-info.json data.
 */
export async function fetchRepos(domain) {
  const url = domain ? `${BASE}/repos?domain=${domain}` : `${BASE}/repos`
  const res = await fetch(url)
  return res.json()
}

/**
 * Architecture data — single request returns all visualization data.
 * Replaces the hardcoded systems.js entirely.
 */
export async function fetchArchitecture() {
  const res = await fetch(`${BASE}/architecture`)
  return res.json()
}

/**
 * Single architecture section (services, connections, databases, etc.)
 */
export async function fetchArchitectureSection(section) {
  const res = await fetch(`${BASE}/architecture/${section}`)
  if (!res.ok) return null
  return res.json()
}

/**
 * Pre-computed dependency graph — nodes with positions, edges, zone backgrounds.
 * All layout computed server-side by Brain.
 */
export async function fetchGraph() {
  const res = await fetch(`${BASE}/architecture/graph`)
  return res.json()
}

/**
 * C4 Level 1 system-context view — systems aggregated from kind:system entries
 * (under engineering/catalog/systems/, with _systems/ as legacy fallback) +
 * their member catalog entries, with cross-system edges derived from
 * dependsOn relationships.
 */
export async function fetchSystems() {
  const res = await fetch(`${BASE}/architecture/systems`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Phase 6 — universal entity API (Brain stitcher).
// Returns one entity with both outbound + inbound edges typed by relation.
// Backs the EntityDrawer per PROPOSAL_GENERIC_TREE.md §8.4.
// ---------------------------------------------------------------------------

export async function fetchEntity(name) {
  const res = await fetch(`${BASE}/entity/${encodeURIComponent(name)}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchEntityContributors(name, { depth = 6 } = {}) {
  const res = await fetch(`${BASE}/entity/${encodeURIComponent(name)}/contributors?depth=${depth}`)
  if (!res.ok) return null
  return res.json()
}

export async function expandEntity(name, { direction = 'both', depth = 2 } = {}) {
  const res = await fetch(`${BASE}/entity/${encodeURIComponent(name)}/expand?direction=${direction}&depth=${depth}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchCatalogStats() {
  const res = await fetch(`${BASE}/catalog/stats`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Phase 5 — cost attribution.
// ---------------------------------------------------------------------------

export async function fetchCostByEntity(kind, name, { from, to } = {}) {
  const q = new URLSearchParams()
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  const res = await fetch(`${BASE}/cost/${kind}/${encodeURIComponent(name)}?${q}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchCostBySystem(system, { from, to } = {}) {
  const q = new URLSearchParams()
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  const res = await fetch(`${BASE}/cost/by-system/${encodeURIComponent(system)}?${q}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchCostByTeam(team, { from, to } = {}) {
  const q = new URLSearchParams()
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  const res = await fetch(`${BASE}/cost/by-team/${encodeURIComponent(team)}?${q}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchCostUnallocated({ from, to } = {}) {
  const q = new URLSearchParams()
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  const res = await fetch(`${BASE}/cost/unallocated?${q}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchCostSources() {
  const res = await fetch(`${BASE}/cost/sources`)
  if (!res.ok) return []
  return res.json()
}

// ---------------------------------------------------------------------------
// Phase 8 (proposal §8) — universal diagram payload.
// Each view = one fetch returning the same DiagramPayload shape.
// ---------------------------------------------------------------------------

export async function fetchDiagram(view) {
  const res = await fetch(`${BASE}/diagrams/${encodeURIComponent(view)}`)
  if (!res.ok) return null
  return res.json()
}

// ---------------------------------------------------------------------------
// Phase 9 — UnifiedView. One endpoint per (lens × mode); backend owns every
// computation, frontend is a dumb renderer.
// ---------------------------------------------------------------------------

export async function fetchLenses() {
  const res = await fetch(`${BASE}/scope/lenses`)
  if (!res.ok) return []
  return res.json()
}

// scopeQuery turns a {kind, layer, system, ...} object into a URLSearchParams
// string. Empty / null values are skipped so the URL stays clean.
function scopeQuery(filters) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(filters || {})) {
    if (v) q.set(k, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function fetchScopeFacets(lens) {
  const res = await fetch(`${BASE}/scope/${encodeURIComponent(lens)}/facets`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchScopeTable(lens, filters) {
  const res = await fetch(`${BASE}/scope/${encodeURIComponent(lens)}/table${scopeQuery(filters)}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchScopeGraph(lens, filters) {
  const res = await fetch(`${BASE}/scope/${encodeURIComponent(lens)}/graph${scopeQuery(filters)}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchScopeDashboard(lens, filters) {
  const res = await fetch(`${BASE}/scope/${encodeURIComponent(lens)}/dashboard${scopeQuery(filters)}`)
  if (!res.ok) return null
  return res.json()
}
