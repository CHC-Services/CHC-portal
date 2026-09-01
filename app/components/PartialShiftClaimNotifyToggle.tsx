'use client'

import { useEffect, useState } from 'react'
import ToggleRow from './ToggleRow'

// Self-contained, mirrors MessagingPrefToggle.tsx. Interim admin-testing
// toggle for the partial-shift-claim notification — long-term plan is
// nurse+family only (see lib/notificationCatalog.ts's partial-shift-*
// entries), so this component and its API route are expected to go away
// once the feature's proven out.
export default function PartialShiftClaimNotifyToggle() {
  const [checked, setChecked] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/admin/notification-preferences', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setChecked(d.notifyPartialShiftClaim !== false))
      .finally(() => setLoaded(true))
  }, [])

  async function toggle(val: boolean) {
    setChecked(val)
    await fetch('/api/admin/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notifyPartialShiftClaim: val }),
    })
  }

  if (!loaded) return null

  return (
    <ToggleRow
      label="Notify me when a nurse claims part of an open shift"
      desc="Interim testing toggle — email + text when a partial shift claim finalizes or needs approval. Long-term this notification is nurse + family only."
      checked={checked}
      onChange={toggle}
    />
  )
}
