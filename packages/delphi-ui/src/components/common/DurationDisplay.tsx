export function DurationDisplay({ startedAt, completedAt }: { startedAt?: string | null; completedAt?: string | null }) {
  if (!startedAt) return <span className="text-gray-400 text-sm">—</span>

  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const ms = end - start

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  let display: string
  if (hours > 0) display = `${hours}h ${minutes % 60}m`
  else if (minutes > 0) display = `${minutes}m ${seconds % 60}s`
  else if (seconds > 0) display = `${seconds}.${String(ms % 1000).padStart(3, '0').replace(/0+$/, '')}s`
  else display = `${ms}ms`

  return <span className="text-sm tabular-nums text-gray-600">{display}</span>
}
