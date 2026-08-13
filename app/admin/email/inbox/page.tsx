'use client'

import { useEffect, useState } from 'react'
import MessagingPage from '../../../components/messaging/MessagingPage'
import AdminNav from '../../../components/AdminNav'

export default function AdminInboxPage() {
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/admin/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPatients((d.patients || []).map((p: any) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))))
      .catch(() => {})
  }, [])

  return <MessagingPage basePath="/admin/email/inbox" patients={patients} prefix="ad" title="Inbox" nav={<AdminNav />} />
}
