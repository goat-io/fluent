/**
 * Generic ReactFlow node helpers — used by every diagram in the app.
 *
 * Pure functions returning ReactFlow node objects. No company-specific
 * vocabulary (no company-specific devices or colours hard-coded).
 */

/** Lay out items in a column-major grid. */
export function layoutGrid(items, startX, startY, colWidth, rowHeight, maxPerCol) {
  return items.map((item, i) => ({
    ...item,
    position: {
      x: startX + Math.floor(i / maxPerCol) * colWidth,
      y: startY + (i % maxPerCol) * rowHeight,
    },
  }))
}

/** Background "zone" rectangle that groups other nodes. */
export const zone = (id, x, y, w, h, label, sublabel, color) => ({
  id, type: 'zone', position: { x, y },
  data: { label, sublabel, width: w, height: h, bg: `${color}06`, borderColor: `${color}15`, labelColor: color },
  draggable: false, selectable: false, zIndex: -1,
})

/** Generic service node. */
export const svc = (id, x, y, label, desc, accent, border, opts = {}) => ({
  id, type: 'service', position: { x, y }, data: {
    label, description: desc,
    borderColor: border, accentColor: accent, iconBg: `${accent}11`,
    ...opts,
  },
})
