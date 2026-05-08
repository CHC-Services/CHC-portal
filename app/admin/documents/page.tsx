'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '../../components/AdminNav'

type Nurse = { id: string; displayName: string; user: { email: string; name: string } | null }
type QueueDoc = { id: string; title: string; fileName: string; category: string; fileSize: number | null; createdAt: string; nurseId: string; nurse: { displayName: string } }
type LibDoc = { id: string; title: string; fileName: string; category: string; fileSize: number | null; mimeType: string | null; expiresAt: string | null; createdAt: string; nurseId: string; nurseUploaded: boolean; sharedWithAdmin: boolean; nurse: { displayName: string } }
type FormTemplate = { id: string; title: string; fileName: string; storageKey: string; fileSize: number | null; mimeType: string | null; createdAt: string }

export default function AdminDocumentsPage() {
  const router = useRouter()
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<QueueDoc[]>([])
  const [queueViewing, setQueueViewing] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibDoc[]>([])
  const [libViewing, setLibViewing] = useState<string | null>(null)
  const [libSearch, setLibSearch] = useState('')
  const [libNurseFilter, setLibNurseFilter] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // folder management
  const [newFolderName, setNewFolderName] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)
  const [folderDeleting, setFolderDeleting] = useState<string | null>(null)
  const [folderEditingId, setFolderEditingId] = useState<string | null>(null)
  const [folderEditName, setFolderEditName] = useState('')

  // edit modal
  const [editDoc, setEditDoc] = useState<LibDoc | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editExpiry, setEditExpiry] = useState('')
  const [editReminderDays, setEditReminderDays] = useState<number[]>([])
  const [editNurseId, setEditNurseId] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editMessage, setEditMessage] = useState('')

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

  // Route a Form state
  const FORM_TYPES = ['W-9', 'Assignment of Benefits', 'Signature on File', 'HIPAA Authorization', 'Direct Deposit', 'Other']
  const [rfNurseId, setRfNurseId] = useState('')
  const [rfTitle, setRfTitle] = useState('')
  const [rfCustomTitle, setRfCustomTitle] = useState('')
  const [rfCategory, setRfCategory] = useState('Form')
  const [rfUrgent, setRfUrgent] = useState(false)
  const [rfNotes, setRfNotes] = useState('')
  const [rfFile, setRfFile] = useState<File | null>(null)
  const [rfRouting, setRfRouting] = useState(false)
  const [rfMessage, setRfMessage] = useState('')
  const [rfMessageIsError, setRfMessageIsError] = useState(false)
  const [routedForms, setRoutedForms] = useState<{ id: string; title: string; category: string; urgent: boolean; status: string; routedBy: string; createdAt: string; nurse: { displayName: string } }[]>([])

  // Form Templates state
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([])
  const [ftFile, setFtFile] = useState<File | null>(null)
  const [ftTitle, setFtTitle] = useState('')
  const [ftUploading, setFtUploading] = useState(false)
  const [ftMessage, setFtMessage] = useState('')
  const [ftMessageIsError, setFtMessageIsError] = useState(false)
  const [ftViewing, setFtViewing] = useState<string | null>(null)
  const [ftDeleting, setFtDeleting] = useState<string | null>(null)
  const [rfUseTemplate, setRfUseTemplate] = useState(true)

  function fetchFormTemplates() {
    fetch('/api/admin/form-templates', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.templates)) setFormTemplates(data.templates) })
  }

  async function handleUploadTemplate(e: React.FormEvent) {
    e.preventDefault()
    const finalTitle = ftTitle.trim() || ftFile?.name || ''
    if (!ftFile || !finalTitle) return
    setFtUploading(true); setFtMessage(''); setFtMessageIsError(false)
    try {
      const presignRes = await fetch('/api/admin/form-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ presign: true, title: finalTitle, fileName: ftFile.name, contentType: ftFile.type || 'application/octet-stream' }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) { setFtMessage(presignData.error || 'Presign failed.'); setFtMessageIsError(true); return }

      const fd = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => fd.append(k, v))
      fd.append('file', ftFile)
      await fetch(presignData.url, { method: 'POST', body: fd, mode: 'no-cors' })

      const confirmRes = await fetch('/api/admin/form-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: finalTitle, storageKey: presignData.storageKey, fileName: ftFile.name, fileSize: ftFile.size, mimeType: ftFile.type || null }),
      })
      const confirmData = await confirmRes.json()
      if (confirmData.ok) {
        setFtMessage(`"${finalTitle}" saved to templates.`)
        setFtFile(null); setFtTitle('')
        fetchFormTemplates()
      } else {
        setFtMessage(confirmData.error || 'Failed to save template.'); setFtMessageIsError(true)
      }
    } catch (err: unknown) {
      setFtMessage((err as Error)?.message || 'Network error.'); setFtMessageIsError(true)
    }
    setFtUploading(false)
  }

  function fetchRoutedForms() {
    fetch('/api/admin/routed-forms', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.forms)) setRoutedForms(data.forms) })
  }

  function fetchQueue() {
    fetch('/api/admin/documents/queue', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.docs)) setQueue(data.docs) })
  }

  function fetchLibrary() {
    fetch('/api/admin/documents?all=1', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.documents)) {
          setLibrary(data.documents)
          // Default all folders open
          const folders = new Set(data.documents.map((d: LibDoc) => d.category) as string[])
          setExpandedFolders(folders)
        }
      })
  }

  function openEdit(doc: LibDoc) {
    setEditDoc(doc)
    setEditTitle(doc.title)
    setEditCategory(doc.category)
    setEditExpiry(doc.expiresAt ? doc.expiresAt.slice(0, 10) : '')
    setEditReminderDays([])
    setEditNurseId(doc.nurseId)
    setEditMessage('')
  }

  async function saveEdit() {
    if (!editDoc) return
    setEditSaving(true)
    setEditMessage('')
    const res = await fetch(`/api/admin/documents/${editDoc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: editTitle.trim(),
        category: editCategory.trim(),
        expiresAt: editExpiry || null,
        reminderDays: editReminderDays,
        nurseId: editNurseId,
      }),
    })
    if (res.ok) {
      setEditDoc(null)
      fetchLibrary()
    } else {
      const data = await res.json()
      setEditMessage(data.error || 'Save failed.')
    }
    setEditSaving(false)
  }

  async function handleAddFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name) return
    setFolderSaving(true)
    const res = await fetch('/api/admin/document-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setNewFolderName('')
      const data = await fetch('/api/admin/document-categories', { credentials: 'include' }).then(r => r.json())
      if (Array.isArray(data.categories)) setCategories(data.categories)
    }
    setFolderSaving(false)
  }

  async function handleRenameFolder(id: string) {
    const name = folderEditName.trim()
    if (!name) return
    const res = await fetch(`/api/admin/document-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setFolderEditingId(null)
      setFolderEditName('')
      const data = await fetch('/api/admin/document-categories', { credentials: 'include' }).then(r => r.json())
      if (Array.isArray(data.categories)) setCategories(data.categories)
    }
  }

  async function handleDeleteFolder(id: string) {
    setFolderDeleting(id)
    await fetch(`/api/admin/document-categories/${id}`, { method: 'DELETE', credentials: 'include' })
    setCategories(prev => prev.filter(c => c.id !== id))
    setFolderDeleting(null)
  }

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
    fetchQueue()
    fetchLibrary()
    fetchRoutedForms()
    fetchFormTemplates()
  }, [router])

  async function handleRouteForm(e: React.FormEvent) {
    e.preventDefault()
    const session = await fetch('/api/nurse/profile', { credentials: 'include' }).then(r => r.json()).catch(() => null)
    const routedBy = session?.user?.name || 'Admin'
    const finalTitle = rfTitle === 'Other' ? rfCustomTitle.trim() : rfTitle
    if (!rfNurseId || !finalTitle) return
    setRfRouting(true); setRfMessage(''); setRfMessageIsError(false)
    try {
      // Check if we should auto-attach a template
      const matchingTemplate = formTemplates.find(t => t.title === finalTitle)
      const useTemplate = rfUseTemplate && !!matchingTemplate && !rfFile

      const res = await fetch('/api/admin/routed-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nurseId: rfNurseId,
          title: finalTitle,
          category: rfCategory,
          urgent: rfUrgent,
          notes: rfNotes || null,
          routedBy,
          fileName: useTemplate ? null : (rfFile?.name || null),
          contentType: useTemplate ? null : (rfFile?.type || null),
          templateStorageKey: useTemplate ? matchingTemplate!.storageKey : null,
          templateFileName: useTemplate ? matchingTemplate!.fileName : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setRfMessage(data.error || 'Failed to route form.'); setRfMessageIsError(true); return }

      if (rfFile && data.presign) {
        const fd = new FormData()
        Object.entries(data.presign.fields as Record<string, string>).forEach(([k, v]) => fd.append(k, v))
        fd.append('file', rfFile)
        await fetch(data.presign.url, { method: 'POST', body: fd, mode: 'no-cors' })
      }

      setRfMessage(`Form routed to ${nurses.find(n => n.id === rfNurseId)?.displayName || 'provider'} — email sent.`)
      setRfNurseId(''); setRfTitle(''); setRfCustomTitle(''); setRfCategory('Form')
      setRfUrgent(false); setRfNotes(''); setRfFile(null); setRfUseTemplate(true)
      fetchRoutedForms()
    } catch (err: unknown) {
      setRfMessage((err as Error)?.message || 'Network error.'); setRfMessageIsError(true)
    }
    setRfRouting(false)
  }

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

      {/* Provider-Uploaded Document Queue */}
      {queue.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 mb-6">
          <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">Provider Document Queue</h2>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{queue.length} pending</span>
            </div>
            <button
              onClick={async () => {
                await fetch('/api/admin/documents/queue', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ all: true }) })
                setQueue([])
              }}
              className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition"
            >
              Mark All Reviewed
            </button>
          </div>
          <div className="space-y-2">
            {queue.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 bg-[#F4F6F5] rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[#2F3E4E] truncate">{doc.title}</p>
                    <span className="text-[10px] font-semibold bg-[#D9E1E8] text-[#2F3E4E] px-1.5 py-0.5 rounded-full">{doc.category}</span>
                  </div>
                  <p className="text-xs text-[#7A8F79]">
                    {doc.nurse.displayName} · {new Date(doc.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[11px] text-[#7A8F79] truncate">{doc.fileName}</p>
                </div>
                <a
                  href={`/admin/nurse/${doc.nurseId}`}
                  className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] px-2 py-1 rounded transition"
                >
                  View Profile
                </a>
                <button
                  onClick={async () => {
                    // Open presigned download URL
                    setQueueViewing(doc.id)
                    const res = await fetch(`/api/admin/documents/${doc.id}`, { credentials: 'include' })
                    const data = await res.json()
                    if (data.url) window.open(data.url, '_blank')
                    setQueueViewing(null)
                  }}
                  disabled={queueViewing === doc.id}
                  className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] px-2 py-1 rounded transition disabled:opacity-50"
                >
                  {queueViewing === doc.id ? '…' : 'View'}
                </button>
                <button
                  onClick={async () => {
                    await fetch('/api/admin/documents/queue', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id: doc.id }) })
                    setQueue(prev => prev.filter(d => d.id !== doc.id))
                  }}
                  className="text-xs text-green-600 hover:text-green-800 border border-green-200 px-2 py-1 rounded transition"
                >
                  ✓ Done
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Column 1: Manage Folders ── */}
        <div className="space-y-4 lg:col-span-1">

          {/* Manage Folders */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
              Manage Folders
            </h2>
            <div className="space-y-1">
              {categories.length === 0 && (
                <p className="text-sm text-[#7A8F79] italic">No custom folders yet.</p>
              )}
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-2 py-1">
                  {folderEditingId === c.id ? (
                    <>
                      <input
                        type="text"
                        value={folderEditName}
                        onChange={e => setFolderEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRenameFolder(c.id) } if (e.key === 'Escape') { setFolderEditingId(null) } }}
                        autoFocus
                        className="flex-1 border border-[#7A8F79] px-2 py-1 rounded text-sm text-[#2F3E4E] focus:outline-none"
                      />
                      <button type="button" onClick={() => handleRenameFolder(c.id)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">Save</button>
                      <button type="button" onClick={() => setFolderEditingId(null)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-[#2F3E4E]">📁 {c.name}</span>
                      <button
                        type="button"
                        onClick={() => { setFolderEditingId(c.id); setFolderEditName(c.name) }}
                        className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(c.id)}
                        disabled={folderDeleting === c.id}
                        className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-40"
                      >
                        {folderDeleting === c.id ? '…' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleAddFolder} className="flex gap-2 pt-1 border-t border-[#D9E1E8]">
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="New folder name"
                className="flex-1 border border-[#D9E1E8] px-3 py-1.5 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <button
                type="submit"
                disabled={folderSaving || !newFolderName.trim()}
                className="bg-[#7A8F79] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
              >
                {folderSaving ? '…' : 'Add'}
              </button>
            </form>
          </div>

          {/* Form Templates */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">Form Templates</h2>
            <p className="text-[10px] text-[#7A8F79]">Store one blank copy per form type. Templates auto-attach when routing.</p>

            {/* Existing templates */}
            {formTemplates.length > 0 && (
              <div className="divide-y divide-[#D9E1E8] border border-[#D9E1E8] rounded-lg overflow-hidden">
                {formTemplates.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5">
                    <span className="flex-1 text-xs font-semibold text-[#2F3E4E] truncate">📄 {t.title}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setFtViewing(t.id)
                        const win = window.open('', '_blank')
                        const res = await fetch(`/api/admin/form-templates/${t.id}`, { credentials: 'include' })
                        const data = await res.json()
                        if (data.url && win) win.location.href = data.url
                        setFtViewing(null)
                      }}
                      disabled={ftViewing === t.id}
                      className="text-[10px] text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] px-1.5 py-0.5 rounded transition disabled:opacity-50"
                    >
                      {ftViewing === t.id ? '…' : 'View'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete template "${t.title}"?`)) return
                        setFtDeleting(t.id)
                        await fetch(`/api/admin/form-templates/${t.id}`, { method: 'DELETE', credentials: 'include' })
                        fetchFormTemplates()
                        setFtDeleting(null)
                      }}
                      disabled={ftDeleting === t.id}
                      className="text-[10px] text-red-400 hover:text-red-600 border border-red-100 px-1.5 py-0.5 rounded transition disabled:opacity-50"
                    >
                      {ftDeleting === t.id ? '…' : '✕'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new template */}
            <form onSubmit={handleUploadTemplate} className="space-y-1.5 pt-1 border-t border-[#D9E1E8]">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Template Name</label>
                <select
                  value={ftTitle}
                  onChange={e => setFtTitle(e.target.value)}
                  className="w-full border border-[#D9E1E8] px-2 py-1 rounded-lg text-xs text-[#2F3E4E] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="">Select form type…</option>
                  {FORM_TYPES.filter(t => t !== 'Other').map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  onChange={e => setFtFile(e.target.files?.[0] || null)}
                  className="flex-1 text-[10px] text-[#2F3E4E] file:mr-1.5 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition"
                />
                <button
                  type="submit"
                  disabled={ftUploading || !ftFile || !ftTitle}
                  className="flex-shrink-0 bg-[#7A8F79] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold hover:bg-[#2F3E4E] transition disabled:opacity-50"
                >
                  {ftUploading ? '…' : 'Save'}
                </button>
              </div>
              {ftMessage && <p className={`text-[10px] ${ftMessageIsError ? 'text-red-600' : 'text-[#7A8F79]'}`}>{ftMessage}</p>}
            </form>
          </div>

          {/* Route a Form */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">Route a Form</h2>
            <form onSubmit={handleRouteForm} className="space-y-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Provider</label>
                <select value={rfNurseId} onChange={e => setRfNurseId(e.target.value)} required className="w-full border border-[#D9E1E8] px-2 py-1 rounded-lg text-xs text-[#2F3E4E] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                  <option value="">Select provider…</option>
                  {nurses.map(n => <option key={n.id} value={n.id}>{n.user?.name || n.displayName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Form Type</label>
                <select value={rfTitle} onChange={e => setRfTitle(e.target.value)} required className="w-full border border-[#D9E1E8] px-2 py-1 rounded-lg text-xs text-[#2F3E4E] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                  <option value="">Select form…</option>
                  {FORM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {rfTitle === 'Other' && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Custom Title</label>
                  <input type="text" value={rfCustomTitle} onChange={e => setRfCustomTitle(e.target.value)} required placeholder="Form name…" className="w-full border border-[#D9E1E8] px-2 py-1 rounded-lg text-xs text-[#2F3E4E] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                </div>
              )}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Category</label>
                <select value={rfCategory} onChange={e => setRfCategory(e.target.value)} className="w-full border border-[#D9E1E8] px-2 py-1 rounded-lg text-xs text-[#2F3E4E] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                  <option value="Form">Form</option>
                  <option value="Tax">Tax</option>
                  <option value="Contract">Contract</option>
                  <option value="Authorization">Authorization</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              {/* Auto-attach banner when a template exists for selected form type */}
              {(() => {
                const matchingTemplate = formTemplates.find(t => t.title === (rfTitle === 'Other' ? rfCustomTitle.trim() : rfTitle))
                if (!matchingTemplate || rfFile) return null
                return (
                  <label className="flex items-center gap-2 cursor-pointer bg-[#f0fff0] border border-[#7A8F79]/30 rounded-lg px-2.5 py-1.5">
                    <input type="checkbox" checked={rfUseTemplate} onChange={e => setRfUseTemplate(e.target.checked)} className="accent-[#7A8F79]" />
                    <span className="text-[10px] text-[#2F3E4E] font-semibold">📎 Auto-attach saved template: <span className="font-normal italic">{matchingTemplate.fileName}</span></span>
                  </label>
                )
              })()}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Attach Different File <span className="normal-case font-normal">(overrides template)</span></label>
                <input type="file" onChange={e => setRfFile(e.target.files?.[0] || null)} className="w-full mt-0.5 text-xs text-[#2F3E4E] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Notes <span className="normal-case font-normal">(optional)</span></label>
                <input type="text" value={rfNotes} onChange={e => setRfNotes(e.target.value)} placeholder="Instructions for provider…" className="w-full border border-[#D9E1E8] px-2 py-1 rounded-lg text-xs text-[#2F3E4E] mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                <input type="checkbox" checked={rfUrgent} onChange={e => setRfUrgent(e.target.checked)} className="accent-[#7B1C1C]" />
                <span className="text-xs text-[#2F3E4E] font-semibold">Mark Urgent</span>
              </label>
              <button type="submit" disabled={rfRouting || !rfNurseId || !rfTitle || (rfTitle === 'Other' && !rfCustomTitle.trim())} className="w-full bg-[#2F3E4E] text-white py-1.5 rounded-lg text-xs font-bold hover:bg-[#7A8F79] transition disabled:opacity-50">
                {rfRouting ? 'Routing…' : 'Route to Provider →'}
              </button>
              {rfMessage && <p className={`text-xs ${rfMessageIsError ? 'text-red-600' : 'text-[#7A8F79]'}`}>{rfMessage}</p>}
            </form>

            {/* Routed forms log */}
            {routedForms.length > 0 && (
              <div className="pt-2 border-t border-[#D9E1E8] space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1.5">Recently Routed</p>
                {routedForms.slice(0, 8).map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.status === 'signed' ? 'bg-green-500' : f.urgent ? 'bg-[#7B1C1C]' : 'bg-amber-400'}`} />
                    <span className="font-semibold text-[#2F3E4E] truncate">{f.nurse.displayName}</span>
                    <span className="text-[#7A8F79] truncate flex-1">{f.title}</span>
                    <span className={`font-semibold flex-shrink-0 ${f.status === 'signed' ? 'text-green-600' : 'text-amber-600'}`}>{f.status === 'signed' ? '✓ Signed' : 'Pending'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Columns 2 & 3: Document Details + Library ── */}
        <div className="space-y-6 lg:col-span-2">

          {/* Document Upload — merged form */}
          <form onSubmit={handleUpload} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#D9E1E8]">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Document Upload</h2>
            </div>

            <div className="grid grid-cols-[1fr_1.6fr] gap-4">

              {/* Left: Assign To */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#2F3E4E]">Assign To</span>
                  <button type="button" onClick={toggleAll} className="text-[10px] text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="border border-[#D9E1E8] rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  {nurses.map(nurse => (
                    <label key={nurse.id} className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-[#F4F6F5] transition border-b border-[#D9E1E8] last:border-0">
                      <input
                        type="checkbox"
                        checked={selectedNurses.includes(nurse.id)}
                        onChange={() => toggleNurse(nurse.id)}
                        className="accent-[#7A8F79] w-3.5 h-3.5 flex-shrink-0"
                      />
                      <span className="text-xs font-semibold text-[#2F3E4E] truncate">{nurse.user?.name || nurse.displayName}</span>
                      <span className="text-[10px] text-[#7A8F79] tracking-tight truncate ml-auto shrink-0 max-w-[40%]">{nurse.user?.email || ''}</span>
                    </label>
                  ))}
                </div>
                {selectedNurses.length > 0 && (
                  <p className="text-[10px] text-[#7A8F79] mt-1">{selectedNurses.length} selected</p>
                )}
              </div>

              {/* Right: Fields */}
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Document Title</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    placeholder="e.g. RN License 2026"
                    required
                    className="w-full border border-[#D9E1E8] px-2.5 py-1 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Category / Folder</label>
                  <select
                    value={docCategory}
                    onChange={e => setDocCategory(e.target.value)}
                    className="w-full border border-[#D9E1E8] px-2.5 py-1 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] mt-0.5"
                  >
                    <option value="General">General</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">
                    Exp Date <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={docExpiry}
                    onChange={e => setDocExpiry(e.target.value)}
                    className="w-full border border-[#D9E1E8] px-2.5 py-1 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] mt-0.5"
                  />
                </div>
                {docExpiry && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Reminders Before Expiry</label>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {[90, 60, 30, 14, 7, 1].map(days => (
                        <label key={days} className="flex items-center gap-1 text-xs text-[#2F3E4E] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={docReminderDays.includes(days)}
                            onChange={e => setDocReminderDays(prev => e.target.checked ? [...prev, days] : prev.filter(d => d !== days))}
                            className="accent-[#7A8F79]"
                          />
                          {days === 1 ? '1d' : `${days}d`}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={visibleToNurse} onChange={e => setVisibleToNurse(e.target.checked)} className="accent-[#7A8F79]" />
                  <span className="text-xs text-[#2F3E4E]">Share with nurse (visible on their profile)</span>
                </label>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">File</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="file"
                      onChange={e => setDocFile(e.target.files?.[0] || null)}
                      required
                      className="flex-1 text-xs text-[#2F3E4E] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition"
                    />
                    <button
                      type="submit"
                      disabled={uploading || !docFile || !docTitle || selectedNurses.length === 0}
                      className="flex-shrink-0 bg-[#7A8F79] text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
                    >
                      {uploading ? 'Uploading…' : `Upload${selectedNurses.length > 1 ? ` (${selectedNurses.length})` : ''}`}
                    </button>
                  </div>
                </div>
                {message && <p className={`text-xs ${messageIsError ? 'text-[#9B1C1C]' : 'text-[#7A8F79]'}`}>{message}</p>}
              </div>

            </div>
          </form>

      {/* ── Document Library ── */}
      {(() => {
        const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
        const fmtSize = (b: number | null) => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`

        const filtered = library.filter(d => {
          const matchNurse = !libNurseFilter || d.nurseId === libNurseFilter
          const matchSearch = !libSearch || d.title.toLowerCase().includes(libSearch.toLowerCase()) || d.fileName.toLowerCase().includes(libSearch.toLowerCase()) || d.nurse.displayName.toLowerCase().includes(libSearch.toLowerCase())
          return matchNurse && matchSearch
        })

        // Group by category
        const folders: Record<string, LibDoc[]> = {}
        filtered.forEach(d => {
          if (!folders[d.category]) folders[d.category] = []
          folders[d.category].push(d)
        })

        return (
          <div className="mt-6 bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">
                Document Library
                <span className="ml-2 text-[#2F3E4E] normal-case font-normal">({library.length} total)</span>
              </h2>
              <button onClick={fetchLibrary} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition font-semibold">↻ Refresh</button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
                placeholder="Search title, file, or provider…"
                className="flex-1 min-w-48 border border-[#D9E1E8] px-3 py-1.5 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <select
                value={libNurseFilter}
                onChange={e => setLibNurseFilter(e.target.value)}
                className="border border-[#D9E1E8] px-3 py-1.5 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="">All Providers</option>
                {nurses.map(n => <option key={n.id} value={n.id}>{n.displayName}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-[#7A8F79] italic">No documents found.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(folders).sort(([a], [b]) => a.localeCompare(b)).map(([folder, docs]) => {
                  const open = expandedFolders.has(folder)
                  return (
                    <div key={folder} className="border border-[#D9E1E8] rounded-xl overflow-hidden">
                      {/* Folder header */}
                      <button
                        type="button"
                        onClick={() => setExpandedFolders(prev => {
                          const next = new Set(prev)
                          open ? next.delete(folder) : next.add(folder)
                          return next
                        })}
                        className="w-full flex items-center justify-between px-4 py-3 bg-[#F4F6F5] hover:bg-[#eef0f2] transition text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{open ? '📂' : '📁'}</span>
                          <span className="text-sm font-semibold text-[#2F3E4E]">{folder}</span>
                          <span className="text-xs text-[#7A8F79]">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-[#7A8F79] text-xs">{open ? '▲' : '▼'}</span>
                      </button>

                      {/* Folder contents */}
                      {open && (
                        <div className="divide-y divide-[#D9E1E8]">
                          {docs.map(doc => {
                            const expDays = doc.expiresAt ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86400000) : null
                            return (
                              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-[#2F3E4E] truncate">{doc.title}</p>
                                    {doc.nurseUploaded && doc.sharedWithAdmin && (
                                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Shared by nurse</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#7A8F79] truncate">
                                    {doc.nurse.displayName} · {doc.fileName} {doc.fileSize ? `· ${fmtSize(doc.fileSize)}` : ''}
                                  </p>
                                  <div className="flex gap-3 text-[11px] mt-0.5">
                                    <span className="text-[#7A8F79]">Uploaded {fmt(doc.createdAt)}</span>
                                    {expDays !== null && (
                                      <span className={expDays < 0 ? 'text-red-600 font-semibold' : expDays <= 30 ? 'text-orange-500 font-semibold' : 'text-[#7A8F79]'}>
                                        {expDays < 0 ? 'Expired' : `Expires in ${expDays}d`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <a
                                  href={`/admin/nurse/${doc.nurseId}`}
                                  className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] px-2 py-1 rounded transition whitespace-nowrap"
                                >
                                  Profile
                                </a>
                                <button
                                  onClick={async () => {
                                    setLibViewing(doc.id)
                                    const res = await fetch(`/api/admin/documents/${doc.id}`, { credentials: 'include' })
                                    const data = await res.json()
                                    if (data.url) window.open(data.url, '_blank')
                                    setLibViewing(null)
                                  }}
                                  disabled={libViewing === doc.id}
                                  className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] px-2 py-1 rounded transition disabled:opacity-50 whitespace-nowrap"
                                >
                                  {libViewing === doc.id ? '…' : 'View'}
                                </button>
                                <button
                                  onClick={() => openEdit(doc)}
                                  className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] px-2 py-1 rounded transition whitespace-nowrap"
                                >
                                  Edit
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

        </div> {/* closes lg:col-span-2 */}
      </div> {/* closes outer 3-col grid */}

      {/* ── Edit Document Modal ── */}
      {editDoc && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#2F3E4E]">Edit Document</h3>
              <button onClick={() => setEditDoc(null)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">×</button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Category / Folder</label>
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="General">General</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
                Expiration Date <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={editExpiry}
                onChange={e => setEditExpiry(e.target.value)}
                className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            {editExpiry && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Email Reminders Before Expiry</label>
                <div className="flex flex-wrap gap-3">
                  {[90, 60, 30, 14, 7, 1].map(days => (
                    <label key={days} className="flex items-center gap-1.5 text-sm text-[#2F3E4E] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editReminderDays.includes(days)}
                        onChange={e => setEditReminderDays(prev =>
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

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Assigned Provider</label>
              <select
                value={editNurseId}
                onChange={e => setEditNurseId(e.target.value)}
                className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                {nurses.map(n => <option key={n.id} value={n.id}>{n.displayName}</option>)}
              </select>
            </div>

            {editMessage && <p className="text-sm text-[#9B1C1C]">{editMessage}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditDoc(null)}
                className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f6f8] transition"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving || !editTitle.trim()}
                className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
