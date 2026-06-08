/**
 * Renders a Mermaid diagram from raw source code. Used by DocumentShell as
 * the renderer for ```mermaid``` code fences in markdown documents.
 *
 * Mermaid is initialised lazily so the import doesn't bloat first paint for
 * pages that don't render any diagrams.
 */
import { useEffect, useRef, useState } from 'react'

let mermaidPromise = null
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'var(--font-sans), Inter, system-ui, sans-serif',
      })
      return m.default
    })
  }
  return mermaidPromise
}

let nextId = 0

export default function MermaidBlock({ source }) {
  const ref = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadMermaid().then(async (mermaid) => {
      try {
        const id = `mmd-${++nextId}`
        const { svg } = await mermaid.render(id, source.trim())
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e))
      }
    })
    return () => { cancelled = true }
  }, [source])

  if (error) {
    return (
      <div style={errStyle}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Mermaid render error</div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{error}</pre>
      </div>
    )
  }
  return <div ref={ref} style={wrap} />
}

const wrap = { margin: '16px 0', padding: '16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'auto', display: 'flex', justifyContent: 'center' }
const errStyle = { margin: '16px 0', padding: '12px', border: '1px solid var(--status-danger)', borderRadius: 6, background: 'var(--status-danger)11', color: 'var(--status-danger)', fontSize: 12 }
