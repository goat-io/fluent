import { useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/designer', label: 'Designer' },
  { path: '/workers', label: 'Workers' },
  { path: '/schedules', label: 'Schedules' },
  { path: '/events', label: 'Events' },
]

export function NavHeader({ title, actions }: { title?: string; actions?: React.ReactNode }) {
  const location = useLocation()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{title ?? 'Goat Agents'}</h1>
        <nav className="flex items-center gap-4 text-sm">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={location.pathname === item.path ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}
            >
              {item.label}
            </a>
          ))}
          {actions}
        </nav>
      </div>
    </header>
  )
}
