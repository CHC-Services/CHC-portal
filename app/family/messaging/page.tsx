'use client'

import { useEffect, useState } from 'react'
import MessagingPage from '../../components/messaging/MessagingPage'

export default function FamilyMessagingPage() {
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/family/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPatients((d.patients || []).map((p: any) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))))
      .catch(() => {})
  }, [])

  return <MessagingPage basePath="/family/messaging" patients={patients} />
}
