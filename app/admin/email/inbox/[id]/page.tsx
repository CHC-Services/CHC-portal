'use client'

import { useEffect, useState, use } from 'react'
import MessageDetail from '../../../../components/messaging/MessageDetail'

export default function AdminMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [userId, setUserId] = useState('')
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) setUserId(d.id) })
      .catch(() => {})
    fetch('/api/admin/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPatients((d.patients || []).map((p: any) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))))
      .catch(() => {})
  }, [])

  if (!userId) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  return (
    <MessageDetail
      messageId={id}
      backHref="/admin/email/inbox"
      backLabel="← adInbox"
      currentUserId={userId}
      patients={patients}
    />
  )
}
