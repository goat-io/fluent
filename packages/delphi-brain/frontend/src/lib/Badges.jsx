/**
 * Shared badge primitives — single source for KindBadge / DomainBadge /
 * StatusBadge / LayerBadge across every view (Catalog, EntityDrawer,
 * DetailDrawer, LayeredDiagram, future views).
 *
 * Style canon: CatalogView's badges (the most polished today). Other views
 * that previously inlined their own copies were drifting in padding /
 * font-size / border alpha — those copies are removed in favour of these.
 *
 * Adding a new value (kind / domain / layer / lifecycle) → edit
 * `lib/badgeRegistry.js`. Zero changes here.
 */
import { kindOf, domainOf, statusOf, layerOf } from './badgeRegistry'

const tintStyle = (color, { round = 'sm', dot = false } = {}) => ({
  display: dot ? 'inline-flex' : 'inline-block',
  alignItems: dot ? 'center' : undefined,
  gap: dot ? 5 : undefined,
  padding: dot ? '2px 10px' : '2px 8px',
  borderRadius: round === 'pill' ? 9999 : 4,
  fontSize: dot ? 12 : 11,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  background: `${color}18`,
  color: color,
  border: `1px solid ${color}${dot ? '33' : '25'}`,
})

const Dot = ({ color }) => (
  <span style={{
    width: 6, height: 6, borderRadius: '50%',
    background: color, flexShrink: 0,
  }} />
)

export function KindBadge({ kind, withIcon = true }) {
  const cfg = kindOf(kind)
  return (
    <span style={tintStyle(cfg.color)}>
      {withIcon && cfg.icon ? `${cfg.icon} ` : ''}{cfg.label}
    </span>
  )
}

export function DomainBadge({ domain }) {
  const cfg = domainOf(domain)
  return (
    <span style={tintStyle(cfg.color)}>
      {domain}
    </span>
  )
}

export function StatusBadge({ status }) {
  const cfg = statusOf(status)
  return (
    <span style={tintStyle(cfg.color, { round: 'pill', dot: true })}>
      <Dot color={cfg.color} />
      {cfg.label}
    </span>
  )
}

export function LayerBadge({ layer }) {
  const cfg = layerOf(layer)
  return (
    <span style={tintStyle(cfg.color)}>
      {cfg.label}
    </span>
  )
}
