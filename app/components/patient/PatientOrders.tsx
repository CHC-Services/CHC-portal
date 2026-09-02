'use client'

import { useEffect, useRef, useState } from 'react'
import DateInput from '../DateInput'
import { MEDICAL_SPECIALTIES, inp, lbl } from './types'

type PatientOrder = {
  id: string
  title: string
  fileName: string
  category: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
  uploadedByUserId: string
  uploadedByRole: string
  orderDate: string | null
  orderEndDate: string | null
  providerName: string | null
  specialty: string | null
  orderNotes: string | null
  recordedBy?: string
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${m}/${d}/${y}`
}

export default function PatientOrders({
  patientId, basePath, canDeleteAny, uploaderId = '',
}: {
  patientId: string
  basePath: string // e.g. `/api/nurse/patients/${id}/documents`
  canDeleteAny: boolean
  uploaderId?: string // required only when canDeleteAny is false
}) {
  const [orders, setOrders] = useState<PatientOrder[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [orderEndDate, setOrderEndDate] = useState('')
  const orderEndDateRef = useRef<HTMLInputElement>(null)
  const [providerName, setProviderName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function refresh() {
    fetch(basePath, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.documents)) {
          setOrders(data.documents.filter((d: PatientOrder) => d.category === 'Orders'))
        }
        setLoading(false)
      })
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, basePath])

  function resetForm() {
    setTitle(''); setOrderDate(''); setOrderEndDate(''); setProviderName(''); setSpecialty(''); setOrderNotes(''); setFile(null)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim() || !orderDate || !specialty) return
    setUploading(true)
    setMessage('')
    setMessageIsError(false)
    try {
      const presignRes = await fetch(`${basePath}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', category: 'Orders' }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) {
        setMessage(presignData.error || 'Could not get upload URL.')
        setMessageIsError(true)
        setUploading(false)
        return
      }

      const formData = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v))
      formData.append('file', file)
      await fetch(presignData.url, { method: 'POST', body: formData, mode: 'no-cors' })

      const confirmRes = await fetch(`${basePath}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(), storageKey: presignData.storageKey, fileName: file.name,
          fileSize: file.size, mimeType: file.type || null, category: 'Orders',
          orderDate, orderEndDate: orderEndDate || null, providerName: providerName || null,
          specialty, orderNotes: orderNotes || null,
        }),
      })
      const confirmData = await confirmRes.json()
      if (confirmData.ok) {
        setMessage('Order uploaded.')
        setMessageIsError(false)
        resetForm()
        refresh()
      } else {
        setMessage(confirmData.error || 'File uploaded but record not saved.')
        setMessageIsError(true)
      }
    } catch (err: any) {
      setMessage(err?.message || 'Network error.')
      setMessageIsError(true)
    }
    setUploading(false)
  }

  async function handleDownload(docId: string) {
    setDownloading(docId)
    try {
      const res = await fetch(`${basePath}/${docId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete(docId: string) {
    setDeleting(docId)
    try {
      await fetch(`${basePath}/${docId}`, { method: 'DELETE', credentials: 'include' })
      refresh()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <form onSubmit={handleUpload} className="bg-[#F4F6F5] rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={lbl}>Order Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inp} required />
            </div>
            <div>
              <label className={lbl}>Order Date *</label>
              <DateInput value={orderDate} onChange={e => setOrderDate(e.target.value)} className={inp} required nextRef={orderEndDateRef} />
            </div>
            <div>
              <label className={lbl}>End Date</label>
              <DateInput ref={orderEndDateRef} value={orderEndDate} onChange={e => setOrderEndDate(e.target.value)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Provider Name</label>
              <input value={providerName} onChange={e => setProviderName(e.target.value)} placeholder="e.g. Dr. Smith" className={inp} />
            </div>
            <div>
              <label className={lbl}>Related Specialty *</label>
              <select value={specialty} onChange={e => setSpecialty(e.target.value)} className={inp} required>
                <option value="">Select…</option>
                {MEDICAL_SPECIALTIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Order Notes</label>
            <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2}
              placeholder="Optional summary, clarifying information, or care plan goal…"
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
          </div>
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs text-[#2F3E4E]" required />
          <button type="submit" disabled={uploading || !file || !title.trim() || !orderDate || !specialty}
            className="w-full bg-[#2F3E4E] text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
            {uploading ? 'Uploading…' : 'Upload Order'}
          </button>
          {message && <p className={`text-[10px] ${messageIsError ? 'text-red-500' : 'text-green-600'}`}>{message}</p>}
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        {loading ? (
          <p className="text-xs text-[#7A8F79]">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-xs text-[#7A8F79] italic">No orders on file.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                  <th className="text-left py-2 px-3">Order Title</th>
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">End Date</th>
                  <th className="text-left py-2 px-3">Specialty</th>
                  <th className="text-left py-2 px-3">Provider</th>
                  <th className="text-left py-2 px-3">Order Notes</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const canDelete = canDeleteAny || o.uploadedByUserId === uploaderId
                  return (
                    <tr key={o.id} className="border-b border-[#D9E1E8] last:border-0 align-top">
                      <td className="py-2.5 px-3">
                        <p className="text-[#2F3E4E] font-medium">{o.title}</p>
                        {o.recordedBy && <p className="text-[10px] text-[#7A8F79] mt-0.5">Recorded by {o.recordedBy}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-[#2F3E4E]">{fmtDate(o.orderDate)}</td>
                      <td className="py-2.5 px-3 text-[#2F3E4E]">{fmtDate(o.orderEndDate)}</td>
                      <td className="py-2.5 px-3 text-[#2F3E4E]">{o.specialty || ''}</td>
                      <td className="py-2.5 px-3 text-[#2F3E4E]">{o.providerName || ''}</td>
                      <td className="py-2.5 px-3 text-[#2F3E4E]">{o.orderNotes || ''}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button onClick={() => handleDownload(o.id)} disabled={downloading === o.id}
                          className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-50 mr-3">
                          {downloading === o.id ? '…' : 'Download'}
                        </button>
                        {canDelete && (
                          <button onClick={() => handleDelete(o.id)} disabled={deleting === o.id}
                            className="text-xs font-semibold text-red-500 hover:text-red-600 transition disabled:opacity-50">
                            {deleting === o.id ? '…' : 'Delete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
