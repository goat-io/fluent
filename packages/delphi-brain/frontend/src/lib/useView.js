/**
 * useView — single source of truth for the active top-level view, derived
 * from the URL pathname.
 *
 *   /                  → redirects to /catalog
 *   /catalog           → 'catalog'
 *   /documents         → 'documents'
 *   /target            → 'target' (legacy diagram routes)
 *   /poc-local         → 'poc-local'
 *   /business          → 'business'
 *   …
 *
 * setView('documents') navigates to `/documents` while preserving the
 * current `?search=` string so query-param state (doc, page, tab, lens, …)
 * survives a view switch.
 */
import { useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect } from 'react'

export function useView() {
  const location = useLocation()
  const navigate = useNavigate()

  const seg = location.pathname.replace(/^\//, '').split('/')[0]
  const view = seg || 'catalog'

  // Canonicalise root → /catalog (one-time replace so back-button doesn't loop).
  useEffect(() => {
    if (location.pathname === '/') {
      navigate({ pathname: '/catalog', search: location.search }, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  const setView = useCallback((next) => {
    if (!next) return
    const target = `/${next}`
    if (target === location.pathname) return
    navigate({ pathname: target, search: location.search })
  }, [location.pathname, location.search, navigate])

  return [view, setView]
}
