'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalMessages from '../../components/PortalMessages'

const REMINDER_CATEGORIES = [
  { value: 'license',   label: '📄 Professional License' },
  { value: 'medicaid',  label: '🏥 Medicaid Enrollment' },
  { value: 'bcbs',      label: '💳 BCBS / Insurance' },
  { value: 'npi',       label: '🔢 NPI Registration' },
  { value: 'insurance', label: '🛡️ Malpractice Insurance' },
  { value: 'general',   label: '📅 General Reminder' },
]

type Reminder = {
  id: string
  title: string
  category: string
  dueDate: string
  notes?: string
  completed: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)
  const [profile, setProfile] = useState<any>({})
  const [message, setMessage] = useState('')
  const [pwMessage, setPwMessage] = useState('')

  // password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // reminders
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [reminderForm, setReminderForm] = useState({ title: '', category: 'general', dueDate: '', notes: '' })
  const [reminderAdding, setReminderAdding] = useState(false)
  const [showReminderForm, setShowReminderForm] = useState(false)

  // documents
  const [documents, setDocuments] = useState<Array<{
    id: string; title: string; fileName: string; category: string;
    fileSize: number | null; mimeType: string | null; expiresAt: string | null; createdAt: string
  }>>([])
  const [docDownloading, setDocDownloading] = useState<string | null>(null)

  // upload form
  const [upFile, setUpFile] = useState<File | null>(null)
  const [upTitle, setUpTitle] = useState('')
  const [upCategory, setUpCategory] = useState('General')
  const [upUploading, setUpUploading] = useState(false)
  const [upMessage, setUpMessage] = useState('')
  const [upMessageIsError, setUpMessageIsError] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<{ presignData: any; file: File; title: string; category: string } | null>(null)

  useEffect(() => {
    fetch('/api/nurse/profile')
      .then((r) => {
        if (r.status === 401) {
          router.push('/login')
          return
        }
        return r.json()
      })
      .then((data) => {
        if (data) {
          setUser(data.user)
          setProfile(data.profile || {})
        }
      })
      .finally(() => setLoading(false))

    fetch('/api/nurse/reminders', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setReminders(data) })

    fetch('/api/nurse/documents', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.documents)) setDocuments(data.documents) })
  }, [router])

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
    await fetch(`/api/nurse/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ completed }),
    })
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed } : r))
  }

  async function deleteReminder(id: string) {
    await fetch(`/api/nurse/reminders/${id}`, { method: 'DELETE', credentials: 'include' })
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const res = await fetch('/api/nurse/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile)
    })

    const data = await res.json()
    if (res.ok) {
      setMessage('Profile updated successfully.')
      // refresh layout/data so Banner picks up any new displayName
      router.refresh()
    } else {
      setMessage(data.error || 'Update failed.')
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage('')
    if (newPassword !== confirmPassword) {
      setPwMessage('New passwords do not match.')
      return
    }
    const res = await fetch('/api/nurse/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword })
    })
    const data = await res.json()
    if (res.ok) {
      setPwMessage('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setPwMessage(data.error || 'Could not change password.')
    }
  }

  async function downloadDoc(id: string, fileName: string) {
    setDocDownloading(id)
    try {
      const res = await fetch(`/api/nurse/documents/${id}`, { credentials: 'include' })
      const data = await res.json()
      if (data.url) {
        const a = document.createElement('a')
        a.href = data.url
        a.download = fileName
        a.target = '_blank'
        a.click()
      }
    } finally {
      setDocDownloading(null)
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
      // Show share prompt before sending to S3
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
      // PUT to S3
      const formData = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v))
      formData.append('file', file)
      await fetch(presignData.url, { method: 'POST', body: formData, mode: 'no-cors' })

      // Confirm
      const confirmRes = await fetch('/api/nurse/documents/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nurseId: presignData.nurseId,
          title,
          storageKey: presignData.storageKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || null,
          category,
          sharedWithAdmin,
        }),
      })
      const confirmData = await confirmRes.json()
      if (confirmData.ok) {
        setUpMessage(sharedWithAdmin
          ? 'Document uploaded and shared with Coming Home Care for review.'
          : 'Document uploaded successfully.')
        setUpMessageIsError(false)
        setUpFile(null)
        setUpTitle('')
        setUpCategory('General')
        // Refresh docs list
        fetch('/api/nurse/documents', { credentials: 'include' })
          .then(r => r.json())
          .then(data => { if (Array.isArray(data.documents)) setDocuments(data.documents) })
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

  if (loading) {
    return <div className="p-8">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Profile
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Manage your personal information and billing preferences.</p>
      </div>

      <PortalMessages priority="General" />

      {profile.accountNumber && (
        <div className="bg-[#2F3E4E] text-white rounded-xl px-6 py-4 flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Account Number</p>
            <p className="text-2xl font-bold tracking-widest mt-0.5">{profile.accountNumber}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#7A8F79] flex items-center justify-center text-white font-bold text-lg">
            {(profile.displayName || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Col 1: Personal Information ── */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
          <h2 className="text-xl font-semibold text-[#2F3E4E]">Personal Information</h2>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
              Email — <a href="mailto:support@cominghomecare.com" className="normal-case font-normal underline hover:text-[#2F3E4E]">request update</a>
            </label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="w-full border border-[#D9E1E8] p-2 rounded bg-gray-100 text-[#2F3E4E]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Display Name</label>
            <input
              type="text"
              value={profile.displayName || ''}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Home Address</label>
            <input
              type="text"
              placeholder="Street address"
              value={profile.address || ''}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">City</label>
              <input
                type="text"
                placeholder="City"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">State</label>
              <input
                type="text"
                placeholder="State"
                value={profile.state || ''}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">ZIP Code</label>
              <input
                type="text"
                placeholder="ZIP"
                value={profile.zip || ''}
                onChange={(e) => setProfile({ ...profile, zip: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">NPI Number</label>
              <input
                type="text"
                value={profile.npiNumber || ''}
                onChange={(e) => setProfile({ ...profile, npiNumber: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Medicaid Number</label>
            <input
              type="text"
              value={profile.medicaidNumber || ''}
              onChange={(e) => setProfile({ ...profile, medicaidNumber: e.target.value })}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Billing Info</label>
            <textarea
              value={profile.billingInfo || ''}
              onChange={(e) => setProfile({ ...profile, billingInfo: e.target.value })}
              rows={3}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79] transition font-semibold"
          >
            Save Changes
          </button>
          {message && <p className="text-sm text-center text-[#2F3E4E]">{message}</p>}
        </form>

        {/* ── Col 2: Change Password + myRenewals ── */}
        <div className="space-y-6">

          <form onSubmit={changePassword} className="bg-white p-6 rounded shadow space-y-4">
            <h2 className="text-xl font-semibold text-[#2F3E4E]">Change Password</h2>
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
            <button
              type="submit"
              className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79] transition font-semibold"
            >
              Update Password
            </button>
            {pwMessage && <p className="text-sm text-center text-[#2F3E4E]">{pwMessage}</p>}
          </form>

          {/* myRenewals */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#2F3E4E]">
                  <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Renewals
                </h2>
                <p className="text-xs text-[#7A8F79] mt-0.5">Track license renewals, enrollment deadlines, and important dates.</p>
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
                  <input
                    type="text"
                    placeholder="e.g. NY RN License Renewal"
                    value={reminderForm.title}
                    onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Category</label>
                    <select
                      value={reminderForm.category}
                      onChange={e => setReminderForm({ ...reminderForm, category: e.target.value })}
                      className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    >
                      {REMINDER_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Due Date</label>
                    <input
                      type="date"
                      value={reminderForm.dueDate}
                      onChange={e => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                      className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Renew at nysed.gov/nursing"
                    value={reminderForm.notes}
                    onChange={e => setReminderForm({ ...reminderForm, notes: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={reminderAdding}
                  className="w-full bg-[#7A8F79] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#657a64] transition disabled:opacity-50"
                >
                  {reminderAdding ? 'Saving…' : 'Save Reminder'}
                </button>
              </form>
            )}

            {reminders.length === 0 ? (
              <p className="text-sm text-[#7A8F79] italic text-center py-4">
                No reminders yet — add a renewal deadline above.
              </p>
            ) : (
              <div className="space-y-2">
                {reminders.map(r => {
                  const due = new Date(r.dueDate)
                  const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  const overdue = daysLeft < 0
                  const urgent = daysLeft >= 0 && daysLeft <= 14
                  const catIcon = r.category === 'license' ? '📄' : r.category === 'medicaid' ? '🏥' : r.category === 'bcbs' ? '💳' : r.category === 'npi' ? '🔢' : r.category === 'insurance' ? '🛡️' : '📅'
                  return (
                    <div
                      key={r.id}
                      className={`flex items-start gap-3 rounded-lg px-4 py-3 border transition ${
                        r.completed ? 'bg-gray-50 border-[#D9E1E8] opacity-60' :
                        overdue ? 'bg-red-50 border-red-200' :
                        urgent ? 'bg-amber-50 border-amber-200' :
                        'bg-[#F4F6F5] border-[#D9E1E8]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={r.completed}
                        onChange={e => toggleReminder(r.id, e.target.checked)}
                        className="mt-1 accent-[#7A8F79] w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${r.completed ? 'line-through text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>
                          {catIcon} {r.title}
                        </p>
                        <p className={`text-xs mt-0.5 font-medium ${overdue ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-[#7A8F79]'}`}>
                          {overdue ? `Overdue by ${Math.abs(daysLeft)} days` :
                           urgent ? `${daysLeft} days left` :
                           due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {r.notes && <p className="text-xs text-[#7A8F79] mt-0.5">{r.notes}</p>}
                      </div>
                      <button
                        onClick={() => deleteReminder(r.id)}
                        className="text-[#D9E1E8] hover:text-red-400 transition text-sm mt-0.5"
                        title="Delete reminder"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── My Documents ── */}
        <div className="bg-white p-6 rounded shadow space-y-4 lg:col-span-3">
          <h2 className="text-xl font-semibold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Documents
          </h2>

          {documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map(doc => (
                <div key={doc.id} className="border border-[#D9E1E8] rounded-lg p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#2F3E4E] truncate">{doc.title}</p>
                      <p className="text-xs text-[#7A8F79] truncate">{doc.fileName}</p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] uppercase tracking-wide font-semibold bg-[#D9E1E8] text-[#2F3E4E] px-2 py-0.5 rounded">
                      {doc.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#7A8F79]">
                    <span>{new Date(doc.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {doc.expiresAt && (
                      <span className="text-amber-600 font-medium">
                        Exp {new Date(doc.expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => downloadDoc(doc.id, doc.fileName)}
                    disabled={docDownloading === doc.id}
                    className="mt-auto w-full text-xs font-semibold text-[#2F3E4E] border border-[#D9E1E8] rounded py-1.5 hover:bg-[#D9E1E8] transition disabled:opacity-50"
                  >
                    {docDownloading === doc.id ? 'Opening…' : 'View / Download'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#7A8F79] italic">No documents yet.</p>
          )}

          {/* Upload form */}
          <form onSubmit={handleUploadSubmit} className="border-t border-[#D9E1E8] pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Upload a Document</p>
            <div className="grid sm:grid-cols-2 gap-3">
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
                  {['General', 'License', 'Insurance', 'Contract', 'Tax', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                onChange={e => setUpFile(e.target.files?.[0] || null)}
                required
                className="flex-1 text-sm text-[#2F3E4E] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition"
              />
              <button
                type="submit"
                disabled={upUploading || !upFile || !upTitle}
                className="flex-shrink-0 bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
              >
                {upUploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            {upMessage && (
              <p className={`text-sm ${upMessageIsError ? 'text-[#9B1C1C]' : 'text-[#7A8F79]'}`}>{upMessage}</p>
            )}
          </form>
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
                <button
                  onClick={() => completeUpload(false)}
                  className="flex-1 border border-[#D9E1E8] text-[#2F3E4E] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F4F6F5] transition"
                >
                  No, keep private
                </button>
                <button
                  onClick={() => completeUpload(true)}
                  className="flex-1 bg-[#2F3E4E] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition"
                >
                  Yes, share for review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Col 3: myBilling + Notification Preferences ── */}
        <div className="space-y-6">
          <BillingSection profile={profile} onUnenroll={() => setProfile({ ...profile, enrolledInBilling: false })} />

          <div className="bg-white p-6 rounded shadow space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-[#2F3E4E]">Notification Preferences</h2>
              <p className="text-xs text-[#7A8F79] mt-0.5">Choose which emails you'd like to receive.</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Reminders</p>
              <div className="space-y-3">
                {[
                  { field: 'receiveNotifications', label: 'Weekly Hour Submission', desc: 'Friday reminder to submit your hours for the week' },
                  { field: 'notifyBillingReminder', label: 'Billing Reminder', desc: 'Reminders related to invoices and billing activity' },
                  { field: 'notifyDocExpiring', label: 'Document / License Expiring', desc: 'Alerts before a document or license on file reaches its expiration date' },
                ].map(({ field, label, desc }) => (
                  <NotifToggle
                    key={field}
                    label={label}
                    desc={desc}
                    checked={profile[field] !== false}
                    onChange={async (val) => {
                      setProfile({ ...profile, [field]: val })
                      await fetch('/api/nurse/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ [field]: val }),
                      })
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#D9E1E8]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Alerts</p>
              <div className="space-y-3">
                {[
                  { field: 'notifyNewDocument', label: 'New Document Added', desc: 'Email when your coordinator uploads a document to your profile' },
                  { field: 'notifyNewClaim', label: 'New Claim Added', desc: 'Email when a new claim is added to your account' },
                ].map(({ field, label, desc }) => (
                  <NotifToggle
                    key={field}
                    label={label}
                    desc={desc}
                    checked={profile[field] !== false}
                    onChange={async (val) => {
                      setProfile({ ...profile, [field]: val })
                      await fetch('/api/nurse/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ [field]: val }),
                      })
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function NotifToggle({ label, desc, checked, onChange }: {
  label: string
  desc: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2F3E4E] leading-tight">{label}</p>
        <p className="text-xs text-[#7A8F79] mt-0.5 leading-snug">{desc}</p>
      </div>
      <div className="relative flex-shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8]'}`} />
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </label>
  )
}

function BillingSection({ profile, onUnenroll }: { profile: any; onUnenroll: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleUnenroll() {
    setLoading(true)
    await fetch('/api/nurse/unenroll', { method: 'POST', credentials: 'include' })
    setLoading(false)
    setDone(true)
    setConfirming(false)
    onUnenroll()
  }

  const planLabels: Record<string, string> = {
    A1: 'Plan A1 — Single Payer (BCBS)',
    A2: 'Plan A2 — Single Payer (Medicaid)',
    B:  'Plan B — Dual Payer (BCBS + Medicaid)',
    custom: 'Custom Arrangement',
  }

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">
        <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Billing
      </h2>

      {profile.enrolledInBilling === true ? (
        <div className="space-y-3">
          <div className="bg-[#F4F6F5] rounded-lg p-4 text-sm space-y-1">
            <p><span className="text-[#7A8F79] font-semibold">Status:</span> <span className="text-green-700 font-semibold">Enrolled</span></p>
            {profile.billingPlan && (
              <p><span className="text-[#7A8F79] font-semibold">Plan:</span> <span className="text-[#2F3E4E] font-medium">{planLabels[profile.billingPlan] || profile.billingPlan}</span></p>
            )}
            {profile.planStartDate && (
              <p><span className="text-[#7A8F79] font-semibold">Start Date:</span> <span className="text-[#2F3E4E] font-medium">{profile.planStartDate}</span></p>
            )}
            {profile.billingDurationType && (
              <p><span className="text-[#7A8F79] font-semibold">Duration:</span> <span className="text-[#2F3E4E] font-medium">{profile.billingDurationType === 'full_year' ? 'Full Year' : profile.billingDurationNote || 'Policy Specific'}</span></p>
            )}
          </div>

          {done ? (
            <p className="text-sm text-[#7A8F79]">Unenrollment request submitted. Your administrator will be in touch.</p>
          ) : confirming ? (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
              <p className="text-sm text-red-700 font-semibold">Are you sure you want to unenroll from billing services?</p>
              <p className="text-xs text-red-500">Your administrator will be notified. You can re-enroll at any time.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">
                  Cancel
                </button>
                <button onClick={handleUnenroll} disabled={loading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50">
                  {loading ? 'Submitting…' : 'Yes, Unenroll Me'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full border border-red-300 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition"
            >
              Request Unenrollment
            </button>
          )}
        </div>
      ) : profile.enrolledInBilling === false ? (
        <div className="space-y-3">
          <p className="text-sm text-[#7A8F79]">You are not currently enrolled in billing services.</p>
          <a
            href="/nurse/onboarding"
            className="block text-center w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            Enroll in Billing Services
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#7A8F79]">Complete your onboarding to set up billing services.</p>
          <a
            href="/nurse/onboarding"
            className="block text-center w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            Start Enrollment
          </a>
        </div>
      )}
    </div>
  )
}
