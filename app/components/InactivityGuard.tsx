'use client'

import { useEffect, useRef } from 'react'

const INACTIVITY_MS = 10 * 60 * 1000
const TOUCH_INTERVAL_MS = 60 * 1000 // don't ping the server more than once a minute
const CHECK_INTERVAL_MS = 15 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

// PHI protection: logs the user out after 10 minutes with no mouse/keyboard/scroll
// activity, independent of the server-side idle check in middleware.ts (which only
// fires on navigation/API calls — this catches someone idling mid-page).
export default function InactivityGuard({ active }: { active: boolean }) {
  const lastActivityRef = useRef(Date.now())
  const lastTouchRef = useRef(Date.now())

  useEffect(() => {
    if (!active) return

    const markActive = () => { lastActivityRef.current = Date.now() }
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActive, { passive: true }))

    const interval = setInterval(async () => {
      const now = Date.now()
      const idleFor = now - lastActivityRef.current

      if (idleFor >= INACTIVITY_MS) {
        clearInterval(interval)
        await fetch('/api/logout', { method: 'POST', credentials: 'include' })
        window.location.href = '/login'
        return
      }

      if (now - lastTouchRef.current >= TOUCH_INTERVAL_MS) {
        lastTouchRef.current = now
        const res = await fetch('/api/session/touch', { method: 'POST', credentials: 'include' })
        if (res.status === 401) {
          clearInterval(interval)
          window.location.href = '/login'
        }
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActive))
      clearInterval(interval)
    }
  }, [active])

  return null
}
