'use client'

import { useEffect, useState } from 'react'
import MessagingPage from '../../components/messaging/MessagingPage'

export default function NurseMessagingPage() {
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/nurse/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPatients((d.patients || []).map((p: any) => ({ id: p.patientId, name: `${p.merged.firstName} ${p.merged.lastName}` }))))
      .catch(() => {})
  }, [])

  return <MessagingPage basePath="/nurse/messaging" patients={patients} />
}
