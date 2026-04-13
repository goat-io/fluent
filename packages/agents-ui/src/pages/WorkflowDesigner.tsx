import { useNavigate } from 'react-router-dom'
import { WorkflowEditor } from '@/components/workflow-editor/WorkflowEditor'

export function WorkflowDesigner() {
  const navigate = useNavigate()

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900">Workflow Designer</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Visual Editor
            </span>
          </div>
          <nav className="flex gap-4 text-sm">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/workers')}
              className="text-gray-500 hover:text-gray-700"
            >
              Workers
            </button>
            <span className="text-gray-900 font-medium">Designer</span>
          </nav>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <WorkflowEditor />
      </div>
    </div>
  )
}
