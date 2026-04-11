import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AgentsProvider } from './providers/AgentsProvider'
import { Dashboard } from './pages/Dashboard'
import { WorkflowRun } from './pages/WorkflowRun'
import { Workers } from './pages/Workers'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? 'default'

export function App() {
  return (
    <AgentsProvider apiUrl={API_URL} tenantId={TENANT_ID}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workflows/:runId" element={<WorkflowRun />} />
          <Route path="/workers" element={<Workers />} />
        </Routes>
      </BrowserRouter>
    </AgentsProvider>
  )
}
