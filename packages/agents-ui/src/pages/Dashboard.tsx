import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgents } from '@/providers/AgentsProvider'
import { WorkflowList } from '@/components/workflow-list/WorkflowList'
import { StatusBadge } from '@/components/common/StatusBadge'
import { MetricsPanel } from '@/components/metrics/MetricsPanel'
import type { WorkflowRunSummary, WorkflowStatus } from '@/api/types'

export function Dashboard() {
  const { client } = useAgents()
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowRunSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.listWorkflows({ limit: 50 }).then(setWorkflows).finally(() => setLoading(false))
    const interval = setInterval(() => {
      client.listWorkflows({ limit: 50 }).then(setWorkflows)
    }, 5000)
    return () => clearInterval(interval)
  }, [client])

  const counts = {
    RUNNING: workflows.filter(w => w.status === 'RUNNING').length,
    COMPLETED: workflows.filter(w => w.status === 'COMPLETED').length,
    FAILED: workflows.filter(w => w.status === 'FAILED').length,
    WAITING_HUMAN: workflows.filter(w => w.status === 'WAITING_HUMAN').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Goat Agents Dashboard</h1>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/" className="text-gray-900 font-medium">Dashboard</a>
            <a href="/workers" className="text-gray-500 hover:text-gray-700">Workers</a>
            <a href="/designer" className="text-gray-500 hover:text-gray-700">Designer</a>
            <a
              href="/designer"
              className="ml-2 bg-blue-600 text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Create Workflow
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(Object.entries(counts) as [WorkflowStatus, number][]).map(([status, count]) => (
            <div key={status} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-2xl font-bold text-gray-900 tabular-nums">{count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Workflow List */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Runs</h2>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <WorkflowList
            workflows={workflows}
            onSelect={(runId) => navigate(`/workflows/${runId}`)}
          />
        )}
      </main>
    </div>
  )
}
