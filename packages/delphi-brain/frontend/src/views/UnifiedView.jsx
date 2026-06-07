/**
 * UnifiedView — single shell for every lens × mode combination.
 *
 * URL is the source of state:
 *   ?lens=<id>           # all | systems | communications | data | …
 *   &mode=<id>           # table | graph | dashboard
 *   &entity=<name>       # opens DetailDrawer (handled at the App level)
 *
 * Frontend fetches the exact pre-built payload for (lens, mode) and hands it
 * to the matching mode component. No filtering, layout, or aggregation here.
 */
import { useQuery } from '@tanstack/react-query'
import { useQueryState, parseAsString } from 'nuqs'
import { fetchScopeTable, fetchScopeGraph, fetchScopeDashboard } from '../api'
import TableMode from './modes/TableMode.jsx'
import DashboardMode from './modes/DashboardMode.jsx'
import GraphMode from './modes/GraphMode.jsx'

// Each entry maps a mode ID to (fetcher, renderer). Adding a new mode = one
// row here + one component file. URL-driven, no central switch elsewhere.
const MODES = {
  table:     { fetch: fetchScopeTable,     Component: TableMode },
  graph:     { fetch: fetchScopeGraph,     Component: GraphMode },
  dashboard: { fetch: fetchScopeDashboard, Component: DashboardMode },
}

export default function UnifiedView({ lens, mode = 'table', filters = {}, onSelect }) {
  const [, setEntity] = useQueryState('entity', parseAsString)
  const cfg = MODES[mode] || MODES.table

  const { data, isLoading, error } = useQuery({
    // Filters become part of the cache key so changing a dropdown refetches.
    queryKey: ['scope', lens, mode, filters],
    queryFn: () => cfg.fetch(lens, filters),
    enabled: !!lens,
    staleTime: 60_000,
  })

  const handleSelect = (row) => {
    if (onSelect) { onSelect(row); return }
    setEntity(row.id || row.name)
  }

  if (isLoading) {
    return <Centered>Loading {lens}…</Centered>
  }
  if (error) {
    return <Centered>Failed to load: {String(error.message || error)}</Centered>
  }
  if (!data) {
    return <Centered>No data for lens “{lens}”.</Centered>
  }

  const Comp = cfg.Component
  return <Comp payload={data} onSelect={handleSelect} />
}

function Centered({ children }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 13,
    }}>{children}</div>
  )
}
