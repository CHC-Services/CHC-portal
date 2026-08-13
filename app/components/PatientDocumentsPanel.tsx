'use client'

import { useEffect, useState } from 'react'

type PatientDocument = {
  id: string
  title: string
  fileName: string
  category: string
  fileSize: number | null
  mimeType: string | null
  expiresAt: string | null
  createdAt: string
  uploadedByUserId: string
  uploadedByRole: string
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'

export default function PatientDocumentsPanel({
  patientId, basePath, canDeleteAny, uploaderId = '',
  fixedCategory, excludeCategory, label = 'Document',
}: {
  patientId: string
  basePath: string // e.g. `/api/nurse/patients/${id}/documents`
  canDeleteAny: boolean
  uploaderId?: string // required only when canDeleteAny is false
  fixedCategory?: string // when set, uploads always use this category and the list shows only this category (category input hidden)
  excludeCategory?: string // when set, the list hides documents with this category (used by the general Documents tab to keep fixedCategory tabs like Orders out)
  label?: string // singular noun for copy, e.g. 'Document' vs 'Order'
}) {
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(fixedCategory || 'General')
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
          const filtered = fixedCategory
            ? data.documents.filter((d: PatientDocument) => d.category === fixedCategory)
            : excludeCategory
              ? data.documents.filter((d: PatientDocument) => d.category !== excludeCategory)
              : data.documents
          setDocuments(filtered)
        }
        setLoading(false)
      })
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, basePath])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return
    setUploading(true)
    setMessage('')
    setMessageIsError(false)
    try {
      const presignRes = await fetch(`${basePath}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', category }),
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
          fileSize: file.size, mimeType: file.type || null, category,
        }),
      })
      const confirmData = await confirmRes.json()
      if (confirmData.ok) {
        setMessage(`${label} uploaded.`)
        setMessageIsError(false)
        setTitle(''); setCategory(fixedCategory || 'General'); setFile(null)
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
    <div className="space-y-4">
      <form onSubmit={handleUpload} className="bg-[#F4F6F5] rounded-xl p-3 space-y-2">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`${label} title`} className={inp} required />
        {!fixedCategory && (
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Category (e.g. Care Plan, PA Letter)" className={inp} />
        )}
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs text-[#2F3E4E]" required />
        <button type="submit" disabled={uploading || !file || !title.trim()}
          className="w-full bg-[#2F3E4E] text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
          {uploading ? 'Uploading…' : `Upload ${label}`}
        </button>
        {message && <p className={`text-[10px] ${messageIsError ? 'text-red-500' : 'text-green-600'}`}>{message}</p>}
      </form>

      {loading ? (
        <p className="text-xs text-[#7A8F79]">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-[#7A8F79] italic">No {label.toLowerCase()}s on file.</p>
      ) : (
        <div className="space-y-2">
          {documents.map(d => {
            const canDelete = canDeleteAny || d.uploadedByUserId === uploaderId
            return (
              <div key={d.id} className="border border-[#D9E1E8] rounded-lg p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#2F3E4E] truncate">{d.title}</p>
                  <p className="text-[10px] text-[#7A8F79]">
                    {d.category} {d.fileSize ? `· ${fmtSize(d.fileSize)}` : ''} · {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleDownload(d.id)} disabled={downloading === d.id}
                    className="text-[10px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-50">
                    {downloading === d.id ? '…' : 'Download'}
                  </button>
                  {canDelete && (
                    <button onClick={() => handleDelete(d.id)} disabled={deleting === d.id}
                      className="text-[10px] font-semibold text-red-500 hover:text-red-600 transition disabled:opacity-50">
                      {deleting === d.id ? '…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
