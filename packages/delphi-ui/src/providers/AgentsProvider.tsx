import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { AgentsClient } from '../api/client'

interface AgentsContextValue {
  client: AgentsClient
  tenantId: string
}

const AgentsContext = createContext<AgentsContextValue | null>(null)

export function AgentsProvider({
  apiUrl,
  tenantId,
  authToken,
  children,
}: {
  apiUrl: string
  tenantId: string
  authToken?: string
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      client: new AgentsClient({ baseUrl: apiUrl, tenantId, authToken }),
      tenantId,
    }),
    [apiUrl, tenantId, authToken],
  )

  return (
    <AgentsContext.Provider value={value}>
      {children}
    </AgentsContext.Provider>
  )
}

export function useAgents(): AgentsContextValue {
  const ctx = useContext(AgentsContext)
  if (!ctx) {
    throw new Error('useAgents must be used within an AgentsProvider')
  }
  return ctx
}
