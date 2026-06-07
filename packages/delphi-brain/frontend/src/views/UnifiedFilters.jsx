/**
 * UnifiedFilters — the row of dropdowns that narrow whatever lens is loaded.
 * Lives in the shell, NOT inside any single mode component, so the same
 * filters apply across table / graph / dashboard.
 *
 * URL is the source of state. Each dropdown writes one query param via nuqs;
 * UnifiedShell reads them and passes them to every scope endpoint.
 *
 * Facet metadata (key, label, placeholder, values) all comes from
 * /api/scope/:lens/facets — fully server-driven, no hardcoded company
 * vocabulary. When a lens has no values for a facet, that dropdown disappears.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchScopeFacets } from '../api'

export default function UnifiedFilters({ lens, values, onChange }) {
  const { data } = useQuery({
    queryKey: ['scope-facets', lens],
    queryFn: () => fetchScopeFacets(lens),
    staleTime: 60_000,
  })
  const facets = data?.facets ?? []

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '8px 16px', borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {facets.map(f => (
        <FacetSelect
          key={f.key} facet={f}
          value={values[f.key] || ''}
          onChange={(v) => onChange(f.key, v)}
        />
      ))}
      {hasAny(values) && (
        <button onClick={() => onChange('__clear__', null)}
          style={{
            padding: '4px 10px', fontSize: 11, border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--surface)', color: 'var(--text-muted)',
            cursor: 'pointer',
          }}>
          ✕ Clear filters
        </button>
      )}
    </div>
  )
}

function FacetSelect({ facet, value, onChange }) {
  // Backend supplies `placeholder` (e.g. "All Kinds"); frontend never invents one.
  const allLabel = facet.placeholder || `All ${facet.label || facet.key}`
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value || null)}
      style={{
        padding: '5px 10px', fontSize: 12, fontFamily: 'var(--font-sans)',
        border: '1px solid var(--border)', borderRadius: 9999,
        background: 'var(--surface)', color: 'var(--text)',
        cursor: 'pointer', maxWidth: 200,
      }}>
      <option value="">{allLabel}</option>
      {facet.values.map(v => (
        <option key={v.value} value={v.value}>
          {(v.label || v.value)} ({v.count})
        </option>
      ))}
    </select>
  )
}

function hasAny(values) {
  return Object.values(values || {}).some(v => v)
}
