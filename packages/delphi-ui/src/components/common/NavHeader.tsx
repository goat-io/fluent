import { useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/workers', label: 'Workers' },
]

export function NavHeader({ title, actions }: { title?: string; actions?: React.ReactNode }) {
  const location = useLocation()

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
            {title ?? 'Goat Agents'}
          </h1>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}
