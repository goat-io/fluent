/**
 * DashboardMode — paints the server-built card array.
 *
 * Cards arrive grouped by `section`. Each section renders as a subtitle +
 * grid of cards. Card kinds:
 *   - counter   small KPI tile (value, sub, tone-tinted)
 *   - breakdown full-width row of horizontal bars; each row is expandable
 *     into the list of members the server attached.
 *   - top       ranked list of clickable rows.
 *
 * No filtering, no aggregation, no member fetching here — the server prebuilt
 * everything in `Scope.ToDashboard()`. Add a new card kind: branch here.
 */
import { useState } from 'react'
import { layerOf, kindOf, domainOf } from '../../lib/badgeRegistry.js'

// Tone → CSS variable. Maps the server's intent-keyword to the theme's
// status palette so the dashboard inherits whatever the host site picks.
const TONE_COLORS = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  danger:  'var(--status-danger)',
  info:    'var(--status-info)',
  accent:  'var(--accent)',
}

// Per-label palette for breakdowns. When the server doesn't supply a slice
// color (it currently doesn't — meta extraction is a later pass), the
// renderer derives one from the catalog's enums via the existing badge
// registry, so domain/layer/kind labels match the rest of the UI.
function colorForSlice(cardTitle, label) {
  const t = (cardTitle || '').toLowerCase()
  if (t.includes('layer'))   return layerOf(label).color
  if (t.includes('kind'))    return kindOf(label).color
  if (t.includes('domain'))  return domainOf(label).color
  if (t.includes('language')) return LANG_COLORS[label.toLowerCase()] || 'var(--accent)'
  return 'var(--accent)'
}

// One small palette for the languages bar; drives the same colours GitHub
// uses for the same languages so the chart "feels right" without us having
// to pick blindly.
const LANG_COLORS = {
  typescript: '#3178C6', javascript: '#F7DF1E', java: '#B07219',
  python: '#3572A5', c: '#555555', cpp: '#F34B7D', csharp: '#178600',
  go: '#00ADD8', rust: '#DEA584', kotlin: '#A97BFF', swift: '#F05138',
  shell: '#89E051', hcl: '#844FBA', dart: '#00B4AB', elixir: '#6E4A7E',
  erlang: '#B83998', dockerfile: '#384D54', html: '#E34C26', css: '#563D7C',
  sql: '#E38C00', php: '#777BB4', ruby: '#701516', scala: '#C22D40',
}

export default function DashboardMode({ payload, onSelect }) {
  if (!payload?.cards?.length) {
    return <div style={empty}>No data to summarise for this lens.</div>
  }

  // Group cards into ordered sections. Cards without a section land last.
  const sectionOrder = []
  const bySection = new Map()
  payload.cards.forEach(c => {
    const k = c.section || ''
    if (!bySection.has(k)) { bySection.set(k, []); sectionOrder.push(k) }
    bySection.get(k).push(c)
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
      {sectionOrder.map(section => (
        <Section key={section} title={section} cards={bySection.get(section)} onSelect={onSelect} />
      ))}
    </div>
  )
}

function Section({ title, cards, onSelect }) {
  // Counters group into a tight grid; wide cards (breakdowns / top) stack.
  const counters = cards.filter(c => c.kind === 'counter')
  const wide     = cards.filter(c => c.kind !== 'counter')
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <h3 style={sectionTitle}>{title}</h3>
      )}
      {counters.length > 0 && (
        <div style={{
          display: 'grid', gap: 12, marginBottom: wide.length ? 16 : 0,
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        }}>
          {counters.map((c, i) => <CounterCard key={`c${i}`} card={c} />)}
        </div>
      )}
      {wide.length > 0 && (
        <div style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        }}>
          {wide.map((c, i) => (
            c.kind === 'breakdown' ? <BreakdownCard key={`b${i}`} card={c} onSelect={onSelect} />
            : c.kind === 'top'      ? <TopCard       key={`t${i}`} card={c} onSelect={onSelect} />
            : <UnknownCard key={`u${i}`} card={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function CounterCard({ card }) {
  const color = TONE_COLORS[card.tone] || 'var(--text-heading)'
  return (
    <div style={cardStyle}>
      <div style={cardLabel}>
        {card.icon && <span style={{ marginRight: 6 }}>{card.icon}</span>}
        {card.title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginTop: 6 }}>
        {Number(card.value).toLocaleString()}
      </div>
      {card.sub && <div style={cardSub}>{card.sub}</div>}
    </div>
  )
}

function BreakdownCard({ card, onSelect }) {
  const total = card.slices.reduce((s, x) => s + x.value, 0) || 1
  const max = Math.max(...card.slices.map(s => s.value), 1)
  const [expanded, setExpanded] = useState(null)

  return (
    <div style={{ ...cardStyle, padding: '14px 16px 16px' }}>
      <div style={cardLabel}>{card.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
        {card.slices.slice(0, 20).map(slice => {
          const isOpen = expanded === slice.label
          const color = slice.color || colorForSlice(card.title, slice.label)
          return (
            <div key={slice.label}>
              <div
                onClick={() => slice.members?.length ? setExpanded(isOpen ? null : slice.label) : null}
                style={{
                  display: 'grid', gridTemplateColumns: '12px 130px 1fr 32px',
                  alignItems: 'center', gap: 8,
                  padding: '3px 4px', borderRadius: 4,
                  cursor: slice.members?.length ? 'pointer' : 'default',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
                  {slice.members?.length ? (isOpen ? '▼' : '▶') : ''}
                </span>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: isOpen ? 'var(--text-heading)' : 'var(--text-muted)',
                  fontWeight: isOpen ? 600 : 400,
                  textAlign: 'right',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={slice.label}>{slice.label}</span>
                <div style={{
                  height: 18, background: 'var(--surface-raised)',
                  borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(slice.value / max) * 100}%`, height: '100%',
                    background: color, borderRadius: 4,
                    transition: 'width 280ms ease',
                  }} />
                </div>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)', textAlign: 'right',
                }}>{slice.value}</span>
              </div>
              {isOpen && slice.members?.length > 0 && (
                <div style={{
                  marginLeft: 28, padding: '4px 0 8px',
                  borderLeft: `2px solid ${color}`,
                  paddingLeft: 12,
                }}>
                  {slice.members.slice(0, 80).map(m => (
                    <button key={m.id}
                      onClick={(e) => { e.stopPropagation(); onSelect?.(m) }}
                      style={memberRow}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-heading)' }}>
                        {m.label || m.id}
                      </span>
                      {m.kind && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.kind}</span>
                      )}
                    </button>
                  ))}
                  {slice.members.length > 80 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 6px' }}>
                      +{slice.members.length - 80} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {card.slices.length > 20 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            +{card.slices.length - 20} more
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
        {card.slices.length} value{card.slices.length === 1 ? '' : 's'} · {total} total
      </div>
    </div>
  )
}

function TopCard({ card, onSelect }) {
  return (
    <div style={cardStyle}>
      <div style={cardLabel}>{card.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
        {card.rows.map((r, i) => (
          <button
            key={r.id}
            onClick={() => onSelect?.({ id: r.id, name: r.id })}
            style={{
              display: 'grid', gridTemplateColumns: '20px 1fr auto',
              alignItems: 'center', gap: 8,
              padding: '6px 0', border: 'none', background: 'transparent',
              borderBottom: i < card.rows.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{
                display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-heading)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={r.label}>{r.label}</span>
              {r.sub && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.sub}</span>}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{r.value}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UnknownCard({ card }) {
  return (
    <div style={cardStyle}>
      <div style={cardLabel}>{card.title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        Unsupported card kind: {card.kind}
      </div>
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 10, padding: 16,
  display: 'flex', flexDirection: 'column',
}
const cardLabel = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: 0.4,
}
const cardSub = {
  fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
}
const sectionTitle = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  letterSpacing: 0.5, textTransform: 'uppercase',
  margin: '0 0 10px 0',
}
const memberRow = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '4px 6px', border: 'none',
  background: 'transparent', borderRadius: 4,
  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
}
const empty = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-muted)', fontSize: 13,
}
