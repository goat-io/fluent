/**
 * ViewRendererContext — App.jsx provides a `renderView(tabKey)` function that
 * returns the JSX for any of its top-level views (target, business, poc-local,
 * poc-aws, …). DocumentsView uses it to render `kind: 'route'` library entries
 * inline in its right pane, so the user stays inside the Documents shell
 * (left file browser + DocumentShell chrome) instead of being kicked back out
 * to a sidebar-less full-screen view.
 *
 * This sits in lib/ so DocumentsView and DocumentShell can import without
 * pulling in App.jsx (which would create a circular dep).
 */
import { createContext, useContext } from 'react'

export const ViewRendererContext = createContext(null)

export function useViewRenderer() {
  return useContext(ViewRendererContext)
}
