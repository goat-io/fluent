/**
 * Shared section header used in DetailDrawer + EntityDrawer.
 *
 * Style canon: DetailDrawer's Section — caps + letter-spacing label,
 * 8 px gap to body. EntityDrawer's local copy used a slightly different
 * font-size; that copy is removed.
 */
export default function Section({ title, children, dense = false }) {
  return (
    <div style={{ marginBottom: dense ? 12 : 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        marginBottom: dense ? 4 : 8,
      }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}
