'use client'

import { useState, useEffect, useRef } from 'react'
import AdminNav from '../../components/AdminNav'

type Idea = {
  id: string
  body: string
  category: string
  completed: boolean
  createdAt: string
}

const DEFAULT_CATEGORIES = ['Task', 'Reminder', 'Developer', 'Admin', 'Claims', 'Enrollment']

const CATEGORY_COLORS: Record<string, string> = {
  Task:       'bg-blue-100 text-blue-700',
  Reminder:   'bg-yellow-100 text-yellow-700',
  Developer:  'bg-purple-100 text-purple-700',
  Admin:      'bg-[#2F3E4E] text-white',
  Claims:     'bg-orange-100 text-orange-700',
  Enrollment: 'bg-green-100 text-green-700',
}

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'bg-[#D9E1E8] text-[#2F3E4E]'
}

export default function AdminIdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('Task')
  const [customCat, setCustomCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [filterCat, setFilterCat] = useState('All')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories]

  useEffect(() => {
    fetch('/api/admin/ideas', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setIdeas(data.ideas || []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/admin/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body, category }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      setIdeas(prev => [data.idea, ...prev])
      setBody('')
      textareaRef.current?.focus()
    }
  }

  async function toggleComplete(idea: Idea) {
    await fetch(`/api/admin/ideas/${idea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ completed: !idea.completed }),
    })
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, completed: !i.completed } : i))
  }

  async function deleteIdea(id: string) {
    await fetch(`/api/admin/ideas/${id}`, { method: 'DELETE', credentials: 'include' })
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  function addCustomCategory() {
    const trimmed = customCat.trim()
    if (!trimmed || allCategories.includes(trimmed)) return
    setCustomCategories(prev => [...prev, trimmed])
    setCategory(trimmed)
    setCustomCat('')
    setAddingCat(false)
  }

  const pending   = ideas.filter(i => !i.completed)
  const completed = ideas.filter(i => i.completed)

  const filteredPending = filterCat === 'All'
    ? pending
    : pending.filter(i => i.category === filterCat)

  const usedCategories = ['All', ...Array.from(new Set(pending.map(i => i.category)))]

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Ideas
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Tasks, reminders, and site notes — all in one place.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left: Entry Form ── */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm p-5 sticky top-[220px]">
            <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-4">New Entry</p>
            <form onSubmit={submit} className="space-y-4">

              {/* Category pills */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {allCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition ${
                        category === cat
                          ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
                          : 'bg-white text-[#2F3E4E] border-[#D9E1E8] hover:border-[#7A8F79]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}

                  {/* Add custom category */}
                  {addingCat ? (
                    <div className="flex gap-1 mt-1 w-full">
                      <input
                        type="text"
                        value={customCat}
                        onChange={e => setCustomCat(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory() } if (e.key === 'Escape') setAddingCat(false) }}
                        placeholder="Category name"
                        autoFocus
                        className="flex-1 border border-[#D9E1E8] rounded-lg px-2 py-1 text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                      />
                      <button type="button" onClick={addCustomCategory} className="text-xs bg-[#7A8F79] text-white px-2 py-1 rounded-lg">Add</button>
                      <button type="button" onClick={() => setAddingCat(false)} className="text-xs text-[#7A8F79] px-1">✕</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingCat(true)}
                      className="text-xs font-semibold px-3 py-1 rounded-full border border-dashed border-[#7A8F79] text-[#7A8F79] hover:bg-[#f0f4f0] transition"
                    >
                      + Custom
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Note / Task</label>
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e as unknown as React.FormEvent) }}
                  placeholder="What's on your mind?"
                  rows={5}
                  required
                  className="w-full border border-[#D9E1E8] rounded-lg p-3 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                />
                <p className="text-[10px] text-[#7A8F79] mt-1">⌘↵ or Ctrl↵ to submit</p>
              </div>

              <button
                type="submit"
                disabled={submitting || !body.trim()}
                className="w-full bg-[#2F3E4E] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-40"
              >
                {submitting ? 'Adding…' : 'Add Entry'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right: List ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Filter pills */}
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {usedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition border ${
                    filterCat === cat
                      ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#D9E1E8] hover:border-[#7A8F79]'
                  }`}
                >
                  {cat}{cat !== 'All' && ` (${pending.filter(i => i.category === cat).length})`}
                </button>
              ))}
            </div>
          )}

          {/* Pending ideas */}
          {filteredPending.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <p className="text-[#2F3E4E] font-semibold">No entries yet</p>
              <p className="text-sm text-[#7A8F79] mt-1">Use the form on the left to add your first idea or task.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPending.map(idea => (
                <div
                  key={idea.id}
                  className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-start gap-3 group"
                >
                  <button
                    onClick={() => toggleComplete(idea)}
                    title="Mark complete"
                    className="mt-0.5 w-5 h-5 rounded border-2 border-[#D9E1E8] hover:border-[#7A8F79] flex items-center justify-center shrink-0 transition"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${categoryColor(idea.category)}`}>
                        {idea.category}
                      </span>
                      <span className="text-[10px] text-[#7A8F79]">
                        {new Date(idea.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-[#2F3E4E] whitespace-pre-wrap">{idea.body}</p>
                  </div>
                  <button
                    onClick={() => deleteIdea(idea.id)}
                    title="Delete"
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition mt-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Completed section */}
          {completed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-[#7A8F79] flex items-center gap-2 select-none">
                <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                Completed ({completed.length})
              </summary>
              <div className="mt-3 space-y-2">
                {completed.map(idea => (
                  <div
                    key={idea.id}
                    className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-start gap-3 opacity-50 group/item"
                  >
                    <button
                      onClick={() => toggleComplete(idea)}
                      title="Restore"
                      className="mt-0.5 w-5 h-5 rounded border-2 bg-[#7A8F79] border-[#7A8F79] flex items-center justify-center shrink-0"
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <p className="flex-1 text-sm text-[#7A8F79] line-through whitespace-pre-wrap">{idea.body}</p>
                    <button
                      onClick={() => deleteIdea(idea.id)}
                      title="Delete"
                      className="shrink-0 opacity-0 group-hover/item:opacity-100 text-red-400 hover:text-red-600 transition mt-0.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

        </div>
      </div>
    </div>
  )
}
