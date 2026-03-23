'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminNav from '../../components/AdminNav'

type GlobalEvent = {
  id: string
  title: string
  description?: string
  eventDate: string
  category: string
  targetRoles: string[]
  recurrence?: string
}

const CATEGORIES = [
  { value: 'tax',        label: '🧾 Tax Deadline' },
  { value: 'renewal',   label: '📄 Renewal' },
  { value: 'compliance',label: '✅ Compliance' },
  { value: 'general',   label: '📅 General' },
]

const ALL_ROLES = ['nurse', 'biller', 'provider', 'guardian']

export default function AdminCalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<GlobalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', eventDate: '', category: 'general',
    targetRoles: [] as string[], recurrence: '',
  })

  useEffect(() => {
    fetch('/api/admin/events', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then(data => { if (data) setEvents(data) })
      .finally(() => setLoading(false))
  }, [router])

  function toggleRole(role: string) {
    setForm(f => ({
      ...f,
      targetRoles: f.targetRoles.includes(role)
        ? f.targetRoles.filter(r => r !== role)
        : [...f.targetRoles, role],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...form, recurrence: form.recurrence || null }),
    })
    const data = await res.json()
    if (res.ok) {
      setEvents(prev => [...prev, data].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()))
      setForm({ title: '', description: '', eventDate: '', category: 'general', targetRoles: [], recurrence: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/admin/events/${id}`, { method: 'DELETE', credentials: 'include' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <AdminNav />

        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">← Admin</Link>
          <div>
            <h1 className="text-3xl font-bold text-[#2F3E4E]">Shared Calendar</h1>
            <p className="text-xs text-[#7A8F79] mt-0.5">Events here appear on every provider's calendar.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="ml-auto bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            {showForm ? 'Cancel' : '+ Add Event'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">New Global Event</h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Title</label>
              <input
                type="text" required value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Q2 Estimated Tax Payment Due"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Date</label>
                <input
                  type="date" required value={form.eventDate}
                  onChange={e => setForm({ ...form, eventDate: e.target.value })}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">
                Visible to <span className="normal-case font-normal">(leave all unchecked = everyone)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map(role => (
                  <button
                    key={role} type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition capitalize ${
                      form.targetRoles.includes(role)
                        ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
                        : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Recurrence</label>
              <select
                value={form.recurrence}
                onChange={e => setForm({ ...form, recurrence: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="">One-time</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <button
              type="submit" disabled={saving}
              className="w-full bg-[#7A8F79] text-white py-2 rounded-lg font-semibold text-sm hover:bg-[#657a64] transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Event'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-[#7A8F79] text-sm">Loading…</p>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-[#7A8F79] text-sm">No global events yet. Add one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.id} className="bg-white rounded-xl border border-[#D9E1E8] shadow-sm p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#2F3E4E]">{ev.title}</p>
                  <p className="text-xs text-[#7A8F79] mt-0.5">
                    {new Date(ev.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {ev.recurrence && ` · ${ev.recurrence}`}
                    {ev.targetRoles.length > 0 && ` · ${ev.targetRoles.join(', ')}`}
                    {ev.targetRoles.length === 0 && ' · All providers'}
                  </p>
                  {ev.description && <p className="text-xs text-[#7A8F79] mt-1">{ev.description}</p>}
                </div>
                <button
                  onClick={() => deleteEvent(ev.id)}
                  className="text-[#D9E1E8] hover:text-red-400 transition text-sm"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
