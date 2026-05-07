'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const REMINDER_CATEGORIES = [
  { value: 'license',   label: '📄 Professional License' },
  { value: 'medicaid',  label: '🏥 Medicaid Enrollment' },
  { value: 'bcbs',      label: '💳 BCBS / Insurance' },
  { value: 'npi',       label: '🔢 NPI Registration' },
  { value: 'insurance', label: '🛡️ Malpractice Insurance' },
  { value: 'general',   label: '📅 General Reminder' },
]

const DOC_CATEGORIES = ['General', 'License', 'Insurance', 'Contract', 'Tax', 'Other']

const URGENCY_LEVELS = ['Normal', 'Urgent', 'Low']

type RoutedForm = {
  id: string
  title: string
  category: string
  routedBy: string
  urgent: boolean
  status: string
  storageKey: string | null
  fileName: string | null
  createdAt: string
}

type NurseDocument = {
  id: string
  title: string
  fileName: string
  category: string
  fileSize: number | null
  mimeType: string | null
  expiresAt: string | null
  createdAt: string
}

type Reminder = {
  id: string
  title: string
  category: string
  dueDate: string
  notes?: string
  completed: boolean
}


function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


function fmtExpShort(expiresAt: string): { text: string; urgent: boolean; expired: boolean } {
  const d = new Date(expiresAt)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const yy = String(d.getUTCFullYear()).slice(2)
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return { text: `Exp ${mm}/${dd}/${yy}`, urgent: days <= 30, expired: days < 0 }
}

export default function NurseDocumentsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>({})
  const [documents, setDocuments] = useState<NurseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  // Routed forms state
  const [routedForms, setRoutedForms] = useState<RoutedForm[]>([])
  const [viewingForm, setViewingForm] = useState<string | null>(null)
  const [signModal, setSignModal] = useState<RoutedForm | null>(null)
  const [signFile, setSignFile] = useState<File | null>(null)
  const [signing, setSigning] = useState(false)
  const [signDone, setSignDone] = useState(false)

  // Upload state
  const [upFile, setUpFile] = useState<File | null>(null)
  const [upTitle, setUpTitle] = useState('')
  const [upCategory, setUpCategory] = useState('General')
  const [upUploading, setUpUploading] = useState(false)
  const [upMessage, setUpMessage] = useState('')
  const [upMessageIsError, setUpMessageIsError] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<{ presignData: any; file: File; title: string; category: string } | null>(null)

  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [reminderForm, setReminderForm] = useState({ title: '', category: 'general', dueDate: '', notes: '' })
  const [reminderAdding, setReminderAdding] = useState(false)
  const [showReminderForm, setShowReminderForm] = useState(false)

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'title' | 'date' | 'category'>('date')

  // Document inquiry modal
  const [showInquiry, setShowInquiry] = useState(false)
  const [inquiryForm, setInquiryForm] = useState({
    requestor: '',
    accountNumber: '',
    documentType: '',
    comments: '',
    requestDate: '',
    urgencyLevel: 'Normal',
  })
  const [inquirySending, setInquirySending] = useState(false)
  const [inquiryMessage, setInquiryMessage] = useState('')

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return } return r.json() })
      .then(data => {
        if (data) {
          setProfile(data.profile || {})
          const today = new Date().toISOString().split('T')[0]
          setInquiryForm(f => ({
            ...f,
            requestor: data.profile?.displayName || data.user?.name || '',
            accountNumber: data.profile?.accountNumber || '',
            requestDate: today,
          }))
        }
      })

    fetch('/api/nurse/documents', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setDocuments(data.documents || []); setLoading(false) })

    fetch('/api/nurse/reminders', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setReminders(data) })

    fetch('/api/nurse/routed-forms', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.forms)) setRoutedForms(data.forms) })
  }, [router])

  async function handleViewForm(form: RoutedForm) {
    if (!form.storageKey) return
    setViewingForm(form.id)
    try {
      const win = window.open('', '_blank')
      const res = await fetch(`/api/nurse/routed-forms/${form.id}`, { credentials: 'include' })
      const data = await res.json()
      if (data.url && win) win.location.href = data.url
    } finally {
      setViewingForm(null)
    }
  }

  async function handleSignReturn(e: React.FormEvent) {
    e.preventDefault()
    if (!signFile || !signModal) return
    setSigning(true)
    try {
      // Phase 1 — get presigned URL
      const p1 = await fetch(`/api/nurse/routed-forms/${signModal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ presign: true, fileName: signFile.name, contentType: signFile.type || 'application/octet-stream' }),
      })
      const { url, fields, storageKey } = await p1.json()

      // Phase 2 — upload to S3
      const fd = new FormData()
      Object.entries(fields as Record<string, string>).forEach(([k, v]) => fd.append(k, v))
      fd.append('file', signFile)
      await fetch(url, { method: 'POST', body: fd, mode: 'no-cors' })

      // Phase 3 — confirm
      await fetch(`/api/nurse/routed-forms/${signModal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ storageKey, fileName: signFile.name, fileSize: signFile.size, mimeType: signFile.type || null }),
      })

      setRoutedForms(prev => prev.map(f => f.id === signModal.id ? { ...f, status: 'signed' } : f))
      setSignDone(true)
      setSignFile(null)
    } finally {
      setSigning(false)
    }
  }

  function refreshDocuments() {
    fetch('/api/nurse/documents', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.documents)) setDocuments(data.documents) })
  }

  async function handleDownload(docId: string, fileName: string) {
    setDownloading(docId)
    try {
      const res = await fetch(`/api/nurse/documents/${docId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(null)
    }
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!upFile || !upTitle) return
    setUpUploading(true)
    setUpMessage('')
    setUpMessageIsError(false)
    try {
      const presignRes = await fetch('/api/nurse/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: upFile.name, contentType: upFile.type || 'application/octet-stream', category: upCategory }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) {
        setUpMessage(`Upload Failed: ${presignData.error || 'Could not get upload URL.'}`)
        setUpMessageIsError(true)
        setUpUploading(false)
        return
      }
      setPendingUpload({ presignData, file: upFile, title: upTitle, category: upCategory })
      setShowSharePrompt(true)
    } catch (err: any) {
      setUpMessage(`Upload Failed: ${err?.message || 'Network error.'}`)
      setUpMessageIsError(true)
    }
    setUpUploading(false)
  }

  async function completeUpload(sharedWithAdmin: boolean) {
    if (!pendingUpload) return
    const { presignData, file, title, category } = pendingUpload
    setShowSharePrompt(false)
    setPendingUpload(null)
    setUpUploading(true)
    try {
      const formData = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v))
      formData.append('file', file)
      await fetch(presignData.url, { method: 'POST', body: formData, mode: 'no-cors' })

      const confirmRes = await fetch('/api/nurse/documents/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nurseId: presignData.nurseId, title, storageKey: presignData.storageKey, fileName: file.name, fileSize: file.size, mimeType: file.type || null, category, sharedWithAdmin }),
      })
      const confirmData = await confirmRes.json()
      if (confirmData.ok) {
        setUpMessage(sharedWithAdmin ? 'Document uploaded and shared with Coming Home Care for review.' : 'Document uploaded successfully.')
        setUpMessageIsError(false)
        setUpFile(null); setUpTitle(''); setUpCategory('General')
        refreshDocuments()
      } else {
        setUpMessage(`Upload Failed: ${confirmData.error || 'File uploaded but record not saved.'}`)
        setUpMessageIsError(true)
      }
    } catch (err: any) {
      setUpMessage(`Upload Failed: ${err?.message || 'Network error.'}`)
      setUpMessageIsError(true)
    }
    setUpUploading(false)
  }

  async function addReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!reminderForm.title || !reminderForm.dueDate) return
    setReminderAdding(true)
    const res = await fetch('/api/nurse/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(reminderForm),
    })
    const data = await res.json()
    if (res.ok) {
      setReminders(prev => [...prev, data].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()))
      setReminderForm({ title: '', category: 'general', dueDate: '', notes: '' })
      setShowReminderForm(false)
    }
    setReminderAdding(false)
  }

  async function toggleReminder(id: string, completed: boolean) {
    await fetch(`/api/nurse/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ completed }) })
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed } : r))
  }

  async function deleteReminder(id: string) {
    await fetch(`/api/nurse/reminders/${id}`, { method: 'DELETE', credentials: 'include' })
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  async function submitInquiry(e: React.FormEvent) {
    e.preventDefault()
    setInquirySending(true)
    setInquiryMessage('')
    const res = await fetch('/api/nurse/document-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(inquiryForm),
    })
    if (res.ok) {
      setInquiryMessage('Your request has been submitted.')
      setTimeout(() => { setShowInquiry(false); setInquiryMessage('') }, 2000)
    } else {
      setInquiryMessage('Failed to send. Please try again.')
    }
    setInquirySending(false)
  }

  // Filtered + sorted documents
  const categories = Array.from(new Set(documents.map(d => d.category))).sort()
  const filteredDocs = documents
    .filter(d => {
      const q = searchQuery.toLowerCase()
      if (q && !d.title.toLowerCase().includes(q) && !d.category.toLowerCase().includes(q) && !d.fileName.toLowerCase().includes(q)) return false
      if (filterCategory !== 'All' && d.category !== filterCategory) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'category') return a.category.localeCompare(b.category)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const pendingForms = routedForms.filter(f => f.status === 'pending')
  const hasPending = pendingForms.length > 0

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Documents
        </h1>
        <p className="text-xs text-[#7A8F79] mt-0.5">Documents on file with Coming Home Care.</p>
      </div>

      {/* ── Pending Documents — always visible ── */}
      <div className={`rounded-xl shadow mb-4 overflow-hidden border ${hasPending ? 'border-[#7B1C1C]/30' : 'border-[#C5D4C3]'}`}>
        {/* Header */}
        <div className={`px-4 py-2.5 flex items-center justify-between ${hasPending ? 'bg-[#2F3E4E]' : 'bg-[#2F3E4E]'}`}>
          <h2 className={`text-sm font-bold uppercase tracking-widest ${hasPending ? 'text-[#c0392b]' : 'text-[#C5D4C3]'}`}>
            Pending Documents
          </h2>
          {hasPending && (
            <span className="text-[10px] font-bold bg-[#7B1C1C] text-white px-2 py-0.5 rounded-full">
              {pendingForms.length} awaiting signature
            </span>
          )}
        </div>

        {/* Table */}
        <div className="bg-white">
          {!hasPending ? (
            <p className="text-xs text-[#7A8F79] italic px-4 py-3">No documents pending — you're all caught up.</p>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto] gap-0 border-b border-[#D9E1E8] bg-[#F4F6F5]">
                {['Document Name', 'Category', 'Date Received', 'Sent By', '!', '', ''].map((h, i) => (
                  <div key={i} className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[#7A8F79]">{h}</div>
                ))}
              </div>
              {/* Rows */}
              <div className="divide-y divide-[#D9E1E8]">
                {pendingForms.map(form => (
                  <div key={form.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto] gap-0 items-center hover:bg-[#FAFBFC]">
                    <div className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-[#2F3E4E]">{form.title}</p>
                    </div>
                    <div className="px-3 py-2.5">
                      <span className="text-xs text-[#7A8F79]">{form.category}</span>
                    </div>
                    <div className="px-3 py-2.5">
                      <span className="text-xs text-[#7A8F79] font-mono">
                        {new Date(form.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: '2-digit' })}
                      </span>
                    </div>
                    <div className="px-3 py-2.5">
                      <span className="text-xs text-[#7A8F79]">{form.routedBy}</span>
                    </div>
                    <div className="px-3 py-2.5">
                      {form.urgent && <span className="text-[10px] font-bold text-white bg-[#7B1C1C] px-1.5 py-0.5 rounded uppercase">Urgent</span>}
                    </div>
                    <div className="px-2 py-2.5">
                      {form.storageKey ? (
                        <button
                          onClick={() => handleViewForm(form)}
                          disabled={viewingForm === form.id}
                          className="text-[11px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] px-2.5 py-1 rounded-lg transition disabled:opacity-50 whitespace-nowrap"
                        >
                          {viewingForm === form.id ? '…' : 'View'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#D9E1E8]">—</span>
                      )}
                    </div>
                    <div className="px-2 py-2.5 pr-3">
                      <button
                        onClick={() => { setSignModal(form); setSignDone(false); setSignFile(null) }}
                        className="text-[11px] font-bold text-white bg-[#2F3E4E] hover:bg-[#7A8F79] px-2.5 py-1 rounded-lg transition whitespace-nowrap"
                      >
                        Sign &amp; Return
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ── Col 1: Upload + myRenewals + Inquiry ── */}
        <div className="space-y-5">

          {/* Upload a Document */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[#2F3E4E]">Upload a Document</h2>
            <form onSubmit={handleUploadSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Title</label>
                <input
                  type="text"
                  value={upTitle}
                  onChange={e => setUpTitle(e.target.value)}
                  placeholder="e.g. RN License 2026"
                  required
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Category</label>
                <select
                  value={upCategory}
                  onChange={e => setUpCategory(e.target.value)}
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">File</label>
                <input
                  type="file"
                  onChange={e => setUpFile(e.target.files?.[0] || null)}
                  required
                  className="w-full text-sm text-[#2F3E4E] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition"
                />
              </div>
              <button
                type="submit"
                disabled={upUploading || !upFile || !upTitle}
                className="w-full bg-[#7A8F79] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
              >
                {upUploading ? 'Uploading…' : 'Upload Document'}
              </button>
              {upMessage && <p className={`text-sm ${upMessageIsError ? 'text-[#9B1C1C]' : 'text-[#7A8F79]'}`}>{upMessage}</p>}
            </form>
          </div>

          {/* myRenewals */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#2F3E4E]">
                  <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Renewals
                </h2>
                <p className="text-xs text-[#7A8F79] mt-0.5">Track license renewals and important dates.</p>
              </div>
              <button
                onClick={() => setShowReminderForm(!showReminderForm)}
                className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition"
              >
                {showReminderForm ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {showReminderForm && (
              <form onSubmit={addReminder} className="bg-[#F4F6F5] rounded-lg p-4 mb-5 space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Reminder Title</label>
                  <input type="text" placeholder="e.g. NY RN License Renewal" value={reminderForm.title} onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Category</label>
                    <select value={reminderForm.category} onChange={e => setReminderForm({ ...reminderForm, category: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                      {REMINDER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Due Date</label>
                    <input type="date" value={reminderForm.dueDate} onChange={e => setReminderForm({ ...reminderForm, dueDate: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Notes (optional)</label>
                  <input type="text" placeholder="e.g. Renew at nysed.gov/nursing" value={reminderForm.notes} onChange={e => setReminderForm({ ...reminderForm, notes: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                </div>
                <button type="submit" disabled={reminderAdding} className="w-full bg-[#7A8F79] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#657a64] transition disabled:opacity-50">
                  {reminderAdding ? 'Saving…' : 'Save Reminder'}
                </button>
              </form>
            )}

            {reminders.length === 0 ? (
              <p className="text-sm text-[#7A8F79] italic text-center py-4">No reminders yet — add a renewal deadline above.</p>
            ) : (
              <div className="space-y-2">
                {reminders.map(r => {
                  const due = new Date(r.dueDate)
                  const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  const overdue = daysLeft < 0
                  const urgent = daysLeft >= 0 && daysLeft <= 14
                  const catIcon = r.category === 'license' ? '📄' : r.category === 'medicaid' ? '🏥' : r.category === 'bcbs' ? '💳' : r.category === 'npi' ? '🔢' : r.category === 'insurance' ? '🛡️' : '📅'
                  return (
                    <div key={r.id} className={`flex items-start gap-3 rounded-lg px-4 py-3 border transition ${r.completed ? 'bg-gray-50 border-[#D9E1E8] opacity-60' : overdue ? 'bg-red-50 border-red-200' : urgent ? 'bg-amber-50 border-amber-200' : 'bg-[#F4F6F5] border-[#D9E1E8]'}`}>
                      <input type="checkbox" checked={r.completed} onChange={e => toggleReminder(r.id, e.target.checked)} className="mt-1 accent-[#7A8F79] w-4 h-4 cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${r.completed ? 'line-through text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>{catIcon} {r.title}</p>
                        <p className={`text-xs mt-0.5 font-medium ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-[#7A8F79]'}`}>
                          {overdue ? `Overdue by ${Math.abs(daysLeft)} days` : urgent ? `${daysLeft} days left` : due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {r.notes && <p className="text-xs text-[#7A8F79] mt-0.5">{r.notes}</p>}
                      </div>
                      <button onClick={() => deleteReminder(r.id)} className="text-[#D9E1E8] hover:text-red-400 transition text-sm mt-0.5" title="Delete reminder">✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Can't find a document? */}
          <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-[#2F3E4E]">Can't find the document you're looking for?</p>
            <p className="text-xs text-[#7A8F79]">Submit a request and we'll locate or provide it for you.</p>
            <button
              onClick={() => setShowInquiry(true)}
              className="w-full bg-[#7A8F79] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition"
            >
              Submit Inquiry
            </button>
          </div>

        </div>

        {/* ── Col 2+3: Document Library ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Search + filter bar */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48 space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by title, file name…"
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Category</label>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Sort By</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="date">Date Added</option>
                  <option value="title">Title (A–Z)</option>
                  <option value="category">Category</option>
                </select>
              </div>
            </div>
          </div>

          {/* Document list */}
          {loading ? (
            <div className="text-center text-[#7A8F79] py-16">Loading…</div>
          ) : filteredDocs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-[#2F3E4E] font-semibold">{documents.length === 0 ? 'No documents on file' : 'No documents match your search'}</p>
              <p className="text-[#7A8F79] text-sm mt-1">{documents.length === 0 ? 'Documents shared by your coordinator will appear here.' : 'Try adjusting your search or filter.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm divide-y divide-[#D9E1E8]">
              {filteredDocs.map(doc => {
                const exp = doc.expiresAt ? fmtExpShort(doc.expiresAt) : null
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold text-[#2F3E4E] truncate">{doc.title}</p>
                        {exp && (
                          <span className={`text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${exp.expired ? 'text-red-500' : exp.urgent ? 'text-orange-500' : 'text-[#7A8F79]'}`}>
                            {exp.text}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#7A8F79] truncate">
                        {doc.fileName}{doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(doc.id, doc.fileName)}
                      disabled={downloading === doc.id}
                      className="flex-shrink-0 text-[11px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      {downloading === doc.id ? 'Opening…' : 'View'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Share confirmation modal */}
      {showSharePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#2F3E4E]">Share with Coming Home Care?</h3>
            <p className="text-sm text-[#7A8F79] leading-relaxed">
              Would you like this file to be viewable by Coming Home Care admin for enrollment, billing, or other service needs?
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => completeUpload(false)} className="flex-1 border border-[#D9E1E8] text-[#2F3E4E] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F4F6F5] transition">No, keep private</button>
              <button onClick={() => completeUpload(true)} className="flex-1 bg-[#2F3E4E] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition">Yes, share for review</button>
            </div>
          </div>
        </div>
      )}

      {/* Document Inquiry Modal */}
      {showInquiry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#D9E1E8]">
              <h3 className="text-lg font-bold text-[#2F3E4E]">Document Request</h3>
              <button onClick={() => setShowInquiry(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">×</button>
            </div>
            <form onSubmit={submitInquiry} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Requestor</label>
                <input
                  type="text"
                  value={inquiryForm.requestor}
                  onChange={e => setInquiryForm({ ...inquiryForm, requestor: e.target.value })}
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Acct #</label>
                <input
                  type="text"
                  value={inquiryForm.accountNumber}
                  disabled
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] bg-gray-50"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Document Type</label>
                <input
                  type="text"
                  value={inquiryForm.documentType}
                  onChange={e => setInquiryForm({ ...inquiryForm, documentType: e.target.value })}
                  placeholder="e.g. Medicaid Enrollment Confirmation"
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Additional Comments</label>
                <textarea
                  value={inquiryForm.comments}
                  onChange={e => setInquiryForm({ ...inquiryForm, comments: e.target.value })}
                  placeholder="Any additional context or details…"
                  rows={3}
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Request Date</label>
                  <input
                    type="text"
                    value={inquiryForm.requestDate}
                    disabled
                    className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] bg-gray-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Urgency Level</label>
                  <select
                    value={inquiryForm.urgencyLevel}
                    onChange={e => setInquiryForm({ ...inquiryForm, urgencyLevel: e.target.value })}
                    className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  >
                    {URGENCY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              {inquiryMessage && (
                <p className={`text-sm font-semibold text-center ${inquiryMessage.includes('submitted') ? 'text-[#7A8F79]' : 'text-red-500'}`}>{inquiryMessage}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInquiry(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F4F6F5] transition">Cancel</button>
                <button type="submit" disabled={inquirySending} className="flex-1 bg-[#2F3E4E] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                  {inquirySending ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign & Return Modal */}
      {signModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            {signDone ? (
              <>
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#C5D4C3] flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-[#2F3E4E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-[#2F3E4E]">Document Submitted</h3>
                  <p className="text-sm text-[#7A8F79] leading-relaxed">
                    Your signed copy has been received. You can find it saved in your document library below.
                  </p>
                  <button
                    onClick={() => { setSignModal(null); setSignDone(false) }}
                    className="w-full bg-[#2F3E4E] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#2F3E4E]">Sign &amp; Return</h3>
                  <button onClick={() => setSignModal(null)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">×</button>
                </div>
                <p className="text-xs text-[#7A8F79]">
                  <span className="font-semibold text-[#2F3E4E]">{signModal.title}</span> — Upload your signed copy below. A copy will be saved to your documents and Coming Home Care will be notified.
                </p>
                <form onSubmit={handleSignReturn} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Signed Document</label>
                    <input
                      type="file"
                      required
                      onChange={e => setSignFile(e.target.files?.[0] || null)}
                      className="w-full mt-1 text-sm text-[#2F3E4E] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition"
                    />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setSignModal(null)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm font-semibold hover:bg-[#F4F6F5] transition">Cancel</button>
                    <button type="submit" disabled={signing || !signFile} className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                      {signing ? 'Submitting…' : 'Submit Signed Copy'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
