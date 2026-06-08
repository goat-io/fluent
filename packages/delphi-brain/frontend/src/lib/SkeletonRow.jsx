/**
 * Skeleton table row — placeholder while async data is loading.
 *
 * Style canon: CatalogView's SkeletonRow.
 */
export default function SkeletonRow({ widths = [140, 80, 100, 120, 90, 80] }) {
  return (
    <tr>
      {widths.map((w, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <div className="skeleton" style={{ height: 14, width: w, borderRadius: 4 }} />
        </td>
      ))}
    </tr>
  )
}
