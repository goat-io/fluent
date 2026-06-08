/**
 * TableMode — dumb renderer for /api/scope/:lens/table.
 *
 * Server is the source of truth: columns, rows, facets, and total are all
 * pre-computed by `Scope.ToTable()` in Brain. The renderer only:
 *   - paints rows with the provided columns
 *   - lets the user click a facet value to narrow the visible set
 *   - lets the user search across cells
 *
 * No filtering logic, no aggregation, no business rules — those belong in the
 * lens predicate and projector on the backend.
 */
import { useState, useMemo } from 'react'
import { KindBadge, StatusBadge } from '../../lib/Badges.jsx'
import Pill from '../../lib/Pill.jsx'

export default function TableMode({ payload, onSelect }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(payload.columns[0]?.key || 'name')
  const [sortDir, setSortDir] = useState('asc')

  const visible = useMemo(() => {
    let rows = payload.rows
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        Object.values(r.cells).some(v => String(v ?? '').toLowerCase().includes(q))
      )
    }
    return [...rows].sort((a, b) => {
      const av = String(a.cells[sortKey] ?? '').toLowerCase()
      const bv = String(b.cells[sortKey] ?? '').toLowerCase()
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [payload.rows, search, sortKey, sortDir])

  const cycleSort = (key) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
    setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '6px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <input
          type="text" placeholder="Search rows…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 220px', maxWidth: 320,
            padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-sans)',
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)', color: 'var(--text)',
          }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {visible.length} of {payload.total}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 12,
          fontFamily: 'var(--font-sans)',
        }}>
          <thead style={{
            position: 'sticky', top: 0, zIndex: 1,
            background: 'var(--background)',
            borderBottom: '1px solid var(--border)',
          }}>
            <tr>
              {payload.columns.map(c => (
                <th key={c.key}
                  onClick={c.sortable ? () => cycleSort(c.key) : undefined}
                  style={{
                    textAlign: 'left', padding: '8px 12px',
                    fontWeight: 600, color: 'var(--text-muted)',
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4,
                    width: c.width || 'auto',
                    cursor: c.sortable ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}>
                  {c.label}
                  {sortKey === c.key && (
                    <span style={{ marginLeft: 4, opacity: 0.6 }}>
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.id}
                onClick={() => onSelect?.({ id: r.id, name: r.id, ...r.cells })}
                style={{
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {payload.columns.map(c => (
                  <td key={c.key} style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                    <Cell value={r.cells[c.key]} kind={c.kind} colKey={c.key} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Cell({ value, kind, colKey }) {
  if (value == null || value === '') return <span style={{ color: 'var(--text-muted)' }}>—</span>
  switch (kind) {
    case 'badge':
      if (colKey === 'kind')   return <KindBadge kind={value} />
      if (colKey === 'status') return <StatusBadge status={value} />
      return <span>{value}</span>
    case 'pill':
      return <Pill label={value} />
    case 'link':
      return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--text-heading)' }}>{value}</span>
    case 'mono':
      return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{value}</span>
    default:
      return <span>{value}</span>
  }
}
