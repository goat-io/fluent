/**
 * DocumentShell — generic chrome around any document type.
 *
 * Provides:
 *   - Header strip (title, status badge, last-updated, owner, doc prev/next)
 *   - Slide-level prev/next + counter (only when kind=slides)
 *   - Keyboard navigation (←/→ for slides, j/k for docs)
 *   - PDF export (always — uses lib/pdfExport.js)
 *   - Print-friendly CSS via .print-slide / .print-doc classes
 *
 * Documents declare what to render via a manifest:
 *
 *   { meta: { title, lastUpdated, owner, status },
 *     kind: 'markdown', content: '...md string...' }
 *
 *   { meta: ...,
 *     kind: 'slides',  slides: [Component, Component, ...] }
 *
 *   { meta: ...,
 *     kind: 'component', Component: MyView }
 *
 * Documents do NOT implement their own keyboard handlers, prev/next buttons,
 * or PDF export. The shell handles all of that.
 */
import { useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryState, parseAsInteger } from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
// rehype-highlight uses lowlight under the hood — registering on the global
// highlight.js singleton does nothing. Pass languages via the plugin's
// `languages` option instead. Only the langs we actually render, to keep the
// bundle small.
import protobufLang from 'highlight.js/lib/languages/protobuf'
import yamlLang from 'highlight.js/lib/languages/yaml'
import dockerfileLang from 'highlight.js/lib/languages/dockerfile'
import graphqlLang from 'highlight.js/lib/languages/graphql'
import jsonLang from 'highlight.js/lib/languages/json'
import bashLang from 'highlight.js/lib/languages/bash'
import goLang from 'highlight.js/lib/languages/go'
import typescriptLang from 'highlight.js/lib/languages/typescript'
import pythonLang from 'highlight.js/lib/languages/python'
import 'highlight.js/styles/github.css'
import { exportPDF } from './pdfExport.js'
import MermaidBlock from './MermaidBlock.jsx'
import './markdown.css'

// rehype-highlight options: aliases live as duplicate keys (proto = protobuf,
// ts = typescript, shell = bash) so any of those fence tags lights up.
const hlLanguages = {
  protobuf: protobufLang, proto: protobufLang,
  yaml: yamlLang, yml: yamlLang,
  dockerfile: dockerfileLang,
  graphql: graphqlLang, gql: graphqlLang,
  json: jsonLang,
  bash: bashLang, shell: bashLang, sh: bashLang,
  go: goLang,
  typescript: typescriptLang, ts: typescriptLang,
  python: pythonLang, py: pythonLang,
}
const rehypeHighlightOpts = { languages: hlLanguages, detect: true, ignoreMissing: true }

const API = 'http://localhost:7613/api'

// Custom code-fence renderer: routes ```mermaid``` to <MermaidBlock>; future
// fence languages (diagram, catalog-table, …) plug in here. We override `pre`
// (not `code`) because react-markdown's default wraps code-blocks in <pre>,
// and overriding `code` to also return <pre> caused invalid nested <pre>s.
const markdownComponents = {
  pre({ children }) {
    const inner = Array.isArray(children) ? children[0] : children
    const className = inner?.props?.className || ''
    const lang = /language-(\w+)/.exec(className)?.[1]
    if (lang === 'mermaid') {
      const source = String(inner?.props?.children || '').replace(/\n$/, '')
      return <MermaidBlock source={source} />
    }
    return <pre>{children}</pre>
  },
}

export default function DocumentShell({ doc }) {
  // Document-level navigation lives in the sidebar (file browser). The shell
  // only handles in-document page navigation (slide N of M for slide decks).
  // Page index is in the URL (`?page=N`, 1-indexed) so deep-links land on
  // the right slide.
  const printRef = useRef(null)
  const liveBodyRef = useRef(null)
  const scrollRootRef = useRef(null)
  const [pageParam, setPageParam] = useQueryState('page', parseAsInteger)

  const slides = useMemo(() => (doc?.kind === 'slides' ? doc.slides || [] : []), [doc])
  const slideCount = slides.length
  const isSlides = doc?.kind === 'slides'

  // 0-indexed internal slide; clamped to valid range.
  const slide = Math.max(0, Math.min((pageParam ?? 1) - 1, Math.max(slideCount - 1, 0)))
  const setSlide = useCallback((n) => {
    const next = typeof n === 'function' ? n(slide) : n
    const clamped = Math.max(0, Math.min(next, Math.max(slideCount - 1, 0)))
    // Strip ?page=1 from the URL since it's the implicit default.
    setPageParam(clamped === 0 ? null : clamped + 1)
  }, [slide, slideCount, setPageParam])

  // Drop ?page when switching to a doc that doesn't paginate.
  useEffect(() => {
    if (!isSlides && pageParam != null) setPageParam(null)
  }, [isSlides, pageParam, setPageParam])

  const nextSlide = useCallback(() => setSlide((s) => Math.min(s + 1, Math.max(slideCount - 1, 0))), [setSlide, slideCount])
  const prevSlide = useCallback(() => setSlide((s) => Math.max(s - 1, 0)), [setSlide])

  // Keyboard — only in-document navigation.
  useEffect(() => {
    if (!isSlides) return
    const handler = (e) => {
      if (e.target?.matches?.('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prevSlide() }
      if (e.key === 'Home') { e.preventDefault(); setSlide(0) }
      if (e.key === 'End')  { e.preventDefault(); setSlide(slideCount - 1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isSlides, nextSlide, prevSlide, slideCount])

  // Scroll-position hash sync for markdown documents. On mount and on every
  // document change, jump to the heading named in `window.location.hash`
  // (e.g. `#3-infrastructure-as-code-terraform-only`). As the user scrolls,
  // update the hash via `history.replaceState` so refresh keeps the same
  // position. `replaceState` avoids polluting the back-button history.
  const docPath = doc?.path
  const docKind = doc?.kind
  const docContent = doc?.kind === 'markdown' ? doc.content : null
  useEffect(() => {
    if (docKind !== 'markdown') return
    const root = scrollRootRef.current
    if (!root) return

    let cancelled = false

    // Defer to the next frame so rehype-slug has assigned heading IDs.
    requestAnimationFrame(() => {
      if (cancelled) return
      const initial = window.location.hash.replace(/^#/, '')
      if (initial) {
        try {
          const el = root.querySelector(`#${CSS.escape(initial)}`)
          if (el) { el.scrollIntoView({ block: 'start' }); return }
        } catch { /* invalid selector: ignore */ }
        // Hash present but target missing (likely a stale hash from a previous
        // document). Clear it so the URL matches reality.
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      }
      root.scrollTop = 0
    })

    let raf = 0
    let lastId = window.location.hash.replace(/^#/, '')
    const handler = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const headings = root.querySelectorAll('h1[id], h2[id], h3[id]')
        if (!headings.length) return
        const rootTop = root.getBoundingClientRect().top
        const offset = 60 // approximate header strip height
        let current = ''
        for (const h of headings) {
          const top = h.getBoundingClientRect().top - rootTop
          if (top <= offset) current = h.id
          else break
        }
        if (current === lastId) return
        lastId = current
        const path = window.location.pathname
        const search = window.location.search
        const hash = current ? `#${current}` : ''
        window.history.replaceState(null, '', `${path}${search}${hash}`)
      })
    }
    root.addEventListener('scroll', handler, { passive: true })
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      root.removeEventListener('scroll', handler)
    }
  }, [docPath, docKind, docContent])

  const handleExport = useCallback(() => {
    // Markdown/slides/component have an offscreen print container baked in
    // (printRef). Embedded views (React Flow diagrams, custom routes) don't —
    // mounting them twice would re-init the diagram, lose pan/zoom, and not
    // compute SVG layout. Instead snapshot the live visible body's outerHTML,
    // which already has all computed transforms inlined.
    const isEmbedded = doc?.kind === 'embedded'
    const source = isEmbedded ? liveBodyRef.current : printRef.current
    if (!source) return
    exportPDF(source, {
      title: doc?.meta?.title || 'Document',
      slideCount: isSlides ? slideCount : 0,
      isEmbedded,
    })
  }, [doc, isSlides, slideCount])

  if (!doc) {
    return (
      <div style={empty}>
        <div style={{ color: 'var(--text-muted)' }}>Select a document from the list.</div>
      </div>
    )
  }

  const meta = doc.meta || {}

  return (
    <div style={shell}>
      {/* Header strip */}
      <div className="no-print" style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {meta.title || 'Untitled'}
          </div>
          {meta.status && <Badge text={meta.status} />}
          {meta.lastUpdated && <span style={metaText}>updated {meta.lastUpdated}</span>}
          {meta.owner && <span style={metaText}>· {meta.owner}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isSlides && (
            <>
              <button onClick={prevSlide} disabled={slide === 0} style={btn(slide === 0)} title="Previous page (←)">◀</button>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 6px', minWidth: 50, textAlign: 'center' }}>{slide + 1} / {slideCount}</span>
              <button onClick={nextSlide} disabled={slide === slideCount - 1} style={btn(slide === slideCount - 1)} title="Next page (→)">▶</button>
              <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            </>
          )}
          <button onClick={handleExport} style={btnPrimary}>⤓ PDF</button>
        </div>
      </div>

      {/* Visible body — only the current slide / markdown / component shows. */}
      <div ref={scrollRootRef} style={body}>
        {doc.kind === 'markdown' && (
          <div className="markdown-doc" style={mdWrap}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug, [rehypeHighlight, rehypeHighlightOpts]]} components={markdownComponents}>{doc.content || ''}</ReactMarkdown>
            {doc.path && <RelatedPanel path={doc.path} />}
          </div>
        )}
        {doc.kind === 'slides' && slideCount > 0 && (
          <div style={slideWrap}>
            {(() => {
              const Slide = slides[slide]
              return typeof Slide === 'function' ? <Slide /> : Slide
            })()}
          </div>
        )}
        {doc.kind === 'component' && doc.Component && (
          <div style={{ width: '100%', height: '100%' }}>
            <doc.Component />
          </div>
        )}
        {doc.kind === 'embedded' && (
          <div ref={liveBodyRef} style={{ width: '100%', height: '100%' }}>
            {doc.body}
          </div>
        )}
      </div>

      {/* Offscreen container — what `Export PDF` reads. Holds the FULL doc:
          every slide stacked (slides), the markdown body (markdown), or the
          embedded component (component/embedded). Positioned -9999px so it
          never paints. */}
      <div ref={printRef} style={offscreen} aria-hidden>
        {doc.kind === 'markdown' && (
          <div className="markdown-doc print-doc">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug, [rehypeHighlight, rehypeHighlightOpts]]} components={markdownComponents}>{doc.content || ''}</ReactMarkdown>
          </div>
        )}
        {doc.kind === 'slides' && slides.map((Slide, i) => (
          <div key={i} className="print-slide">
            {typeof Slide === 'function' ? <Slide /> : Slide}
          </div>
        ))}
        {doc.kind === 'component' && doc.Component && (
          <div className="print-doc"><doc.Component /></div>
        )}
      </div>

    </div>
  )
}

/**
 * RelatedPanel — bottom-of-doc footer showing two lists Brain computed:
 *   • Backlinks: docs whose markdown links resolve to this one
 *   • Related: ranked neighbours by link / system / tag overlap
 *
 * Both come from the catalog metadata graph — no embeddings, no Ollama.
 */
function RelatedPanel({ path }) {
  const { data: backlinks = [] } = useQuery({
    queryKey: ['backlinks', path],
    queryFn: () => fetch(`${API}/documents/backlinks?path=${encodeURIComponent(path)}`).then(r => r.ok ? r.json() : []),
    staleTime: 60_000,
  })
  const { data: related = [] } = useQuery({
    queryKey: ['related', path],
    queryFn: () => fetch(`${API}/documents/related?path=${encodeURIComponent(path)}`).then(r => r.ok ? r.json() : []),
    staleTime: 60_000,
  })
  if (!backlinks.length && !related.length) return null
  const link = (d) => `?view=documents&doc=${encodeURIComponent(d.Path)}`
  const Group = ({ title, items }) => items.length ? (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map(d => (
          <li key={d.Path} style={{ padding: '4px 0', fontSize: 13 }}>
            <a href={link(d)} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{d.Name || d.Path}</a>
            {d.Description && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>— {d.Description}</span>}
          </li>
        ))}
      </ul>
    </div>
  ) : null
  return (
    <div className="no-print" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <Group title="Related" items={related} />
      <Group title="Referenced by" items={backlinks} />
    </div>
  )
}

function Badge({ text }) {
  const colors = {
    active:    { bg: 'var(--status-success)22', fg: 'var(--status-success)' },
    draft:     { bg: 'var(--status-info)22',    fg: 'var(--status-info)'    },
    deprecated:{ bg: 'var(--status-warning)22', fg: 'var(--status-warning)' },
    archived:  { bg: 'var(--text-muted)22',     fg: 'var(--text-muted)'     },
  }
  const c = colors[String(text).toLowerCase()] || colors.draft
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: c.bg, color: c.fg, textTransform: 'uppercase', letterSpacing: '.04em' }}>{text}</span>
}

const shell = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)', overflow: 'hidden', position: 'relative' }
const header = { flexShrink: 0, height: 44, padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
const body = { flex: 1, overflow: 'auto', position: 'relative' }
const mdWrap = { padding: '40px 56px 80px', maxWidth: 820, margin: '0 auto' }
const slideWrap = { width: '100%', height: '100%', padding: '32px 48px', boxSizing: 'border-box', overflow: 'auto' }
const empty = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }
const offscreen = { position: 'absolute', left: -9999, top: 0, width: 1280, pointerEvents: 'none' }
const metaText = { fontSize: 11, color: 'var(--text-muted)' }
const btn = (disabled) => ({ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: disabled ? 'var(--text-muted)' : 'var(--text)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, opacity: disabled ? 0.5 : 1 })
const btnPrimary = { padding: '4px 12px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent)11', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }
