'use client'

import { useState, useEffect, useRef } from 'react'
import AdminNav from '../../components/AdminNav'

type FaqItem = {
  id: string
  question: string
  answer: string
  category: string
  sortOrder: number
  published: boolean
}

const BLANK_FORM = { question: '', answer: '', category: 'General', published: true }

export default function AdminFaqPage() {
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const dragId = useRef<string | null>(null)

  function loadItems() {
    return fetch('/api/faq', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setItems(data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadItems() }, [])

  async function saveItem(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const url = editingId ? `/api/faq/${editingId}` : '/api/faq'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setMessage(editingId ? 'Question updated.' : 'Question added.')
      setForm(BLANK_FORM)
      setEditingId(null)
      setShowForm(false)
      loadItems()
    } else {
      const d = await res.json()
      setMessage(d.error || 'Error saving.')
    }
    setSaving(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this question?')) return
    await fetch(`/api/faq/${id}`, { method: 'DELETE', credentials: 'include' })
    loadItems()
  }

  async function togglePublished(item: FaqItem) {
    await fetch(`/api/faq/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ published: !item.published }),
    })
    loadItems()
  }

  function startEdit(item: FaqItem) {
    setForm({ question: item.question, answer: item.answer, category: item.category, published: item.published })
    setEditingId(item.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Drag-and-drop reorder ──
  function onDragStart(id: string) {
    dragId.current = id
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function onDrop(targetId: string) {
    if (!dragId.current || dragId.current === targetId) return

    const reordered = [...items]
    const fromIdx = reordered.findIndex(i => i.id === dragId.current)
    const toIdx = reordered.findIndex(i => i.id === targetId)
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const updates = reordered.map((item, idx) => ({ id: item.id, sortOrder: idx }))
    setItems(reordered.map((item, idx) => ({ ...item, sortOrder: idx })))
    dragId.current = null

    await fetch('/api/faq/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    })
  }

  const categories = Array.from(new Set(items.map(i => i.category)))

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <AdminNav />

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">FAQ</span> Manager
            </h1>
            <p className="text-sm text-[#7A8F79] mt-1">Add, edit, reorder, and publish FAQ items visible on the public FAQ page.</p>
          </div>
          <button
            onClick={() => { setForm(BLANK_FORM); setEditingId(null); setShowForm(s => !s) }}
            className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold"
          >
            {showForm && !editingId ? 'Cancel' : '+ Add Question'}
          </button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-base font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
              {editingId ? 'Edit Question' : 'New Question'}
            </h2>
            <form onSubmit={saveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Question *</label>
                <input
                  required
                  value={form.question}
                  onChange={e => setForm({ ...form, question: e.target.value })}
                  placeholder="e.g. How do I submit hours?"
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Answer *</label>
                <textarea
                  required
                  rows={5}
                  value={form.answer}
                  onChange={e => setForm({ ...form, answer: e.target.value })}
                  placeholder="Write the full answer here..."
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Category</label>
                  <input
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    list="category-options"
                    placeholder="e.g. Billing, Claims, General"
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                  <datalist id="category-options">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-[#2F3E4E]">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={e => setForm({ ...form, published: e.target.checked })}
                      className="accent-[#7A8F79] w-4 h-4"
                    />
                    Published (visible on FAQ page)
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#2F3E4E] text-white px-5 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Question'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForm(BLANK_FORM); setEditingId(null); setShowForm(false) }}
                  className="border border-[#D9E1E8] text-[#2F3E4E] px-5 py-2 rounded-lg hover:bg-[#D9E1E8] transition text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
              {message && (
                <p className={`text-sm font-medium ${message.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>{message}</p>
              )}
            </form>
          </div>
        )}

        {/* Items list */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#F4F6F5] border-b border-[#D9E1E8] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#2F3E4E] uppercase tracking-wide">All Questions</h2>
            <p className="text-xs text-[#7A8F79]">Drag rows to reorder</p>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-[#7A8F79]">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-5 text-sm text-[#7A8F79] italic">No questions yet. Add one above.</p>
          ) : (
            <div>
              {items.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(item.id)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(item.id)}
                  className="flex items-start gap-3 px-5 py-4 border-b border-[#D9E1E8] last:border-0 hover:bg-[#F9FAFB] cursor-grab active:cursor-grabbing group"
                >
                  {/* Drag handle */}
                  <div className="flex-shrink-0 mt-0.5 text-[#D9E1E8] group-hover:text-[#7A8F79] transition select-none" title="Drag to reorder">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-6 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-6 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-white bg-[#7A8F79] px-2 py-0.5 rounded-full">{item.category}</span>
                      {!item.published && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Draft</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#2F3E4E] leading-snug">{item.question}</p>
                    <p className="text-xs text-[#7A8F79] mt-0.5 line-clamp-2">{item.answer}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-2 items-center">
                    <button
                      onClick={() => togglePublished(item)}
                      title={item.published ? 'Unpublish' : 'Publish'}
                      className={`text-xs px-2 py-1 rounded border transition font-semibold ${
                        item.published
                          ? 'border-green-300 text-green-700 hover:bg-green-50'
                          : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#D9E1E8]'
                      }`}
                    >
                      {item.published ? 'Live' : 'Draft'}
                    </button>
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs px-2 py-1 rounded border border-[#D9E1E8] text-[#2F3E4E] hover:bg-[#D9E1E8] transition font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
