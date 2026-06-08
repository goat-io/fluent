import { useEffect, useState } from 'react'
import { fetchEntity, fetchCostByEntity } from '../api'
import { KindBadge, LayerBadge } from './Badges.jsx'
import Section from './Section.jsx'
import Pill from './Pill.jsx'

/**
 * EntityDrawer — universal entity panel from Phase 6 stitcher.
 *
 * Per PROPOSAL_GENERIC_TREE.md §8.4, sections render only for relations the
 * entity actually has. A `kind: team` shows different sections from a
 * `kind: dataAsset` because their stitched edges differ — no per-kind branches
 * in this component, just relation grouping.
 *
 * Navigation stack: clicking any related entry opens a new drawer pushed onto
 * the stack; "back" pops it.
 */
export default function EntityDrawer({ name: initialName, onClose }) {
  const [stack, setStack] = useState([initialName])
  const current = stack[stack.length - 1]

  return (
    <div style={drawer}>
      <header style={header}>
        <button onClick={() => stack.length > 1 ? setStack(s => s.slice(0, -1)) : onClose?.()}
                style={btn} title={stack.length > 1 ? 'Back' : 'Close'}>
          {stack.length > 1 ? '← Back' : '× Close'}
        </button>
        {stack.length > 1 && (
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {stack.slice(0, -1).join(' › ')} ›
          </span>
        )}
      </header>
      <EntityBody name={current} onOpenChild={n => setStack(s => [...s, n])} />
    </div>
  )
}

function EntityBody({ name, onOpenChild }) {
  const [entity, setEntity] = useState(null)
  const [cost, setCost] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setEntity(null); setError(null); setCost(null)
    fetchEntity(name)
      .then(d => { if (alive) setEntity(d) })
      .catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [name])

  useEffect(() => {
    if (!entity?.kind) return
    let alive = true
    fetchCostByEntity(entity.kind, entity.name, { from: '2026-01-01', to: '2026-12-31' })
      .then(d => { if (alive) setCost(d) })
    return () => { alive = false }
  }, [entity?.kind, entity?.name])

  if (error) return <div style={pad}>Error: {error}</div>
  if (!entity) return <div style={pad}>Loading…</div>

  // Group edges by relation; render every relation that has at least one edge.
  const outboundByRel = groupBy(entity.outbound, 'relation')
  const inboundByRel = groupBy(entity.inbound, 'relation')

  // Section ordering reflects the layer model: up first, sideways, down.
  const upRelations = ['memberOf', 'composedOf', 'realizes', 'componentRepos', 'objective']
  const sidewaysRelations = [
    'communicatesWith', 'integratesWith', 'classifiedAs', 'storedIn',
    'governs', 'measuredBy', 'boundsSlo', 'boundsComponent',
  ]
  // anything not in up/sideways is "down" (default bucket)
  const allRelations = new Set([
    ...Object.keys(outboundByRel), ...Object.keys(inboundByRel),
  ])
  const downRelations = [...allRelations].filter(
    r => !upRelations.includes(r) && !sidewaysRelations.includes(r)
  ).sort()

  return (
    <div style={pad}>
      <h3 style={{ margin: '0 0 4px 0' }}>{entity.name}</h3>
      <div style={meta}>
        <KindBadge kind={entity.kind} />
        {entity.layer && <LayerBadge layer={entity.layer} />}
        {entity.system && <Pill label={`system: ${entity.system}`} color="#10B981" />}
        {entity.domain && entity.kind === 'repo' && <Pill label={entity.domain} color="#F59E0B" />}
      </div>
      {entity.description && <p style={desc}>{entity.description}</p>}

      {cost?.rollup?.TotalEUR > 0 && (
        <Section title="Cost (2026 YTD)">
          <div style={{ fontSize: 14, color: '#10B981', fontWeight: 600 }}>
            €{cost.rollup.TotalEUR.toFixed(2)}
          </div>
          {cost.rollup.ByAccount?.map(a => (
            <div key={a.Account} style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
              {a.Account} — €{a.AmountEUR.toFixed(2)}
            </div>
          ))}
        </Section>
      )}

      {upRelations.filter(r => outboundByRel[r] || inboundByRel[r]).length > 0 && (
        <SectionGroup title="Up the tree">
          {upRelations.map(r => renderRelation(r, outboundByRel[r], inboundByRel[r], onOpenChild))}
        </SectionGroup>
      )}

      {sidewaysRelations.filter(r => outboundByRel[r] || inboundByRel[r]).length > 0 && (
        <SectionGroup title="Sideways">
          {sidewaysRelations.map(r => renderRelation(r, outboundByRel[r], inboundByRel[r], onOpenChild))}
        </SectionGroup>
      )}

      {downRelations.length > 0 && (
        <SectionGroup title="Down the tree">
          {downRelations.map(r => renderRelation(r, outboundByRel[r], inboundByRel[r], onOpenChild))}
        </SectionGroup>
      )}
    </div>
  )
}

function renderRelation(relation, outbound, inbound, onOpenChild) {
  if (!outbound && !inbound) return null
  return (
    <Section key={relation} title={relation}>
      {outbound?.map(e => (
        <Link key={`o${e.target}`} dir="→" name={e.target} kind={e.kind} meta={e.meta} onClick={onOpenChild} />
      ))}
      {inbound?.map(e => (
        <Link key={`i${e.source}`} dir="←" name={e.source} kind={e.kind} meta={e.meta} onClick={onOpenChild} />
      ))}
    </Section>
  )
}

function Link({ dir, name, kind, meta, onClick }) {
  const detail = meta?.protocol
    ? `${meta.protocol}${meta.port ? `:${meta.port}` : ''}${meta.purpose ? ` — ${meta.purpose}` : ''}`
    : meta?.purpose
  return (
    <div style={link} onClick={() => onClick(name)}>
      <span style={{ color: '#64748B', marginRight: 8 }}>{dir}</span>
      <span style={{ fontWeight: 500 }}>{name}</span>
      {kind && <span style={{ marginLeft: 8, fontSize: 10, color: '#94A3B8' }}>[{kind}]</span>}
      {detail && <span style={{ marginLeft: 8, fontSize: 11, color: '#64748B' }}>{detail}</span>}
    </div>
  )
}

function SectionGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={groupHeader}>{title}</div>
      {children}
    </div>
  )
}

function groupBy(arr, key) {
  if (!arr) return {}
  return arr.reduce((acc, x) => {
    (acc[x[key]] ||= []).push(x)
    return acc
  }, {})
}

const drawer = {
  position: 'fixed', right: 0, top: 0, bottom: 0, width: 480,
  background: '#0F172A', color: '#E2E8F0', borderLeft: '1px solid #1E293B',
  overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
  display: 'flex', flexDirection: 'column',
  zIndex: 1000,
}
const header = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 16px', borderBottom: '1px solid #1E293B',
  background: '#0F172A',
}
const btn = {
  background: 'transparent', color: '#E2E8F0', border: '1px solid #334155',
  padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
}
const pad = { padding: 16 }
const meta = { display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }
const desc = { fontSize: 13, color: '#CBD5E1', margin: '0 0 16px 0' }
const groupHeader = {
  fontSize: 12, fontWeight: 700, color: '#94A3B8',
  marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #1E293B',
}
const link = {
  padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
  fontSize: 12, color: '#E2E8F0', display: 'flex', alignItems: 'center',
}
