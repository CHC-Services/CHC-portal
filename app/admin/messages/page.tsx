'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type PortalMessage = {
  id: string
  title?: string | null
  body: string
  category: string
  audiences: string[]
  createdAt: string
}

type Nurse = {
  id: string
  displayName: string
  user: { email: string }
}

const CATEGORIES = ['General', 'Claims', 'Invoices', 'Events']

const SYSTEM_AUDIENCES = [
  { value: 'All Users',    label: 'All Users',       desc: 'Every logged-in user' },
  { value: 'All Nurses',   label: 'All Nurses',      desc: 'All accounts with nurse role' },
  { value: 'Active Billing', label: 'Active Billing', desc: 'Nurses enrolled in billing services' },
  { value: 'Non-Provider', label: 'Non-Provider',    desc: 'Nurses not enrolled in billing' },
  { value: 'Admins',       label: 'Admins',          desc: 'Admin accounts only' },
]

const CATEGORY_STYLE: Record<string, string> = {
  General:  'bg-[#F4F6F5] text-[#7A8F79] border-[#D9E1E8]',
  Claims:   'bg-blue-50 text-blue-700 border-blue-200',
  Invoices: 'bg-green-50 text-green-700 border-green-200',
  Events:   'bg-amber-50 text-amber-700 border-amber-200',
}

export default function AdminMessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<PortalMessage[]>([])
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('General')
  const [audiences, setAudiences] = useState<string[]>([])

  useEffect(() => {
    const p1 = fetch('/api/admin/messages', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then(data => { if (Array.isArray(data)) setMessages(data) })

    const p2 = fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNurses(data) })

    Promise.all([p1, p2]).finally(() => setLoading(false))
  }, [router])

  function toggleAudience(value: string) {
    setAudiences(prev =>
      prev.includes(value) ? prev.filter(a => a !== value) : [...prev, value]
    )
  }

  function resetForm() {
    setTitle('')
    setBody('')
    setCategory('General')
    setAudiences([])
    setSaveMsg('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    setSaveMsg('')
    const res = await fetch('/api/admin/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title, body, category, audiences }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setMessages(prev => [data, ...prev])
      resetForm()
      setShowForm(false)
    } else {
      setSaveMsg(data.error || 'Failed to save message.')
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/admin/messages/${id}`, { method: 'DELETE', credentials: 'include' })
    setMessages(prev => prev.filter(m => m.id !== id))
    setDeleting(null)
  }

  function audienceLabel(a: string) {
    if (a.startsWith('user:')) {
      const nurseId = a.replace('user:', '')
      const nurse = nurses.find(n => n.id === nurseId)
      return nurse ? nurse.displayName : nurseId
    }
    return a
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">← Admin</Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-[#2F3E4E]">Portal Messaging</h1>
            <p className="text-sm text-[#7A8F79] mt-1">Post updates for nurses and providers — shown across their portal pages.</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setSaveMsg('') }}
            className="shrink-0 bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            {showForm ? 'Cancel' : '+ New Message'}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
              New Portal Message
            </h2>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                Title <span className="normal-case font-normal">(optional — short headline)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Important Claims Update"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                required
                rows={4}
                placeholder="Type your update here…"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setCategory(c)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                      category === c
                        ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
                        : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#7A8F79] mt-1.5">
                This category determines which page the message rises to the top on for nurses.
              </p>
            </div>

            {/* Audience */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">
                Audience <span className="normal-case font-normal">(select one or more — none selected = draft, not shown)</span>
              </label>
              <div className="space-y-1.5 mb-3">
                {SYSTEM_AUDIENCES.map(a => (
                  <label key={a.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={audiences.includes(a.value)}
                      onChange={() => toggleAudience(a.value)}
                      className="w-4 h-4 accent-[#7A8F79]"
                    />
                    <span>
                      <span className="text-sm font-semibold text-[#2F3E4E] group-hover:text-[#7A8F79] transition">{a.label}</span>
                      <span className="text-xs text-[#7A8F79] ml-2">{a.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              {nurses.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1.5">Individual Providers</p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto bg-[#F4F6F5] rounded-lg p-3">
                    {nurses.map(n => {
                      const key = `user:${n.id}`
                      return (
                        <label key={n.id} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={audiences.includes(key)}
                            onChange={() => toggleAudience(key)}
                            className="w-4 h-4 accent-[#7A8F79]"
                          />
                          <span>
                            <span className="text-xs font-semibold text-[#2F3E4E]">{n.displayName}</span>
                            <span className="text-[10px] text-[#7A8F79] block">{n.user.email}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}

              {audiences.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No audience selected — this message will be saved as a draft and not shown to anyone.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm() }}
                className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !body.trim()}
                className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {saving ? 'Posting…' : audiences.length === 0 ? 'Save as Draft' : 'Post Message'}
              </button>
            </div>
            {saveMsg && <p className="text-xs text-red-500 text-center">{saveMsg}</p>}
          </form>
        )}

        {/* Message list */}
        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <p className="text-[#2F3E4E] font-semibold">No messages yet</p>
            <p className="text-sm text-[#7A8F79] mt-1">Post your first update above — it will appear on your providers' portal pages.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => {
              const catStyle = CATEGORY_STYLE[msg.category] || CATEGORY_STYLE.General
              const isDraft = msg.audiences.length === 0
              return (
                <div key={msg.id} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${catStyle}`}>
                          {msg.category}
                        </span>
                        {isDraft ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            Draft — not visible
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {msg.audiences.map(a => (
                              <span key={a} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D9E1E8] text-[#2F3E4E]">
                                {audienceLabel(a)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.title && (
                        <p className="text-sm font-semibold text-[#2F3E4E]">{msg.title}</p>
                      )}
                      <p className="text-sm text-[#2F3E4E] leading-relaxed mt-0.5">{msg.body}</p>
                      <p className="text-[10px] text-[#7A8F79] mt-2">
                        {new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(msg.id)}
                      disabled={deleting === msg.id}
                      className="shrink-0 text-[#D9E1E8] hover:text-red-400 transition text-lg leading-none disabled:opacity-40"
                      title="Delete message"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
