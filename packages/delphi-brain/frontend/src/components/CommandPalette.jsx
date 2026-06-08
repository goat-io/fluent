import { useEffect, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { searchDocuments } from '../api'

const VIEWS = [
  { key: 'catalog',        label: 'Catalog',        icon: '📋' },
  { key: 'services',       label: 'Services',        icon: '🏗️' },
  { key: 'target',         label: 'Target State',    icon: '🎯' },
  { key: 'business',       label: 'Business',        icon: '💼' },
  { key: 'data',           label: 'Data',            icon: '🗄️' },
  { key: 'infrastructure', label: 'Infrastructure',  icon: '☁️' },
  { key: 'alarms',         label: 'Alarm Flows',     icon: '🚨' },
  { key: 'security',       label: 'Security',        icon: '🔒' },
  { key: 'poc-local',      label: 'PoC: Local',      icon: '🧪' },
  { key: 'poc-aws',        label: 'PoC: AWS',        icon: '🚀' },
]

// Debounce helper
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// Classify a search result path into a user-friendly category
function classifyResult(path) {
  if (path.includes('/catalog/') && path.endsWith('catalog-info.json'))
    return { type: 'spec', icon: '📦', label: 'Service Spec' }
  if (path.includes('/catalog/') && path.endsWith('openapi.json'))
    return { type: 'api', icon: '🔌', label: 'API Spec' }
  if (path.includes('/catalog/') && path.endsWith('README.md'))
    return { type: 'catalog', icon: '📄', label: 'Catalog' }
  if (path.includes('/architecture/'))
    return { type: 'arch', icon: '🏛', label: 'Architecture' }
  if (path.includes('/product/'))
    return { type: 'product', icon: '📊', label: 'Product' }
  if (path.includes('/company/'))
    return { type: 'company', icon: '🏢', label: 'Company' }
  if (path.includes('/security/'))
    return { type: 'security', icon: '🔒', label: 'Security' }
  return { type: 'doc', icon: '📝', label: 'Document' }
}

// Extract repo name and domain from a path
function extractRepoInfo(path) {
  const parts = path.split('/')
  // engineering/catalog/domain/repo-name/README.md
  const catIdx = parts.indexOf('catalog')
  if (catIdx >= 0 && parts.length > catIdx + 2) {
    return { repo: parts[catIdx + 2], domain: parts[catIdx + 1] }
  }
  // repos/repo-name/...
  const repoIdx = parts.indexOf('repos')
  if (repoIdx >= 0 && parts.length > repoIdx + 1) {
    return { repo: parts[repoIdx + 1], domain: null }
  }
  return null
}

// Build a human-readable title from a search result
function getResultTitle(result) {
  const info = extractRepoInfo(result.Path)
  if (info?.repo) {
    // For catalog entries, show repo name
    return info.repo
  }
  // For architecture/company/product docs, show the Name from frontmatter
  if (result.Name && result.Name !== result.Path.split('/').pop()) {
    return result.Name
  }
  // Fallback: clean up the filename
  return result.Path.split('/').pop().replace(/\.(md|json)$/, '')
}

// Build a subtitle showing where this result lives
function getResultSubtitle(result) {
  const info = extractRepoInfo(result.Path)
  if (info?.domain) return info.domain
  // Show parent folder for non-catalog results
  const parts = result.Path.split('/')
  if (parts.length >= 2) return parts.slice(0, -1).join('/')
  return ''
}

// Strip HTML tags from snippet
function stripHtml(html) {
  return html?.replace(/<[^>]+>/g, '') ?? ''
}

export default function CommandPalette({ open, onClose, onSelectService, onSelectView }) {
  const inputRef = useRef(null)
  const [value, setValue] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const debouncedQuery = useDebounce(value, 200)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setValue('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Search Brain API on debounced query change
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    searchDocuments(debouncedQuery)
      .then(data => {
        if (!cancelled && Array.isArray(data)) {
          setResults(data.slice(0, 20))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Global Cmd+K / Ctrl+K
  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSelectResult = (result) => {
    const info = extractRepoInfo(result.Path)
    if (info?.repo) {
      onSelectService?.({
        id: info.repo, name: info.repo, domain: info.domain ?? 'unknown',
      })
    }
    onClose?.()
  }

  return (
    <div
      cmdk-dialog=""
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <Command
        label="Global Search"
        loop
        shouldFilter={false}
        onKeyDown={e => { if (e.key === 'Escape') onClose?.() }}
      >
        <Command.Input
          ref={inputRef}
          placeholder="Search everything — services, APIs, docs, security findings…"
          value={value}
          onValueChange={setValue}
        />
        <Command.List>
          {!value.trim() && !loading && (
            <>
              <Command.Group heading="Views">
                {VIEWS.map(view => (
                  <Command.Item
                    key={view.key}
                    value={`view-${view.key}-${view.label}`}
                    onSelect={() => { onSelectView?.(view.key); onClose?.() }}
                  >
                    <span style={{ width: 20, textAlign: 'center' }}>{view.icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{view.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </>
          )}

          {value.trim() && !loading && results.length === 0 && (
            <Command.Empty>No results found.</Command.Empty>
          )}

          {loading && (
            <Command.Loading>
              <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                Searching…
              </div>
            </Command.Loading>
          )}

          {results.length > 0 && (
            <Command.Group heading={`${results.length} results`}>
              {results.map((r, i) => {
                const cls = classifyResult(r.Path)
                const snippet = stripHtml(r.Snippet ?? '')
                return (
                  <Command.Item
                    key={`${r.Path}-${i}`}
                    value={`result-${i}-${r.Path}`}
                    onSelect={() => handleSelectResult(r)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{cls.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {getResultTitle(r)}
                        </span>
                        <span style={{
                          fontSize: 10, color: 'var(--text-muted)',
                          background: 'var(--surface-raised)', padding: '1px 6px',
                          borderRadius: 4, flexShrink: 0,
                        }}>{cls.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                          {getResultSubtitle(r)}
                        </span>
                      </div>
                      {snippet && (
                        <div style={{
                          fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{snippet.slice(0, 120)}</div>
                      )}
                    </div>
                  </Command.Item>
                )
              })}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  )
}
