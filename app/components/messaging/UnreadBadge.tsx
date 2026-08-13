'use client'

import { useUnreadCount } from './useUnreadCount'

// Numeric badge when the user's email-alert preference is on; a plain dot
// (no count shown) when it's off — per spec, nobody can opt out of
// receiving messages, only of the count being tracked/displayed.
export default function UnreadBadge() {
  const { count, alertsOn } = useUnreadCount()
  if (count === 0) return null

  if (!alertsOn) {
    return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
  }

  return (
    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
      {count > 9 ? '9+' : count}
    </span>
  )
}
