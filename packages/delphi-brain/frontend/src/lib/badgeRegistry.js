/**
 * Single source of truth for badge styling across every view.
 *
 * Adding a new `kind`, `domain`, `layer`, or `lifecycle` value to the catalog?
 * Add the row here. Every view (Catalog, EntityDrawer, DetailDrawer,
 * LayeredDiagram, future views) picks up the styling automatically.
 *
 * Why a static registry, not an API call:
 *   - The schema is small (≤30 rows per category) and stable per release.
 *   - Bundling it ships zero network roundtrips on first paint.
 *   - When the catalog adds a new kind on disk, the next deploy carries the
 *     matching badge row. Until then the gray fallback applies.
 *
 * Long-term option (deferred): Brain serves `/api/catalog/schema` returning
 * this exact shape; this file becomes the bundled fallback.
 */

// ── Kinds (from engineering/catalog/SCHEMA.md) ──────────────────
//   The full set is 19 today; expanding to ~24 per PROPOSAL_GENERIC_TREE.md §4.2.
export const KIND_CONFIG = {
  // Architectural — render in arch diagrams
  repo:           { color: '#3B82F6', label: 'repo',          icon: '📦' },
  service:        { color: '#8B5CF6', label: 'service',       icon: '⚙️' },
  infra:          { color: '#6B7280', label: 'infra',         icon: '☁️' },
  external:       { color: '#F5913E', label: 'external',      icon: '🔗' },
  product:        { color: '#0EA5E9', label: 'product',       icon: '📱' },
  system:         { color: '#10B981', label: 'system',        icon: '🧩' },
  // Organisational / measurement
  team:           { color: '#EC4899', label: 'team',          icon: '👥' },
  slo:            { color: '#16A34A', label: 'SLO',           icon: '🎯' },
  sla:            { color: '#84CC16', label: 'SLA',           icon: '📜' },
  oncall:         { color: '#DC2626', label: 'on-call',       icon: '📟' },
  runbook:        { color: '#A855F7', label: 'runbook',       icon: '📖' },
  // Data
  dataAsset:      { color: '#0891B2', label: 'data asset',    icon: '🗄️' },
  classification: { color: '#7C3AED', label: 'classification', icon: '🔒' },
  dataPipeline:   { color: '#0EA5E9', label: 'pipeline',      icon: '🔄' },
  // Strategy / outcome
  capability:     { color: '#F59E0B', label: 'capability',    icon: '⭐' },
  valueStream:    { color: '#FBBF24', label: 'value stream',  icon: '🌊' },
  kpi:            { color: '#22C55E', label: 'KPI',           icon: '📊' },
  objective:      { color: '#EAB308', label: 'objective',     icon: '🎖️' },
  keyResult:      { color: '#84CC16', label: 'key result',    icon: '✅' },
}

// ── Domains — company-specific colour map ───────────────────────
//   The set of domains is per-company. To keep this file generic, the
//   company-specific map is loaded from `_instance/lib/domains.js` —
//   the single taxonomy seam. Future companies replace that file.
export { DOMAIN_CONFIG } from '../_instance/lib/domains.js'
import { DOMAIN_CONFIG } from '../_instance/lib/domains.js'

// ── Lifecycle / status — from frontmatter or catalog `lifecycle` ──
export const STATUS_CONFIG = {
  production: { color: 'var(--status-success)', label: 'Production' },
  prototype:  { color: 'var(--status-info)',    label: 'Prototype'  },
  sunset:     { color: 'var(--status-warning)', label: 'Sunset'     },
  dead:       { color: 'var(--status-danger)',  label: 'Dead'       },
  active:     { color: 'var(--status-success)', label: 'Active'     },
  draft:      { color: 'var(--status-info)',    label: 'Draft'      },
  archived:   { color: 'var(--status-neutral)', label: 'Archived'   },
  unknown:    { color: 'var(--status-neutral)', label: 'Unknown'    },
}

// ── Layers (from SCHEMA.md `layer` enum) ──────────────────────────
export const LAYER_CONFIG = {
  device:         { color: '#007A6E', label: 'Device' },
  edge:           { color: '#0EA5E9', label: 'Edge' },
  domain:         { color: '#3B82F6', label: 'Domain' },
  platform:       { color: '#8B5CF6', label: 'Platform' },
  data:           { color: '#336791', label: 'Data' },
  'cross-cutting':{ color: '#6B7280', label: 'Cross-cutting' },
  'r-and-d':      { color: '#EC4899', label: 'R&D' },
  business:       { color: '#EAB308', label: 'Business' },
}

// ── Fallback (always grey, used when value not in registry) ──────
export const FALLBACK = { color: '#94A3B8', label: '—', icon: '' }

export function kindOf(value)   { return KIND_CONFIG[value]   ?? { ...FALLBACK, label: value || '—' } }
export function domainOf(value) { return DOMAIN_CONFIG[value] ?? FALLBACK }
export function statusOf(value) { return STATUS_CONFIG[String(value || '').toLowerCase()] ?? STATUS_CONFIG.unknown }
export function layerOf(value)  { return LAYER_CONFIG[value]  ?? { ...FALLBACK, label: value || '—' } }
