'use client'

import { useEffect, useState } from 'react'
import ToggleRow from './ToggleRow'

// Self-contained: fetches and saves its own state, so it can be dropped
// into any of the three profile pages with no props. Controls only whether
// the Messaging nav badge shows an unread count or a plain dot — messages
// themselves can't be opted out of.
export default function MessagingPrefToggle() {
  const [checked, setChecked] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/messages/preferences', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setChecked(d.notifyNewMessage !== false))
      .finally(() => setLoaded(true))
  }, [])

  async function toggle(val: boolean) {
    setChecked(val)
    await fetch('/api/messages/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notifyNewMessage: val }),
    })
  }

  if (!loaded) return null

  return (
    <ToggleRow
      label="Email me when I receive a new message"
      desc="Off shows a plain dot on the Messaging tab instead of an unread count — messages still arrive either way."
      checked={checked}
      onChange={toggle}
    />
  )
}
