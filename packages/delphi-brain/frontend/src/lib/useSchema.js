/**
 * useSchema — runtime accessor for Brain's JSON Schemas.
 *
 * Phase 1 of brain-llm-wiki-evolution-plan.md (§3.2 schema-as-runtime).
 *
 * The frontend pulls schemas from /api/schema once, then can render any kind
 * generically without hard-coding field knowledge per kind. Adding a new
 * kind = drop one .schema.json and restart `brain serve`. The UI updates
 * itself on the next page load.
 *
 * Cache strategy (§8 Q12 — "cache forever, mtime-busts"):
 *   - The registry response carries `maxMtime`; we use it as a query-param
 *     cache-bust on per-kind fetches. Browser then caches each schema
 *     forever (Cache-Control: immutable from the server).
 *   - The registry itself is fetched once per session, ETag-revalidated
 *     by the browser on subsequent loads.
 *
 * Three hooks:
 *   useSchemaRegistry()                 — { kinds[], maxMtime, loading, error }
 *   useSchema(kind)                     — { schema, loading, error }
 *   useSchemaExamples(kind, limit=3)    — { examples[], loading, error }
 */
import { useEffect, useState } from 'react'

const API_BASE = 'http://localhost:7613'

// Module-level caches survive component unmounts within a session.
const registryCache = { promise: null, value: null }
const schemaCache = new Map()    // kind → { promise, value, mtimeKey }
const examplesCache = new Map()  // `${kind}:${limit}` → { promise, value }

/** Force-clear all caches. Useful after a `make index` or schema edit. */
export function resetSchemaCaches() {
  registryCache.promise = null
  registryCache.value = null
  schemaCache.clear()
  examplesCache.clear()
}

async function fetchRegistry() {
  if (registryCache.value) return registryCache.value
  if (registryCache.promise) return registryCache.promise
  registryCache.promise = fetch(`${API_BASE}/api/schema`)
    .then((r) => {
      if (!r.ok) throw new Error(`registry: ${r.status}`)
      return r.json()
    })
    .then((data) => {
      registryCache.value = data
      return data
    })
    .catch((err) => {
      registryCache.promise = null
      throw err
    })
  return registryCache.promise
}

async function fetchSchema(kind, mtimeKey) {
  const entry = schemaCache.get(kind)
  if (entry && entry.value && entry.mtimeKey === mtimeKey) return entry.value
  if (entry && entry.promise && entry.mtimeKey === mtimeKey) return entry.promise

  const promise = fetch(`${API_BASE}/api/schema/${encodeURIComponent(kind)}?v=${mtimeKey}`)
    .then((r) => {
      if (!r.ok) throw new Error(`schema ${kind}: ${r.status}`)
      return r.json()
    })
    .then((data) => {
      schemaCache.set(kind, { promise: null, value: data, mtimeKey })
      return data
    })
    .catch((err) => {
      schemaCache.delete(kind)
      throw err
    })

  schemaCache.set(kind, { promise, value: null, mtimeKey })
  return promise
}

async function fetchExamples(kind, limit) {
  const key = `${kind}:${limit}`
  const entry = examplesCache.get(key)
  if (entry && entry.value) return entry.value
  if (entry && entry.promise) return entry.promise

  const promise = fetch(`${API_BASE}/api/schema/${encodeURIComponent(kind)}/examples?limit=${limit}`)
    .then((r) => {
      if (!r.ok) throw new Error(`examples ${kind}: ${r.status}`)
      return r.json()
    })
    .then((data) => {
      examplesCache.set(key, { promise: null, value: data.examples || [] })
      return data.examples || []
    })
    .catch((err) => {
      examplesCache.delete(key)
      throw err
    })

  examplesCache.set(key, { promise, value: null })
  return promise
}

export function useSchemaRegistry() {
  const [state, setState] = useState({ kinds: null, maxMtime: null, loading: true, error: null })
  useEffect(() => {
    let alive = true
    fetchRegistry()
      .then((reg) => alive && setState({
        kinds: reg.kinds || [],
        maxMtime: reg.maxMtime,
        loading: false,
        error: null,
      }))
      .catch((err) => alive && setState({ kinds: [], maxMtime: null, loading: false, error: err }))
    return () => { alive = false }
  }, [])
  return state
}

export function useSchema(kind) {
  const reg = useSchemaRegistry()
  const [state, setState] = useState({ schema: null, loading: true, error: null })

  useEffect(() => {
    if (!kind || reg.loading) return
    if (reg.error) { setState({ schema: null, loading: false, error: reg.error }); return }

    const info = (reg.kinds || []).find((k) => k.kind === kind)
    if (!info) { setState({ schema: null, loading: false, error: new Error(`unknown kind: ${kind}`) }); return }

    let alive = true
    const mtimeKey = new Date(info.lastModified).getTime()
    setState({ schema: null, loading: true, error: null })
    fetchSchema(kind, mtimeKey)
      .then((schema) => alive && setState({ schema, loading: false, error: null }))
      .catch((err) => alive && setState({ schema: null, loading: false, error: err }))
    return () => { alive = false }
  }, [kind, reg.loading, reg.kinds, reg.error])

  return state
}

export function useSchemaExamples(kind, limit = 3) {
  const [state, setState] = useState({ examples: [], loading: true, error: null })
  useEffect(() => {
    if (!kind) return
    let alive = true
    setState({ examples: [], loading: true, error: null })
    fetchExamples(kind, limit)
      .then((examples) => alive && setState({ examples, loading: false, error: null }))
      .catch((err) => alive && setState({ examples: [], loading: false, error: err }))
    return () => { alive = false }
  }, [kind, limit])
  return state
}
