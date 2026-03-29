'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '../../components/AdminNav'

type Nurse = { id: string; displayName: string; user: { email: string; name: string } | null }

export default function AdminDocumentsPage() {
  const router = useRouter()
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedNurses, setSelectedNurses] = useState<string[]>([])
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docTitle, setDocTitle] = useState('')
  const [docCategory, setDocCategory] = useState('General')
  const [docExpiry, setDocExpiry] = useState('')
  const [docReminderDays, setDocReminderDays] = useState<number[]>([])
  const [visibleToNurse, setVisibleToNurse] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/nurses', { credentials: 'include' }).then(r => {
        if (r.status === 401) { router.push('/login'); return [] }
        return r.json()
      }),
      fetch('/api/admin/document-categories', { credentials: 'include' }).then(r => r.json()),
    ]).then(([nursesData, catsData]) => {
      if (Array.isArray(nursesData)) setNurses(nursesData)
      if (Array.isArray(catsData?.categories)) setCategories(catsData.categories)
    }).finally(() => setLoading(false))
  }, [router])

  function toggleNurse(id: string) {
    setSelectedNurses(prev =>
      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
    )
  }

  function toggleAll() {
    setSelectedNurses(prev => prev.length === nurses.length ? [] : nurses.map(n => n.id))
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!docFile || !docTitle || selectedNurses.length === 0) return
    setUploading(true)
    setMessage('')
    setMessageIsError(false)

    try {
      // Step 1 — get presigned POST policy
      const presignRes = await fetch('/api/admin/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: docFile.name,
          contentType: docFile.type || 'application/octet-stream',
          nurseId: selectedNurses[0],
          category: docCategory,
        }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) {
        setMessage(`Upload Failed: ${presignData.error || 'Could not get upload URL.'}`)
        setMessageIsError(true)
        setUploading(false)
        return
      }

      // Step 2 — POST file directly to S3 (no CORS preflight)
      const formData = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) =>
        formData.append(k, v)
      )
      formData.append('file', docFile)
      await fetch(presignData.url, { method: 'POST', body: formData, mode: 'no-cors' })

      // Step 3 — save DB records for all selected nurses
      const confirmRes = await fetch('/api/admin/documents/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nurseIds: selectedNurses,
          title: docTitle,
          storageKey: presignData.storageKey,
          fileName: docFile.name,
          fileSize: docFile.size,
          mimeType: docFile.type || null,
          category: docCategory,
          expiresAt: docExpiry || null,
          reminderDays: docReminderDays,
          visibleToNurse,
        }),
      })
      const confirmData = await confirmRes.json()
      if (confirmData.ok) {
        const count = confirmData.count as number
        setMessage(`Document uploaded and assigned to ${count} nurse${count !== 1 ? 's' : ''}.`)
        setMessageIsError(false)
        setDocFile(null)
        setDocTitle('')
        setDocCategory('General')
        setDocExpiry('')
        setDocReminderDays([])
        setVisibleToNurse(false)
        setSelectedNurses([])
      } else {
        setMessage(`Upload Failed: ${confirmData.error || 'File uploaded but records not saved.'}`)
        setMessageIsError(true)
      }
    } catch (err: any) {
      setMessage(`Upload Failed: ${err?.message || 'Network error.'}`)
      setMessageIsError(true)
    }

    setUploading(false)
  }

  if (loading) return <div className="p-8 text-[#7A8F79]">Loading…</div>

  const allSelected = selectedNurses.length === nurses.length && nurses.length > 0

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">ad</span>Docs
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Upload a document and assign it to one or more providers.</p>
      </div>

      <AdminNav />

      <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Nurse selector */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">Assign To</h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {nurses.map(nurse => (
              <label key={nurse.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[#F4F6F5] transition">
                <input
                  type="checkbox"
                  checked={selectedNurses.includes(nurse.id)}
                  onChange={() => toggleNurse(nurse.id)}
                  className="accent-[#7A8F79] w-4 h-4 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2F3E4E] truncate">{nurse.displayName}</p>
                  <p className="text-xs text-[#7A8F79] truncate">{nurse.user?.email || ''}</p>
                </div>
              </label>
            ))}
          </div>
          {selectedNurses.length > 0 && (
            <p className="text-xs text-[#7A8F79] pt-1 border-t border-[#D9E1E8]">
              {selectedNurses.length} provider{selectedNurses.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Upload form */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">Document Details</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Document Title</label>
              <input
                type="text"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                placeholder="e.g. RN License 2026"
                required
                className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Category / Folder</label>
              <select
                value={docCategory}
                onChange={e => setDocCategory(e.target.value)}
                className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="General">General</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
                Expiration Date <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={docExpiry}
                onChange={e => setDocExpiry(e.target.value)}
                className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>
          </div>

          {docExpiry && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Email Reminders Before Expiry</label>
              <div className="flex flex-wrap gap-3">
                {[90, 60, 30, 14, 7, 1].map(days => (
                  <label key={days} className="flex items-center gap-1.5 text-sm text-[#2F3E4E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={docReminderDays.includes(days)}
                      onChange={e => setDocReminderDays(prev =>
                        e.target.checked ? [...prev, days] : prev.filter(d => d !== days)
                      )}
                      className="accent-[#7A8F79]"
                    />
                    {days === 1 ? '1 day' : `${days} days`}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={visibleToNurse}
              onChange={e => setVisibleToNurse(e.target.checked)}
              className="accent-[#7A8F79]"
            />
            <span className="text-sm text-[#2F3E4E]">Share with nurse (visible on their profile)</span>
          </label>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">File</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                onChange={e => setDocFile(e.target.files?.[0] || null)}
                required
                className="flex-1 text-sm text-[#2F3E4E] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition"
              />
              <button
                type="submit"
                disabled={uploading || !docFile || !docTitle || selectedNurses.length === 0}
                className="flex-shrink-0 bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : `Upload${selectedNurses.length > 1 ? ` (${selectedNurses.length})` : ''}`}
              </button>
            </div>
          </div>

          {message && (
            <p className={`text-sm ${messageIsError ? 'text-[#9B1C1C]' : 'text-[#7A8F79]'}`}>
              {message}
            </p>
          )}
        </div>

      </form>
    </div>
  )
}
