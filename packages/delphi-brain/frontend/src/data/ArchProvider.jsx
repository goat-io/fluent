/**
 * Architecture data — loaded from Brain API via React context.
 *
 * This file provides:
 * 1. ArchProvider — wraps the app, fetches data from Brain API
 * 2. useArch() — hook to access data in any component/hook
 * 3. Helper functions that work on the fetched data
 *
 * Zero hardcoded data. Brain API is the single source of truth.
 */

import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchArchitecture, fetchGraph } from '../api'

const ArchContext = createContext(null)

export function ArchProvider({ children }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['architecture'],
    queryFn: fetchArchitecture,
    staleTime: Infinity,
  })

  // Catalog v2: connections are no longer in /api/architecture — they're now
  // derived from each catalog entry's dependsOn array. We synthesize a
  // backward-compatible {from, to} list from the graph endpoint so existing
  // helpers (findConnectionsFor) keep working.
  const { data: graphData } = useQuery({
    queryKey: ['architecture-graph'],
    queryFn: fetchGraph,
    staleTime: Infinity,
  })

  const connections = useMemo(() => {
    const edges = graphData?.edges ?? []
    return edges.map(e => ({ from: e.source, to: e.target }))
  }, [graphData])

  const value = {
    services: data?.services ?? {},
    connections,
    databases: data?.databases ?? [],
    devices: data?.devices ?? [],
    personas: data?.personas ?? [],
    alarmFlows: data?.alarmFlows ?? {},
    infrastructure: data?.infrastructure ?? {},
    securityFindings: data?.securityFindings ?? [],
    targetState: data?.targetState ?? {},
    catalogPaths: data?.catalogPaths ?? {},
    glossary: data?.glossary ?? {},
    isLoading,
    error,
  }

  return <ArchContext.Provider value={value}>{children}</ArchContext.Provider>
}

export function useArch() {
  const ctx = useContext(ArchContext)
  if (!ctx) throw new Error('useArch must be used within ArchProvider')
  return ctx
}

// Convenience destructured hooks
export function useServices() { return useArch().services }
export function useConnections() { return useArch().connections }
export function useDatabases() { return useArch().databases }
export function useDevices() { return useArch().devices }
export function usePersonas() { return useArch().personas }
export function useAlarmFlows() { return useArch().alarmFlows }
export function useInfrastructure() { return useArch().infrastructure }
export function useSecurityFindings() { return useArch().securityFindings }
export function useTargetState() { return useArch().targetState }
export function useCatalogPaths() { return useArch().catalogPaths }
export function useGlossary() { return useArch().glossary }

// ─── Helper functions ───

export function findServiceById(services, id) {
  if (!services) return null
  for (const domain of Object.values(services)) {
    const svc = domain.services?.find(s => s.id === id)
    if (svc) return { ...svc, domain: domain.label, team: domain.team, hosting: domain.hosting }
  }
  // Check devices in the services object (some views use device IDs)
  return null
}

export function findConnectionsFor(connections, id) {
  if (!connections) return []
  return connections.filter(c => c.from === id || c.to === id)
}

export function findDatabasesFor(databases, id) {
  if (!databases) return []
  return databases.filter(d => d.service === id)
}
