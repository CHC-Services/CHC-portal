'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'

export default function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/invoices/${id}/s3`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(data => {
        if (data?.url) window.location.replace(data.url)
      })
      .catch(() => setError('Invoice not found'))
  }, [id, router])

  if (error) return <div className="p-8 text-red-500">{error}</div>
  return <div className="p-8 text-gray-500">Loading invoice PDF…</div>
}
