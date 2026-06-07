/**
 * Graph adapter — single source of truth for every catalog query in the app.
 *
 * The catalog is a typed graph (PROPOSAL_GENERIC_TREE.md §4.5):
 *   - parents can have the same children (cp-aurora-backend depends on
 *     mongodb-icc; so does cp-aurora-pugio)
 *   - up/down/sideways are queries against the same indexed structure
 *   - cycles are possible (Eliza A150 ↔ ICO via FOTA + heartbeat)
 *
 * Every view should consume this — no view-specific fetches, no duplicate
 * adjacency-building. Backend serves the full graph in one call; we cache
 * locally via React Query, build indexes once, and project per-view slices
 * via the primitives below.
 *
 * Primitives:
 *   useGraph()                           — hook with everything below
 *   .entity(name)                        — one entity by name
 *   .neighbours(name, opts)              — one-hop traversal, filtered
 *   .expand(name, opts)                  — multi-hop with cycle guard + edge predicate
 *   .nodesWhere(predicate)               — filter the full set
 *   .systems()                           — all kind:system entries (convenience)
 *   .members(systemId)                   — entries whose `system` field === systemId
 *   .crossSystemEdges()                  — derived for C4 L1
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

const BASE = 'http://localhost:7613/api'

async function fetchGraph() {
  const res = await fetch(`${BASE}/catalog/graph`)
  if (!res.ok) throw new Error(`/api/catalog/graph failed ${res.status}`)
  return res.json()
}

export function useGraph() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['catalog-graph'],
    queryFn: fetchGraph,
    staleTime: 5 * 60 * 1000,
  })

  const indexes = useMemo(() => {
    if (!data?.entities) return null
    const all = data.entities
    const byName = new Map()
    const byKind = new Map()
    const bySystem = new Map()
    const byLayer = new Map()
    const byDomain = new Map()
    for (const e of all) {
      byName.set(e.name, e)
      pushTo(byKind, e.kind, e)
      if (e.system) pushTo(bySystem, e.system, e)
      if (e.layer)  pushTo(byLayer, e.layer, e)
      if (e.domain) pushTo(byDomain, e.domain, e)
    }
    return { all, byName, byKind, bySystem, byLayer, byDomain }
  }, [data])

  const empty = !indexes
  const entity   = name        => empty ? null : indexes.byName.get(name) || null
  const all      = ()          => empty ? []   : indexes.all
  const byKind   = kind        => empty ? []   : (indexes.byKind.get(kind)   || [])
  const bySystem = systemId    => empty ? []   : (indexes.bySystem.get(systemId) || [])
  const byLayer  = layer       => empty ? []   : (indexes.byLayer.get(layer)  || [])

  /** Filter the full set with a flexible predicate or option bag.
   *  nodesWhere({ kind, system, layer, domain, predicate })
   *  Each filter is AND-combined; omitting one skips it.
   */
  const nodesWhere = (opts = {}) => {
    if (empty) return []
    let pool = indexes.all
    if (opts.kind)   pool = pool.filter(e => e.kind   === opts.kind)
    if (opts.system) pool = pool.filter(e => e.system === opts.system)
    if (opts.layer)  pool = pool.filter(e => e.layer  === opts.layer)
    if (opts.domain) pool = pool.filter(e => e.domain === opts.domain)
    if (opts.predicate) pool = pool.filter(opts.predicate)
    return pool
  }

  /** One-hop neighbours of `name`, filtered.
   *
   *  neighbours(name, {
   *    direction: 'down' | 'up' | 'both',   // default 'both'
   *    relation: string | string[],          // optional — only edges of this relation
   *    kind: string,                         // optional — only neighbours of this kind
   *    edgePredicate: (edge) => boolean,     // optional
   *  })
   *
   *  Returns Array<{ relation, direction, edge, entity }>.
   *  `entity` may be null if the edge target/source isn't in the graph (link-rot).
   */
  const neighbours = (name, opts = {}) => {
    if (empty) return []
    const e = indexes.byName.get(name)
    if (!e) return []
    const direction = opts.direction || 'both'
    const relations = opts.relation
      ? (Array.isArray(opts.relation) ? new Set(opts.relation) : new Set([opts.relation]))
      : null

    const visit = (edges, dir) => edges
      .filter(ed => !relations || relations.has(ed.relation))
      .filter(ed => !opts.edgePredicate || opts.edgePredicate(ed))
      .map(ed => ({
        relation: ed.relation,
        direction: dir,
        edge: ed,
        entity: indexes.byName.get(dir === 'down' ? ed.target : ed.source) || null,
      }))
      .filter(n => !opts.kind || (n.entity && n.entity.kind === opts.kind))

    let out = []
    if (direction === 'down' || direction === 'both') out = out.concat(visit(e.outbound, 'down'))
    if (direction === 'up'   || direction === 'both') out = out.concat(visit(e.inbound,  'up'))
    return out
  }

  /** Multi-hop traversal from `name`. Cycle-safe (visited set).
   *
   *  expand(name, {
   *    direction: 'down' | 'up' | 'both',   // default 'down'
   *    depth: number,                        // default 3
   *    follow: string | string[],            // optional — only these relations
   *    edgePredicate: (edge) => boolean,     // optional
   *    nodePredicate: (entity) => boolean,   // optional — stop at non-matching
   *  })
   *
   *  Returns Array<StitchedEntry> in BFS order, root first.
   */
  const expand = (name, opts = {}) => {
    if (empty) return []
    const root = indexes.byName.get(name)
    if (!root) return []
    const direction = opts.direction || 'down'
    const depth = opts.depth || 3
    const visited = new Set([name])
    const out = [root]
    let frontier = [name]
    for (let d = 0; d < depth; d++) {
      const next = []
      for (const cur of frontier) {
        for (const n of neighbours(cur, {
          direction,
          relation: opts.follow,
          edgePredicate: opts.edgePredicate,
        })) {
          if (!n.entity || visited.has(n.entity.name)) continue
          if (opts.nodePredicate && !opts.nodePredicate(n.entity)) continue
          visited.add(n.entity.name)
          out.push(n.entity)
          next.push(n.entity.name)
        }
      }
      frontier = next
      if (!frontier.length) break
    }
    return out
  }

  /** Convenience: all kind:system entries. */
  const systems = () => byKind('system')

  /** Convenience: members of a system (entities whose `system` === id). */
  const members = systemId => bySystem(systemId).filter(e => e.kind !== 'system')

  /** Convenience: cross-system edges derived from member dependsOn. Used by
   *  the C4 L1 / SystemsView. Each entry is { source, target, count, edges[] }.
   */
  const crossSystemEdges = () => {
    if (empty) return []
    const agg = new Map()
    for (const e of indexes.all) {
      if (!e.system || e.kind === 'system') continue
      for (const ed of e.outbound) {
        if (ed.relation !== 'dependsOn') continue
        const t = indexes.byName.get(ed.target)
        if (!t || !t.system || t.system === e.system) continue
        const k = `${e.system}|${t.system}`
        if (!agg.has(k)) agg.set(k, { source: e.system, target: t.system, count: 0, edges: [] })
        const x = agg.get(k)
        x.count++
        if (x.edges.length < 5) x.edges.push({ from: e.name, to: ed.target, ...(ed.meta || {}) })
      }
    }
    return [...agg.values()]
  }

  return {
    isLoading, error, refetch,
    indexes,
    entity, all, byKind, bySystem, byLayer,
    nodesWhere, neighbours, expand,
    systems, members, crossSystemEdges,
  }
}

function pushTo(map, key, value) {
  if (!key) return
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(value)
}
