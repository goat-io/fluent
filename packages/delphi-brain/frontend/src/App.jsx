import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import { fetchLenses } from './api'
import { BRAND } from './_instance/lib/branding.js'
import DocumentsView from './views/DocumentsView.jsx'
import { ViewRendererContext } from './lib/ViewRendererContext.jsx'
import { useView } from './lib/useView.js'
import UnifiedView from './views/UnifiedView.jsx'
import UnifiedFilters from './views/UnifiedFilters.jsx'
import { useGraph } from './lib/catalog/Graph.js'
import ChatPanel from './components/ChatPanel.jsx'
import DetailDrawer from './components/DetailDrawer.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import './index.css'
import { useArch } from './data/ArchProvider.jsx'



// =====================================================================
// Tab definitions
// =====================================================================
const mainTabs = [
  { key: 'catalog',  label: 'Catalog',  color: '#0EA5E9' },
]

// The generic Brain shell ships two top-level views: the unified Catalog
// (UnifiedShell) and Documents. Company-specific routed views (diagrams,
// slide decks, ...) are provided by the instance seam (`_instance/library.jsx`)
// as kind:route / kind:slides entries surfaced inside the Documents shell.

// =====================================================================
// App
// =====================================================================
export default function App() {
  // View is derived from the URL pathname (`/catalog`, `/documents`, `/target`, …).
  const [activeTab, setActiveTab] = useView()
  const [selectedNode, setSelectedNode] = useQueryState('node', parseAsString)
  const [serviceParam, setServiceParam] = useQueryState('service', parseAsString)
  const [unifiedLens, setUnifiedLens] = useQueryState('lens', parseAsString.withDefault('catalog'))
  const [unifiedMode, setUnifiedMode] = useQueryState('mode', parseAsString.withDefault('table'))
  // One nuqs hook per filter facet — each writes its own URL param so the
  // whole page state (lens + mode + filters + selected entity) is captured
  // in the URL and shareable. Order matches legacy Catalog filter row.
  const [filterKind,   setFilterKind]   = useQueryState('kind',   parseAsString)
  const [filterLayer,  setFilterLayer]  = useQueryState('layer',  parseAsString)
  const [filterSystem, setFilterSystem] = useQueryState('system', parseAsString)
  const [filterDomain, setFilterDomain] = useQueryState('domain', parseAsString)
  const [filterType,   setFilterType]   = useQueryState('type',   parseAsString)
  const [filterTeam,   setFilterTeam]   = useQueryState('team',   parseAsString)
  const [filterStatus, setFilterStatus] = useQueryState('status', parseAsString)
  const unifiedFilters = useMemo(() => ({
    kind: filterKind, layer: filterLayer, system: filterSystem, domain: filterDomain,
    type: filterType, team: filterTeam, status: filterStatus,
  }), [filterKind, filterLayer, filterSystem, filterDomain, filterType, filterTeam, filterStatus])
  const filterSetters = useMemo(() => ({
    kind: setFilterKind, layer: setFilterLayer, system: setFilterSystem, domain: setFilterDomain,
    type: setFilterType, team: setFilterTeam, status: setFilterStatus,
  }), [setFilterKind, setFilterLayer, setFilterSystem, setFilterDomain, setFilterType, setFilterTeam, setFilterStatus])
  const setUnifiedFilter = useCallback((key, value) => {
    if (key === '__clear__') {
      Object.values(filterSetters).forEach(set => set(null))
      return
    }
    filterSetters[key]?.(value || null)
  }, [filterSetters])

  // Command palette open state
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Selected service object (from catalog row click or node click)
  const [selectedService, setSelectedService] = useState(null)

  // Architecture data from Brain API — only the loading flag is needed by the
  // generic shell (the entity drawer fetches its own data on demand).
  const { isLoading: archLoading } = useArch()

  // Renderer exposed via context — DocumentsView calls this for `kind: route`
  // library entries so a routed view can appear inside the Documents shell
  // instead of replacing it. The generic Brain shell ships no hardcoded
  // diagram routes; company-specific instances provide their own renderer
  // (e.g. by wrapping this provider) when they add kind:route entries. Returns
  // null here so the context is always present but inert by default.
  const renderView = useCallback(() => null, [])

  // Global Cmd+K listener
  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSelectService = useCallback((svc) => {
    setSelectedService(svc)
    setServiceParam(svc.id)
    setSelectedNode(svc.id)
  }, [setServiceParam, setSelectedNode])

  const [, setDrawerTabParam] = useQueryState('tab', parseAsString)
  const handleCloseDrawer = useCallback(() => {
    setSelectedService(null)
    setSelectedNode(null)
    setServiceParam(null)
    setDrawerTabParam(null)  // forget which drawer tab was active
  }, [setSelectedNode, setServiceParam, setDrawerTabParam])

  const handleSelectView = useCallback((viewKey) => {
    setActiveTab(viewKey)
  }, [setActiveTab])

  const isCatalog = activeTab === 'catalog'
  const isDocuments = activeTab === 'documents'
  const [chatOpen, setChatOpen] = useState(false)

  // LayeredView click → DetailDrawer (the same drawer Catalog uses). Look
  // up the clicked entity's `domain` in the graph so DetailDrawer can fetch
  // `/api/catalog/:domain/:name`. One drawer for the whole app.
  const { entity: lookupEntity } = useGraph()
  const openEntityInDrawer = useCallback(({ name, kind }) => {
    const e = lookupEntity?.(name)
    const domain = e?.domain || (
      kind === 'product'  ? 'products' :
      kind === 'external' ? 'external' :
      kind === 'service'  ? 'infrastructure' :
      kind === 'infra'    ? 'infrastructure' :
      kind === 'system'   ? 'systems' :
      kind === 'team'     ? 'teams' :
      'unknown'
    )
    handleSelectService({
      id: name,
      name,
      domain,
      description: e?.description || '',
      team: e?.spec?.team || '',
    })
  }, [lookupEntity])

  const drawerW = 220

  // Icons for nav items.
  const navIcons = {
    catalog: '📋',
    documents: '📚',
  }

  const navBtnStyle = (tab) => ({
    width: '100%', textAlign: 'left',
    padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 500,
    fontFamily: 'var(--font-sans)',
    background: activeTab === tab.key ? `${tab.color}22` : 'transparent',
    color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
    transition: 'all 120ms ease',
    marginBottom: 2,
  })

  return (
    <ViewRendererContext.Provider value={renderView}>
    <div style={{ width: '100vw', height: '100vh', display: 'flex', fontFamily: 'var(--font-sans)', background: 'var(--background)', color: 'var(--text)' }}>

      {/* ── Command Palette ── */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectService={(svc) => { handleSelectService(svc); if (!isCatalog) setActiveTab('catalog') }}
        onSelectView={handleSelectView}
      />

      {/* ── Detail Drawer (overlay) ── */}
      {selectedService && (
        <DetailDrawer
          service={selectedService}
          onClose={handleCloseDrawer}
          onNavigate={(name) => {
            // Try to find the repo in catalog data to get domain
            fetch(`http://localhost:7613/api/repos/${encodeURIComponent(name)}`)
              .then(r => r.ok ? r.json() : null)
              .then(repo => {
                if (repo) {
                  handleSelectService({ id: repo.name, name: repo.name, domain: repo.domain, description: repo.description, team: repo.team, repoUrl: repo.url })
                } else {
                  handleSelectService({ id: name, name, domain: 'unknown' })
                }
              })
              .catch(() => handleSelectService({ id: name, name, domain: 'unknown' }))
          }}
        />
      )}

      {/* ── Left Sidebar ── */}
      <div style={{
        width: drawerW, minWidth: drawerW, height: '100vh',
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Logo header */}
        <div style={{
          padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <img src={new URL(BRAND.logoUrl, import.meta.url).href} alt={BRAND.name} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.2 }}>{BRAND.name}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>Brain</div>
          </div>
        </div>

        {/* Cmd+K trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          style={{
            margin: '10px 10px 4px', padding: '7px 10px',
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
            fontFamily: 'var(--font-sans)', transition: 'border-color 120ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span style={{ flex: 1 }}>Search…</span>
          <kbd style={{ fontSize: 9, padding: '1px 4px', background: 'var(--surface-overlay)', border: '1px solid var(--border)', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>⌘K</kbd>
        </button>

        {/* Navigation sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 10px', marginBottom: 4 }}>
            Explore
          </div>
          {mainTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={navBtnStyle(tab)}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{navIcons[tab.key]}</span>
              {tab.label}
              {activeTab === tab.key && (
                <div style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: tab.color }} />
              )}
            </button>
          ))}

          {/* Documents — single entry, opens the file-browser + reader.
              Company-specific routed views (diagrams, slide decks) are listed
              inside Documents via kind:route / kind:slides library entries. */}
          <button
            onClick={() => setActiveTab('documents')}
            style={navBtnStyle({ key: 'documents', color: 'var(--accent)' })}
          >
            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>📚</span>
            Documents
            {activeTab === 'documents' && (
              <div style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
          </button>

        </div>

      </div>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top bar ── */}
        <div style={{
          height: 48, flexShrink: 0,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{BRAND.name}</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 500, textTransform: 'capitalize' }}>
              {activeTab === 'documents' ? 'Documents' :
                activeTab === 'catalog' ? 'Catalog' :
                activeTab}
            </span>
          </div>

          {/* Loading indicator */}
          {archLoading && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
              Loading data…
            </span>
          )}

          {/* Right side */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setPaletteOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 8,
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', transition: 'border-color 120ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Search
              <kbd style={{ fontSize: 10, padding: '1px 5px', background: 'var(--surface-overlay)', border: '1px solid var(--border)', borderRadius: 3, fontFamily: 'var(--font-mono)', marginLeft: 2 }}>⌘K</kbd>
            </button>
          </div>
        </div>

        {/* ── View content ── */}
        {/* Generic Brain ships two top-level views: Documents and the unified
            Catalog. Any unknown tab falls back to the Catalog so there is never
            a blank route. */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {isDocuments
            ? (
              <DocumentsView key="documents" />
            )
            : (
              <UnifiedShell
                key={`catalog-${unifiedLens}-${unifiedMode}`}
                lens={unifiedLens}
                mode={unifiedMode}
                onLensChange={(newLens) => {
                  // Filters carry over poorly when the lens changes — e.g.
                  // a kind:repo filter has no matches when switching to the
                  // Teams lens (only kind:team). Clear filters so the new
                  // lens shows its full set; user re-narrows from there.
                  Object.values(filterSetters).forEach(set => set(null))
                  setUnifiedLens(newLens)
                }}
                onModeChange={setUnifiedMode}
                filters={unifiedFilters}
                onFilterChange={setUnifiedFilter}
                onSelect={(row) => openEntityInDrawer({
                  name: row.id || row.name,
                  kind: row.kind || row.cells?.kind,
                })}
              />
            )
          }
        </div>
      </div>

      {/* ── Floating Brain Chat ── */}
      {chatOpen && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, width: 420, height: 520,
          borderRadius: 16, overflow: 'hidden', zIndex: 1000,
          boxShadow: '0 8px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--background)',
        }}>
          {/* Chat header */}
          <div style={{
            padding: '10px 16px', background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', flex: 1 }}>Brain Chat</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {activeTab}
            </span>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                width: 24, height: 24, borderRadius: 6, border: 'none',
                background: 'var(--surface-raised)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: 14,
              }}
            >
              ×
            </button>
          </div>
          <ChatPanel activeView={activeTab} selectedNode={selectedNode} />
        </div>
      )}

      {/* Floating chat button */}
      <button
        onClick={() => setChatOpen(prev => !prev)}
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 48, height: 48,
          borderRadius: '50%', border: 'none', cursor: 'pointer', zIndex: 1001,
          background: chatOpen ? 'var(--surface-overlay)' : 'var(--accent)',
          color: chatOpen ? 'var(--text)' : '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, transition: 'all 200ms ease',
        }}
      >
        {chatOpen ? '×' : '🧠'}
      </button>
    </div>
    </ViewRendererContext.Provider>
  )
}

// =====================================================================
// UnifiedShell — chrome around UnifiedView. Lens picker (dropdown loaded
// from /api/scope/lenses) + mode toggle + filter row. URL drives state.
// =====================================================================
function UnifiedShell({ lens, mode, onLensChange, onModeChange, filters, onFilterChange, onSelect }) {
  const { data: lenses = [] } = useQuery({
    queryKey: ['lenses'],
    queryFn: fetchLenses,
    staleTime: 5 * 60 * 1000,
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Lens</label>
        <select value={lens} onChange={e => onLensChange(e.target.value)}
          style={{
            padding: '4px 10px', fontSize: 12, fontFamily: 'var(--font-sans)',
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)', color: 'var(--text)',
          }}>
          {lenses.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <div style={{
          display: 'flex', gap: 2, marginLeft: 'auto',
          background: 'var(--surface-raised)', borderRadius: 8, padding: 2,
          border: '1px solid var(--border)',
        }}>
          {['table', 'graph', 'dashboard'].map(m => (
            <button key={m} onClick={() => onModeChange(m)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 500,
                border: 'none', borderRadius: 6, cursor: 'pointer',
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {m === 'table' ? '⊞ Table' : m === 'graph' ? '⬡ Graph' : '◨ Dashboard'}
            </button>
          ))}
        </div>
      </div>
      <UnifiedFilters lens={lens} values={filters} onChange={onFilterChange} />
      <UnifiedView lens={lens} mode={mode} filters={filters} onSelect={onSelect} />
    </div>
  )
}
