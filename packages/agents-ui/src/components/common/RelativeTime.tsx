import { useEffect, useState } from 'react'

function getRelative(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then

  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function RelativeTime({ date }: { date: string }) {
  const [text, setText] = useState(() => getRelative(date))

  useEffect(() => {
    const timer = setInterval(() => setText(getRelative(date)), 30_000)
    return () => clearInterval(timer)
  }, [date])

  return (
    <time dateTime={date} title={new Date(date).toLocaleString()} className="text-sm text-gray-500">
      {text}
    </time>
  )
}
