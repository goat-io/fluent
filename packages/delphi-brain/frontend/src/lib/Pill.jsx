/**
 * Generic colour-tinted pill — used by EntityDrawer for kind/layer/system
 * mini-tags above the description, and elsewhere where a one-off tinted
 * label is needed without the full Badge semantics.
 *
 * Differs from KindBadge: takes an explicit color, doesn't lookup any
 * registry. Use a Badge when the value comes from the catalog enum;
 * use Pill when you need ad-hoc styling.
 */
export default function Pill({ label, color = '#94A3B8' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 500, marginRight: 6,
      background: `${color}18`, color, border: `1px solid ${color}33`,
    }}>{label}</span>
  )
}
