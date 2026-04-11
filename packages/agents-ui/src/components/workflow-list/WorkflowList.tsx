import { StatusBadge } from '../common/StatusBadge'
import { DurationDisplay } from '../common/DurationDisplay'
import { RelativeTime } from '../common/RelativeTime'
import type { WorkflowRunSummary } from '@/api/types'

export function WorkflowList({
  workflows,
  onSelect,
}: {
  workflows: WorkflowRunSummary[]
  onSelect: (runId: string) => void
}) {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No workflow runs found
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Run ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workflow</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {workflows.map(wf => (
            <tr
              key={wf.id}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onSelect(wf.id)}
            >
              <td className="px-4 py-3 text-sm font-mono text-gray-600">
                {wf.id.substring(0, 12)}...
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {wf.workflowName}
                <span className="ml-1 text-xs text-gray-400">v{wf.workflowVersion}</span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={wf.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${wf.stepCount > 0 ? (wf.completedStepCount / wf.stepCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {wf.completedStepCount}/{wf.stepCount}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <DurationDisplay startedAt={wf.startedAt} completedAt={wf.completedAt} />
              </td>
              <td className="px-4 py-3">
                <RelativeTime date={wf.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
