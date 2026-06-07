/**
 * DocumentsView — generic two-pane reader.
 *
 *   ┌──────────────┬───────────────────────────────────────┐
 *   │ File browser │ DocumentShell rendering selected doc  │
 *   │              │                                       │
 *   │  ▼ Featured  │   header · body · prev/next · PDF     │
 *   │   📊 …       │                                       │
 *   │  ▼ All       │                                       │
 *   │   <tree>     │                                       │
 *   └──────────────┴───────────────────────────────────────┘
 *
 * Sources:
 *   - Featured (top): the curated `LIBRARY` registry from `_instance/library.jsx`.
 *     Mixed types — slide decks + markdown — defined per-instance.
 *   - All Documents (below): every .md the Brain CLI indexed, fetched from
 *     `GET /api/documents?catalog=false`. Generic — no per-company config.
 *
 * Selecting an item loads it into DocumentShell, which handles all chrome.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import DocumentShell from '../lib/DocumentShell.jsx'
import { useViewRenderer } from '../lib/ViewRendererContext.jsx'
import { LIBRARY } from '../_instance/library.jsx'

// ── API helpers ────────────────────────────────────────────
const API = 'http://localhost:7613/api'

async function fetchAllNarrativeDocs() {
  const res = await fetch(`${API}/documents`)
  if (!res.ok) throw new Error('failed to list documents')
  return res.json()
}

async function fetchDocumentByPath(path) {
  const res = await fetch(`${API}/documents/${encodeURI(path)}`)
  if (!res.ok) throw new Error(`failed to load ${path}`)
  return res.json()
}

async function fetchFacets() {
  const res = await fetch(`${API}/documents/facets`)
  if (!res.ok) throw new Error('failed to load facets')
  return res.json()
}

async function fetchSearch(q) {
  if (!q || q.length < 2) return []
  // Hybrid: FTS5 keyword + RAG semantic, merged by Reciprocal Rank Fusion.
  // Falls back to FTS-only when Ollama embedder is offline (rag_available=false).
  const res = await fetch(`${API}/search/hybrid?q=${encodeURIComponent(q)}&k=30`)
  if (!res.ok) {
    // Defensive: if hybrid endpoint is missing (older Brain), fall back to FTS.
    const fts = await fetch(`${API}/search?q=${encodeURIComponent(q)}`)
    if (!fts.ok) return []
    const arr = await fts.json()
    return arr.map(r => ({ ...r, Source: 'fts' }))
  }
  const body = await res.json()
  return body.hits || []
}

// Days since `iso` (YYYY-MM-DD); returns Infinity when unparseable.
function daysSince(iso) {
  if (!iso) return Infinity
  const t = Date.parse(iso)
  if (isNaN(t)) return Infinity
  return (Date.now() - t) / (1000 * 60 * 60 * 24)
}

// ── Build a flat ordered list of all documents (registry first, then All) ──
function buildFlatList(library, allMdPaths) {
  const out = []
  const seenPaths = new Set()

  for (const cat of library) {
    for (const item of cat.items) {
      out.push({ ...item, _category: cat.category, _source: 'featured' })
      if (item.path) seenPaths.add(item.path)
    }
  }
  for (const meta of allMdPaths) {
    if (seenPaths.has(meta.Path)) continue
    out.push({
      id: meta.Path,
      title: meta.Name || meta.Path.split('/').pop().replace(/\.md$/, ''),
      kind: 'markdown',
      path: meta.Path,
      _category: meta.Path.split('/').slice(0, -1).join('/') || 'root',
      _source: 'all',
      _meta: meta,
    })
  }
  return out
}

export default function DocumentsView() {
  const [selectedId, setSelectedId] = useQueryState('doc', parseAsString.withDefault(''))
  const [, setPageParam] = useQueryState('page', parseAsInteger)
  // tab: 'featured' | 'smart' | 'all'
  const [tab, setTab] = useState('featured')
  const [filter, setFilter] = useState('')

  const { data: facets = {} } = useQuery({
    queryKey: ['docFacets'],
    queryFn: fetchFacets,
    staleTime: 60_000,
  })
  const { data: searchHits = [] } = useQuery({
    queryKey: ['docSearch', filter],
    queryFn: () => fetchSearch(filter),
    enabled: filter.length >= 2,
    staleTime: 30_000,
  })

  // App.jsx provides this — lets us render Catalog/diagram-style views
  // (Target State, PoC, Business, …) inside the Documents shell so the user
  // keeps the file browser visible.
  const renderView = useViewRenderer()

  const handleSelect = (id) => {
    if (id !== selectedId) setPageParam(null)  // reset slide index when switching docs
    setSelectedId(id)
  }

  const { data: allDocs = [], isLoading: allDocsLoading } = useQuery({
    queryKey: ['narrativeDocs'],
    queryFn: fetchAllNarrativeDocs,
    staleTime: 60_000,
  })

  // Only .md files; skip catalog entries (they have their own drawer)
  const mdDocs = useMemo(() => allDocs.filter((d) => d.Path?.endsWith('.md') && !d.Path.startsWith('catalog/')), [allDocs])

  const flatList = useMemo(() => buildFlatList(LIBRARY, mdDocs), [mdDocs])

  // Default selection — first featured. Also self-correct stale `?doc=`
  // params (e.g. switching tabs after viewing a code file) so the URL matches
  // what's actually rendered. Wait until `allDocs` has finished loading before
  // declaring a `?doc=` value stale — otherwise a deep-link to a non-library
  // markdown path gets overwritten on first render before mdDocs are available.
  useEffect(() => {
    if (!flatList.length) return
    if (!selectedId) { setSelectedId(flatList[0].id); return }
    if (allDocsLoading) return
    const inFlat = flatList.find((d) => d.id === selectedId)
    const inHits = searchHits.find((r) => r.Path === selectedId)
    // A direct deep-link to a markdown path (e.g. `?doc=narratives/foo.md`)
    // that isn't in the library is still valid — `externalItem` synthesizes
    // it. Don't redirect those.
    const isMarkdownPath = typeof selectedId === 'string' && selectedId.endsWith('.md')
    if (!inFlat && !inHits && !isMarkdownPath) setSelectedId(flatList[0].id)
  }, [selectedId, flatList, searchHits, allDocsLoading, setSelectedId])

  // Search hits / deep-links can point at non-markdown files (proto/yaml/
  // Dockerfile) that aren't in flatList. Synthesize an item from the hit when
  // available, else from the URL path itself — so a fresh page load on
  // `?doc=tools/proto/v1/example.proto` resolves correctly.
  const externalItem = useMemo(() => {
    if (!selectedId) return null
    if (flatList.find((d) => d.id === selectedId)) return null // already in flatList
    // Resolve from active search hits (covers "search then click .proto").
    const hit = searchHits.find((r) => r.Path === selectedId)
    if (hit) {
      return { id: hit.Path, path: hit.Path, kind: 'markdown', title: hit.Name || hit.Path.split('/').pop() }
    }
    // No search hit: synthesize for markdown paths (covers deep-links to
    // docs not in the curated library). Non-md URL params fall through to
    // flatList[0] so the user lands on the default doc, not the last code
    // file they viewed elsewhere.
    if (typeof selectedId === 'string' && selectedId.endsWith('.md')) {
      return { id: selectedId, path: selectedId, kind: 'markdown', title: selectedId.split('/').pop().replace(/\.md$/, '') }
    }
    return null
  }, [selectedId, searchHits, flatList])
  const selectedItem = flatList.find((d) => d.id === selectedId) || externalItem || flatList[0]
  const selectedIdx = flatList.findIndex((d) => d.id === selectedItem?.id)

  // Fetch markdown content when a markdown doc is selected
  const { data: mdResponse } = useQuery({
    queryKey: ['mdDoc', selectedItem?.path],
    queryFn: () => fetchDocumentByPath(selectedItem.path),
    enabled: selectedItem?.kind === 'markdown' && !!selectedItem?.path,
    staleTime: 60_000,
  })

  // Build the doc manifest passed into DocumentShell
  const doc = useMemo(() => {
    if (!selectedItem) return null
    if (selectedItem.kind === 'markdown') {
      const raw = mdResponse?.content || ''
      const path = selectedItem.path || ''
      // Non-markdown text files (proto/graphql/yaml/Dockerfile/etc.) get
      // wrapped in a fenced code block so ReactMarkdown renders them as
      // syntax-styled <pre><code> rather than mangling `//` comments and `<`
      // characters as HTML. Frontmatter parsing is skipped for these.
      if (!path.endsWith('.md')) {
        const lang = (path.match(/\.([a-zA-Z0-9]+)$/) || [, ''])[1].toLowerCase()
        const langAlias = { yml: 'yaml', tf: 'hcl', gql: 'graphql' }[lang] || lang
        return {
          meta: { title: selectedItem.title },
          kind: 'markdown',
          content: '```' + langAlias + '\n' + raw + '\n```',
          path,
        }
      }
      const { meta, body } = parseFrontmatter(raw)
      return {
        meta: {
          title: meta.name || selectedItem.title,
          lastUpdated: meta['last-updated'],
          owner: meta.owner,
          status: meta.status,
        },
        kind: 'markdown',
        content: body,
        path: selectedItem.path,  // for backlinks/related lookups
      }
    }
    if (selectedItem.kind === 'slides') {
      return {
        meta: selectedItem.meta || { title: selectedItem.title },
        kind: 'slides',
        slides: selectedItem.slides,
      }
    }
    if (selectedItem.kind === 'component') {
      return {
        meta: selectedItem.meta || { title: selectedItem.title },
        kind: 'component',
        Component: selectedItem.Component,
      }
    }
    if (selectedItem.kind === 'route' && renderView) {
      // Render the routed view inline. Wrapped as a `kind: 'embedded'` doc
      // so DocumentShell still applies the header strip, prev/next, PDF.
      return {
        meta: selectedItem.meta || { title: selectedItem.title },
        kind: 'embedded',
        body: renderView(selectedItem.routeTo),
      }
    }
    return null
  }, [selectedItem, mdResponse, renderView])

  // Doc-level navigation moved to the sidebar (file browser). DocumentShell
  // only handles in-document page nav (slide N/M).

  // Group items for the file browser
  const featuredByCat = useMemo(() => {
    const m = new Map()
    for (const cat of LIBRARY) m.set(cat.category, cat.items.map((i) => ({ ...i, _category: cat.category, _source: 'featured' })))
    return m
  }, [])

  const allByFolder = useMemo(() => {
    const m = new Map()
    for (const item of flatList) {
      if (item._source !== 'all') continue
      const folder = item._category
      if (!m.has(folder)) m.set(folder, [])
      m.get(folder).push(item)
    }
    return m
  }, [flatList])

  const matchesFilter = (item) => !filter || item.title?.toLowerCase().includes(filter.toLowerCase()) || item.path?.toLowerCase().includes(filter.toLowerCase())

  // Smart-tab data — derived from indexed metadata. No hardcoded ids.
  const smartGroups = useMemo(() => {
    const md = mdDocs
    const recent = [...md].filter(d => daysSince(d.LastUpdated) <= 30)
                          .sort((a,b) => (b.LastUpdated||'').localeCompare(a.LastUpdated||''))
                          .slice(0, 15)
    const drafts = md.filter(d => (d.Status||'').toLowerCase() === 'draft')
    const stale  = md.filter(d => daysSince(d.LastUpdated) > 90 && (d.Status||'').toLowerCase() !== 'archived').slice(0, 30)
    const toItem = (d) => ({
      id: d.Path, path: d.Path, kind: 'markdown',
      title: d.Name || d.Path.split('/').pop().replace(/\.md$/, ''),
      icon: '📄',
    })
    return [
      { category: '🕒 Recently updated', items: recent.map(toItem) },
      { category: '✏️ Drafts',           items: drafts.map(toItem) },
      { category: '⚠️ Stale (>90d)',     items: stale.map(toItem)  },
    ].filter(g => g.items.length > 0)
  }, [mdDocs])

  // By-system / by-tag groupings come from facet data joined back to mdDocs.
  const bySystem = useMemo(() => {
    const sys = facets.system || {}
    const top = Object.entries(sys).sort((a,b) => b[1]-a[1]).slice(0, 8)
    return top.map(([s]) => ({
      category: `🧩 ${s}`,
      items: mdDocs.filter(d => d.System === s).map(d => ({
        id: d.Path, path: d.Path, kind: 'markdown',
        title: d.Name || d.Path.split('/').pop().replace(/\.md$/, ''), icon: '📄',
      })),
    })).filter(g => g.items.length > 0)
  }, [facets.system, mdDocs])

  const byTag = useMemo(() => {
    const tags = facets.tags || {}
    const top = Object.entries(tags).sort((a,b) => b[1]-a[1]).slice(0, 10)
    return top.map(([t]) => ({
      category: `🏷  ${t}`,
      items: mdDocs.filter(d => (d.Tags||[]).includes(t)).map(d => ({
        id: d.Path, path: d.Path, kind: 'markdown',
        title: d.Name || d.Path.split('/').pop().replace(/\.md$/, ''), icon: '📄',
      })),
    })).filter(g => g.items.length > 0)
  }, [facets.tags, mdDocs])

  // Search results: typeahead-style list with title + path + snippet + source
  // badge. Smart title fallback so we don't see 30× "README" — uses the
  // parent folder name when the filename is README.
  const smartTitleFor = (hit) => {
    const segs = hit.Path.split('/')
    const file = segs[segs.length - 1]
    const base = file.replace(/\.(md|json|yaml|yml|proto|graphql|gql)$/i, '')
    if (hit.Name && hit.Name !== file) return hit.Name
    if (/^readme$/i.test(base) || /^catalog-info$/i.test(base)) {
      return segs[segs.length - 2] || base
    }
    return base
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* File browser */}
      <div style={browser}>
        <div style={browserHeader}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search docs… (≥2 chars)"
            style={filterInput}
          />
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <TabBtn active={tab==='featured'} onClick={() => setTab('featured')}>Featured</TabBtn>
          <TabBtn active={tab==='smart'}    onClick={() => setTab('smart')}>Smart</TabBtn>
          <TabBtn active={tab==='all'}      onClick={() => setTab('all')}>All ({flatList.filter((d) => d._source === 'all').length})</TabBtn>
        </div>
        <div style={browserList}>
          {/* When the user is searching, the search results jump to the top
              of every tab so they're always visible. Hybrid backend (FTS5 +
              RAG) returns rich hits — we render them typeahead-style with
              title, path, snippet, and source badge. */}
          {filter.length >= 2 && searchHits.length > 0 && (
            <SearchResults
              query={filter}
              hits={searchHits.slice(0, 30)}
              titleFor={smartTitleFor}
              selectedId={selectedItem?.id}
              onSelect={handleSelect}
            />
          )}
          {tab==='featured' && [...featuredByCat.entries()].map(([cat, items]) => (
            <CategoryGroup key={cat} category={cat} items={items.filter(matchesFilter)} selectedId={selectedItem?.id} onSelect={handleSelect} />
          ))}
          {tab==='smart' && (
            <>
              {smartGroups.map(g => (
                <CategoryGroup key={g.category} category={g.category} items={g.items.filter(matchesFilter)} selectedId={selectedItem?.id} onSelect={handleSelect} />
              ))}
              {bySystem.length > 0 && <div style={catLabel}>BY SYSTEM</div>}
              {bySystem.map(g => (
                <CategoryGroup key={g.category} category={g.category} items={g.items.filter(matchesFilter)} selectedId={selectedItem?.id} onSelect={handleSelect} />
              ))}
              {byTag.length > 0 && <div style={catLabel}>BY TAG</div>}
              {byTag.map(g => (
                <CategoryGroup key={g.category} category={g.category} items={g.items.filter(matchesFilter)} selectedId={selectedItem?.id} onSelect={handleSelect} />
              ))}
              {smartGroups.length === 0 && bySystem.length === 0 && byTag.length === 0 && (
                <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                  No smart groups yet. Add `tags:`, `system:`, or `audience:` to .md frontmatter — see <code>brain/conventions.md</code>.
                </div>
              )}
            </>
          )}
          {tab==='all' && [...allByFolder.entries()].sort().map(([folder, items]) => (
            <CategoryGroup key={folder} category={folder} items={items.filter(matchesFilter)} selectedId={selectedItem?.id} onSelect={handleSelect} />
          ))}
        </div>
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <DocumentShell doc={doc} />
      </div>
    </div>
  )
}

function CategoryGroup({ category, items, selectedId, onSelect }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={catLabel}>{category}</div>
      {items.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)} style={itemBtn(item.id === selectedId)} title={item.path || item.title}>
          <span style={{ width: 18, textAlign: 'center', fontSize: 13 }}>{item.icon || '📄'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
        </button>
      ))}
    </div>
  )
}

// SearchResults — typeahead-style multi-line list for hybrid search hits.
// Each row: source badge · title (smart fallback to parent dir) · bucket pill
//           · path (muted, mono) · snippet (server-rendered with <b> highlights)
const SOURCE_META = {
  both: { icon: '⚡', label: 'KEYWORD + SEMANTIC', color: 'var(--status-success)' },
  rag:  { icon: '🧠', label: 'SEMANTIC',           color: 'var(--accent)' },
  fts:  { icon: '🔍', label: 'KEYWORD',            color: 'var(--text-muted)' },
}
// Sanitize FTS5 snippets: escape everything, then re-allow <b>/</b> tags that
// FTS5 wraps matched terms in. Prevents XSS if the corpus ever contains
// HTML/script tags (the docs are internal but defense in depth is cheap).
function safeSnippetHTML(raw) {
  if (!raw) return ''
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>')
}
function bucketFor(path) {
  const seg = path.split('/')[0] || ''
  // Map first segment to a short, stable bucket label.
  return ({
    narratives: 'narrative', catalog: 'catalog', repos: 'repo',
    tools: 'tool', brain: 'brain', '.claude': 'skill',
  })[seg] || seg
}
function SearchResults({ query, hits, titleFor, selectedId, onSelect }) {
  // Snippets come back with <b>...</b> markup from FTS5. The server-rendered
  // HTML is trusted (FTS5 only adds <b> tags around matched terms; the
  // surrounding text is escaped because it's JSON-encoded over the wire).
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={catLabel}>🔍 SEARCH "{query}" · {hits.length} match{hits.length === 1 ? '' : 'es'}</div>
      {hits.map((hit) => {
        const src = SOURCE_META[hit.Source] || SOURCE_META.fts
        const title = titleFor(hit)
        const bucket = bucketFor(hit.Path)
        const active = hit.Path === selectedId
        return (
          <button
            key={hit.Path}
            onClick={() => onSelect(hit.Path)}
            title={hit.Path}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 10px',
              borderRadius: 6, border: 'none', marginBottom: 2,
              background: active ? 'var(--accent)22' : 'transparent',
              color: 'var(--text)',
              cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start',
            }}
          >
            <span title={src.label} style={{ width: 18, textAlign: 'center', fontSize: 13, flexShrink: 0, marginTop: 1 }}>{src.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-heading)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: '0 1 auto', minWidth: 0,
                }}>{title}</span>
                {bucket && (
                  <span style={{
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: src.color, padding: '1px 5px', borderRadius: 3,
                    border: `1px solid ${src.color}33`, flexShrink: 0,
                  }}>{bucket}</span>
                )}
              </span>
              <span style={{
                display: 'block', fontSize: 10, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 3,
              }}>{hit.Path}</span>
              {hit.Snippet && (
                <span
                  style={{
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', fontSize: 11, lineHeight: 1.4,
                    color: 'var(--text-muted)',
                  }}
                  dangerouslySetInnerHTML={{ __html: safeSnippetHTML(hit.Snippet) }}
                />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 10px', border: 'none', background: active ? 'var(--surface)' : 'transparent',
      color: active ? 'var(--text-heading)' : 'var(--text-muted)',
      fontSize: 11, fontWeight: 600, cursor: 'pointer', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    }}>{children}</button>
  )
}

function parseFrontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md)
  if (!m) return { meta: {}, body: md }
  const meta = {}
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line)
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '')
  }
  return { meta, body: m[2] }
}

const browser = { width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }
const browserHeader = { padding: 8, borderBottom: '1px solid var(--border)' }
const browserList = { flex: 1, overflow: 'auto', padding: '6px 4px' }
const filterInput = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 12 }
const catLabel = { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 10px 4px' }
const itemBtn = (active) => ({
  width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none',
  background: active ? 'var(--accent)22' : 'transparent',
  color: active ? 'var(--text-heading)' : 'var(--text)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
  fontWeight: active ? 600 : 500,
})
