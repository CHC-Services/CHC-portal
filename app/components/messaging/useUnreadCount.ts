'use client'

import { useEffect, useState } from 'react'

// No existing polling infra in this codebase to reuse — a small interval
// poll is the simplest fit for an unread badge at this app's scale.
export function useUnreadCount(intervalMs = 25000) {
  const [count, setCount] = useState(0)
  const [alertsOn, setAlertsOn] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/messages/preferences', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { notifyNewMessage: true }))
      .then(p => { if (!cancelled) setAlertsOn(p.notifyNewMessage !== false) })
      .catch(() => {})

    function pollCount() {
      fetch('/api/messages/unread-count', { credentials: 'include' })
        .then(r => (r.ok ? r.json() : { unreadCount: 0 }))
        .then(d => { if (!cancelled) setCount(d.unreadCount || 0) })
        .catch(() => {})
    }
    pollCount()
    const id = setInterval(pollCount, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [intervalMs])

  return { count, alertsOn }
}
