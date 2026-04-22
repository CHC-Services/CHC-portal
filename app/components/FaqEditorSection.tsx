'use client'

import { useState, useEffect, useRef } from 'react'

type FaqItem = {
  id: string
  question: string
  answer: string
  category: string
  subcategory: string
  sortOrder: number
  published: boolean
}

type SubGroup = { name: string; items: FaqItem[] }
type CatGroup = { category: string; subcategories: SubGroup[] }

type DragSrc =
  | { type: 'cat'; catIdx: number }
  | { type: 'sub'; catIdx: number; subIdx: number }
  | { type: 'item'; catIdx: number; subIdx: number; itemIdx: number }

const DEFAULT_CATEGORIES = ['General', 'Billing', 'Claims', 'Enrollment', 'Time Entry', 'Account']

function buildGroups(items: FaqItem[]): CatGroup[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
  const catOrder: string[] = []
  const catMap = new Map<string, { subOrder: string[]; subMap: Map<string, FaqItem[]> }>()
  for (const item of sorted) {
    const primaryCat = parseCategories(item.category)[0]
    if (!catMap.has(primaryCat)) {
      catMap.set(primaryCat, { subOrder: [], subMap: new Map() })
      catOrder.push(primaryCat)
    }
    const entry = catMap.get(primaryCat)!
    const subKey = item.subcategory || ''
    if (!entry.subMap.has(subKey)) {
      entry.subMap.set(subKey, [])
      entry.subOrder.push(subKey)
    }
    entry.subMap.get(subKey)!.push(item)
  }
  return catOrder.map(cat => {
    const entry = catMap.get(cat)!
    return {
      category: cat,
      subcategories: entry.subOrder.map(sub => ({ name: sub, items: entry.subMap.get(sub)! })),
    }
  })
}

function flattenToUpdates(groups: CatGroup[]): { id: string; sortOrder: number }[] {
  const updates: { id: string; sortOrder: number }[] = []
  let order = 0
  for (const cg of groups)
    for (const sg of cg.subcategories)
      for (const item of sg.items)
        updates.push({ id: item.id, sortOrder: order++ })
  return updates
}

function moveInArr<T>(arr: T[], from: number, to: number): T[] {
  const r = [...arr]
  r.splice(to, 0, r.splice(from, 1)[0])
  return r
}

function parseCategories(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [raw]
  } catch {
    return [raw]
  }
}

function TBtn({ onActivate, title, children }: { onActivate: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onActivate() }}
      title={title}
      className="px-2 py-1 rounded text-xs font-semibold text-[#2F3E4E] hover:bg-[#D9E1E8] transition select-none"
    >
      {children}
    </button>
  )
}

export default function FaqEditorSection() {
  const [items, setItems] = useState<FaqItem[]>([])
  const [groups, setGroups] = useState<CatGroup[]>([])
  const [loading, setLoading] = useState(true)

  // Category management state
  const [allCategories, setAllCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [allSubcategories, setAllSubcategories] = useState<Record<string, string[]>>({})
  const [manageOpen, setManageOpen] = useState(false)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [newCatInput, setNewCatInput] = useState('')
  const [newSubInputs, setNewSubInputs] = useState<Record<string, string>>({})

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['General'])
  const [subcategory, setSubcategory] = useState('')
  const [published, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  // Citation state
  const [citations, setCitations] = useState<{ url: string; label: string }[]>([])
  const [citationUrl, setCitationUrl] = useState('')
  const [citationLabel, setCitationLabel] = useState('')

  // Drag state
  const dragSrc = useRef<DragSrc | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  function load() {
    Promise.all([
      fetch('/api/faq', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/system-settings', { credentials: 'include' }).then(r => r.json()),
    ]).then(([faqData, settings]) => {
      const arr: FaqItem[] = Array.isArray(faqData) ? faqData : []
      setItems(arr)
      setGroups(buildGroups(arr))

      if (settings && !settings.error) {
        if (settings.faq_categories) {
          try { setAllCategories(JSON.parse(settings.faq_categories)) } catch { /* keep default */ }
        }
        if (settings.faq_subcategories) {
          try { setAllSubcategories(JSON.parse(settings.faq_subcategories)) } catch { /* keep default */ }
        }
      }
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function persistCategories(cats: string[]) {
    setAllCategories(cats)
    await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: 'faq_categories', value: JSON.stringify(cats) }),
    })
  }

  async function persistSubcategories(subs: Record<string, string[]>) {
    setAllSubcategories(subs)
    await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: 'faq_subcategories', value: JSON.stringify(subs) }),
    })
  }

  function addCategory() {
    const name = newCatInput.trim()
    if (!name || allCategories.includes(name)) return
    persistCategories([...allCategories, name])
    setNewCatInput('')
  }

  function deleteCategory(name: string) {
    if (items.some(i => parseCategories(i.category).includes(name))) {
      alert(`Cannot delete "${name}" — there are FAQ items using this category. Reassign or delete them first.`)
      return
    }
    const updated = allCategories.filter(c => c !== name)
    persistCategories(updated)
    const updatedSubs = { ...allSubcategories }
    delete updatedSubs[name]
    persistSubcategories(updatedSubs)
  }

  function addSubcategory(cat: string) {
    const name = (newSubInputs[cat] || '').trim()
    if (!name) return
    const existing = allSubcategories[cat] || []
    if (existing.includes(name)) return
    const updated = { ...allSubcategories, [cat]: [...existing, name] }
    persistSubcategories(updated)
    setNewSubInputs(prev => ({ ...prev, [cat]: '' }))
  }

  function deleteSubcategory(cat: string, sub: string) {
    if (items.some(i => parseCategories(i.category).includes(cat) && i.subcategory === sub)) {
      alert(`Cannot delete "${sub}" — there are FAQ items using this subcategory. Reassign or delete them first.`)
      return
    }
    const updated = { ...allSubcategories, [cat]: (allSubcategories[cat] || []).filter(s => s !== sub) }
    persistSubcategories(updated)
  }

  // ── Citation helpers ────────────────────────────────────────────────────────
  function addCitation() {
    const url = citationUrl.trim()
    const label = citationLabel.trim()
    if (!url || !label) return
    setCitations(prev => [...prev, { url, label }])
    setCitationUrl('')
    setCitationLabel('')
  }

  function removeCitation(idx: number) {
    setCitations(prev => prev.filter((_, i) => i !== idx))
  }

  function buildCitationHtml(cites: { url: string; label: string }[]): string {
    if (cites.length === 0) return ''
    const links = cites.map(c =>
      `<a href="${c.url}" target="_blank" rel="noopener noreferrer" data-faq-citation style="display:inline-flex;align-items:center;background:#2F3E4E;border:1px solid #2F3E4E;border-radius:9999px;padding:1px 7px;font-size:11px;color:#ffffff;text-decoration:none;line-height:1.5;white-space:nowrap;">${c.label}</a>`
    ).join('')
    return `<div data-faq-citations style="margin-top:10px;display:flex;flex-wrap:wrap;gap:5px;align-items:center;">${links}</div>`
  }

  function parseCitationsFromHtml(html: string): { body: string; cites: { url: string; label: string }[] } {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const wrapper = doc.querySelector('[data-faq-citations]')
    if (!wrapper) return { body: html, cites: [] }
    const cites: { url: string; label: string }[] = []
    wrapper.querySelectorAll('a[data-faq-citation]').forEach(a => {
      const url = a.getAttribute('href') || ''
      const label = (a as HTMLElement).innerText || a.textContent || ''
      if (url && label) cites.push({ url, label })
    })
    wrapper.remove()
    return { body: doc.body.innerHTML, cites }
  }

  // ── Rich text helpers ───────────────────────────────────────────────────────
  function fmt(cmd: string, val?: string) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, val ?? undefined)
    editorRef.current?.focus()
  }
  function insertLink() {
    const url = prompt('Enter URL (include https://):')
    if (url) fmt('createLink', url)
  }
  function applyFontSize(size: string) {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('fontSize', false, '7')
    const editor = editorRef.current
    if (!editor) return
    editor.querySelectorAll('font[size="7"]').forEach(el => {
      const span = document.createElement('span')
      span.style.fontSize = size
      span.innerHTML = (el as HTMLElement).innerHTML
      el.replaceWith(span)
    })
    editorRef.current?.focus()
  }

  // ── Form open/close ─────────────────────────────────────────────────────────
  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat)
        ? prev.length > 1 ? prev.filter(c => c !== cat) : prev
        : [...prev, cat]
    )
  }

  function openNew() {
    setEditingId(null)
    setQuestion('')
    setSelectedCategories([allCategories[0] || 'General'])
    setSubcategory('')
    setPublished(true)
    setCitations([])
    setCitationUrl('')
    setCitationLabel('')
    setFormOpen(true)
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = '' }, 0)
  }

  function openEdit(item: FaqItem) {
    setEditingId(item.id)
    setQuestion(item.question)
    setSelectedCategories(parseCategories(item.category))
    setSubcategory(item.subcategory || '')
    setPublished(item.published)
    setCitationUrl('')
    setCitationLabel('')
    const { body, cites } = parseCitationsFromHtml(item.answer)
    setCitations(cites)
    setFormOpen(true)
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = body }, 0)
  }

  function cancel() {
    setFormOpen(false)
    setEditingId(null)
  }

  // ── Save (create or update) ─────────────────────────────────────────────────
  async function save() {
    const bodyHtml = editorRef.current?.innerHTML?.trim() || ''
    if (!question.trim() || !bodyHtml) return
    setSaving(true)
    const answer = bodyHtml + buildCitationHtml(citations)
    const body = { question, answer, category: JSON.stringify(selectedCategories), subcategory: subcategory.trim(), published }
    if (editingId) {
      await fetch(`/api/faq/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
    }
    setSaving(false)
    setFormOpen(false)
    setEditingId(null)
    load()
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this FAQ item? This cannot be undone.')) return
    setDeletingId(id)
    await fetch(`/api/faq/${id}`, { method: 'DELETE', credentials: 'include' })
    setDeletingId(null)
    load()
  }

  async function togglePublished(item: FaqItem) {
    await fetch(`/api/faq/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ published: !item.published }),
    })
    load()
  }

  // ── Reorder helpers ─────────────────────────────────────────────────────────
  async function pushReorder(newGroups: CatGroup[]) {
    setGroups(newGroups)
    await fetch('/api/faq/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(flattenToUpdates(newGroups)),
    })
  }

  // ── Drag handlers ───────────────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, src: DragSrc) {
    dragSrc.current = src
    e.dataTransfer.effectAllowed = 'move'
    const el = e.currentTarget as HTMLElement
    e.dataTransfer.setDragImage(el, 12, 12)
  }

  function onDragOver(e: React.DragEvent, key: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverKey(key)
  }

  function onDragEnd() {
    dragSrc.current = null
    setDragOverKey(null)
  }

  function onDrop(e: React.DragEvent, target: DragSrc) {
    e.preventDefault()
    setDragOverKey(null)
    const src = dragSrc.current
    dragSrc.current = null
    if (!src) return

    if (src.type === 'cat' && target.type === 'cat') {
      if (src.catIdx === target.catIdx) return
      pushReorder(moveInArr(groups, src.catIdx, target.catIdx))

    } else if (src.type === 'sub' && target.type === 'sub' && src.catIdx === target.catIdx) {
      if (src.subIdx === target.subIdx) return
      const ng = groups.map((cg, ci) =>
        ci !== src.catIdx ? cg : { ...cg, subcategories: moveInArr(cg.subcategories, src.subIdx, target.subIdx) }
      )
      pushReorder(ng)

    } else if (src.type === 'item' && target.type === 'item' && src.catIdx === target.catIdx && src.subIdx === target.subIdx) {
      if (src.itemIdx === target.itemIdx) return
      const ng = groups.map((cg, ci) => {
        if (ci !== src.catIdx) return cg
        return {
          ...cg,
          subcategories: cg.subcategories.map((sg, si) =>
            si !== src.subIdx ? sg : { ...sg, items: moveInArr(sg.items, src.itemIdx!, target.itemIdx!) }
          ),
        }
      })
      pushReorder(ng)
    }
  }

  // Subcategory suggestions: stored subs for all selected categories + any used in existing items
  const storedSubs = selectedCategories.flatMap(c => allSubcategories[c] || [])
  const itemSubs = items
    .filter(i => selectedCategories.some(c => parseCategories(i.category).includes(c)) && i.subcategory)
    .map(i => i.subcategory)
  const subSuggestions = [...new Set([...storedSubs, ...itemSubs])]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">FAQ Manager</h2>
          {!formOpen && groups.length > 0 && (
            <p className="text-[11px] text-[#7A8F79] mt-0.5">Drag ⠿ handles to reorder categories, subtopics, and questions.</p>
          )}
        </div>
        {!formOpen && (
          <div className="flex gap-2">
            <button
              onClick={() => { setManageOpen(o => !o); setFormOpen(false) }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                manageOpen
                  ? 'bg-[#7A8F79] text-white border-[#7A8F79]'
                  : 'border-[#D9E1E8] text-[#7A8F79] hover:border-[#7A8F79] hover:text-[#2F3E4E]'
              }`}
            >
              {manageOpen ? '▲ Categories' : '▾ Categories'}
            </button>
            <button
              onClick={openNew}
              className="bg-[#2F3E4E] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition"
            >
              + Add FAQ Item
            </button>
          </div>
        )}
      </div>

      {/* ── Category & Subcategory Manager ── */}
      {manageOpen && !formOpen && (
        <div className="border border-[#D9E1E8] rounded-xl p-5 bg-[#F9FAFB] space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Manage Categories &amp; Subcategories</p>

          <div className="space-y-2">
            {allCategories.map(cat => {
              const storedSubsForCat = allSubcategories[cat] || []
              const inUse = items.some(i => parseCategories(i.category).includes(cat))
              const isExpanded = expandedCat === cat
              return (
                <div key={cat} className="border border-[#E8ECEA] rounded-lg overflow-hidden">
                  {/* Category row */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-white">
                    <button
                      onClick={() => setExpandedCat(isExpanded ? null : cat)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      <span className="text-xs text-[#C0C8C0]">{isExpanded ? '▾' : '▸'}</span>
                      <span className="text-sm font-semibold text-[#2F3E4E]">{cat}</span>
                      <span className="text-[10px] text-[#7A8F79]">
                        {storedSubsForCat.length} subcategory{storedSubsForCat.length !== 1 ? 'ies' : 'y'} · {items.filter(i => parseCategories(i.category).includes(cat)).length} items
                      </span>
                    </button>
                    <button
                      onClick={() => deleteCategory(cat)}
                      disabled={inUse}
                      title={inUse ? 'Category has FAQ items — delete them first' : 'Delete category'}
                      className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Subcategories (expanded) */}
                  {isExpanded && (
                    <div className="border-t border-[#E8ECEA] px-4 py-3 bg-[#F9FAFB] space-y-2">
                      {storedSubsForCat.length === 0 ? (
                        <p className="text-xs italic text-[#7A8F79]">No subcategories yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {storedSubsForCat.map(sub => {
                            const subInUse = items.some(i => i.category === cat && i.subcategory === sub)
                            return (
                              <span
                                key={sub}
                                className="inline-flex items-center gap-1 border border-[#D9E1E8] rounded-full px-2.5 py-0.5 text-xs text-[#2F3E4E] bg-white"
                              >
                                {sub}
                                <button
                                  onClick={() => deleteSubcategory(cat, sub)}
                                  disabled={subInUse}
                                  title={subInUse ? 'Subcategory has FAQ items — delete them first' : 'Delete subcategory'}
                                  className="text-red-400 hover:text-red-600 transition disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                                >
                                  ✕
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}
                      {/* Add subcategory input */}
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={newSubInputs[cat] || ''}
                          onChange={e => setNewSubInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubcategory(cat) } }}
                          placeholder="New subcategory name…"
                          className="flex-1 border border-[#D9E1E8] rounded-lg px-2.5 py-1.5 text-xs text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                        />
                        <button
                          onClick={() => addSubcategory(cat)}
                          className="bg-[#7A8F79] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2F3E4E] transition"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add new category */}
          <div className="border-t border-[#E8ECEA] pt-4">
            <p className="text-xs font-semibold text-[#7A8F79] mb-2 uppercase tracking-wide">Add New Category</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
                placeholder="e.g. Payroll, Insurance…"
                className="flex-1 border border-[#D9E1E8] rounded-lg px-2.5 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <button
                onClick={addCategory}
                className="bg-[#2F3E4E] text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-[#7A8F79] transition"
              >
                + Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor form ── */}
      {formOpen && (
        <div className="border border-[#D9E1E8] rounded-xl p-5 space-y-4 bg-[#F9FAFB]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">
            {editingId ? 'Edit FAQ Item' : 'New FAQ Item'}
          </p>

          {/* Question */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Question</label>
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. How do I submit my hours?"
              className="w-full border border-[#D9E1E8] p-2.5 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
          </div>

          {/* Rich text answer */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Answer</label>
            <div className="flex flex-wrap items-center gap-1 border border-[#D9E1E8] border-b-0 rounded-t-lg px-2 py-1.5 bg-white">
              {/* Font family */}
              <select
                onMouseDown={e => e.preventDefault()}
                onChange={e => { fmt('fontName', e.target.value); editorRef.current?.focus() }}
                defaultValue=""
                className="text-xs border border-[#D9E1E8] rounded px-1 py-0.5 text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79] cursor-pointer"
                title="Font family"
              >
                <option value="" disabled>Font</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="Trebuchet MS, sans-serif">Trebuchet</option>
              </select>

              {/* Font size */}
              <select
                onMouseDown={e => e.preventDefault()}
                onChange={e => { applyFontSize(e.target.value); (e.target as HTMLSelectElement).value = '' }}
                defaultValue=""
                className="text-xs border border-[#D9E1E8] rounded px-1 py-0.5 text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79] cursor-pointer"
                title="Font size"
              >
                <option value="" disabled>Size</option>
                <option value="11px">11</option>
                <option value="12px">12</option>
                <option value="14px">14</option>
                <option value="16px">16</option>
                <option value="18px">18</option>
                <option value="20px">20</option>
                <option value="24px">24</option>
                <option value="28px">28</option>
                <option value="32px">32</option>
              </select>

              {/* Font color */}
              <label
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold text-[#2F3E4E] hover:bg-[#D9E1E8] transition cursor-pointer select-none"
                title="Font color"
                onMouseDown={e => e.preventDefault()}
              >
                <span className="text-xs">A</span>
                <input
                  type="color"
                  defaultValue="#2F3E4E"
                  onChange={e => fmt('foreColor', e.target.value)}
                  className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer"
                />
              </label>

              <span className="w-px h-4 bg-[#D9E1E8] mx-0.5" />
              <TBtn onActivate={() => fmt('bold')} title="Bold"><strong>B</strong></TBtn>
              <TBtn onActivate={() => fmt('italic')} title="Italic"><em>I</em></TBtn>
              <TBtn onActivate={() => fmt('underline')} title="Underline"><span className="underline">U</span></TBtn>
              <span className="w-px h-4 bg-[#D9E1E8] mx-0.5" />
              <TBtn onActivate={() => fmt('insertUnorderedList')} title="Bullet list">• List</TBtn>
              <TBtn onActivate={() => fmt('insertOrderedList')} title="Numbered list">1. List</TBtn>
              <span className="w-px h-4 bg-[#D9E1E8] mx-0.5" />
              <TBtn onActivate={insertLink} title="Insert link">🔗 Link</TBtn>
              <TBtn onActivate={() => fmt('unlink')} title="Remove link">✂ Unlink</TBtn>
              <span className="w-px h-4 bg-[#D9E1E8] mx-0.5" />
              <TBtn onActivate={() => fmt('removeFormat')} title="Clear formatting">✕ Clear</TBtn>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[120px] border border-[#D9E1E8] rounded-b-lg p-3 text-[#7A8F79] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79] bg-white"
            />
            <p className="text-[10px] text-[#7A8F79] mt-1">Keyboard shortcuts: ⌘/Ctrl+B bold · ⌘/Ctrl+I italic</p>
          </div>

          {/* Category / Subcategory  |  Citations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: category + subcategory stacked */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                  Category <span className="normal-case font-normal">(select one or more)</span>
                </label>
                <div className="border border-[#D9E1E8] rounded-lg p-2 bg-white max-h-36 overflow-y-auto space-y-1">
                  {allCategories.map(c => (
                    <label key={c} className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:bg-[#F4F6F5] transition">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(c)}
                        onChange={() => toggleCategory(c)}
                        className="accent-[#7A8F79]"
                      />
                      <span className="text-sm text-[#2F3E4E]">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                  Subcategory <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  list="sub-suggestions"
                  value={subcategory}
                  onChange={e => setSubcategory(e.target.value)}
                  placeholder="e.g. Medicaid, Anthem/BCBS"
                  className="w-full h-10 border border-[#D9E1E8] px-2 rounded-lg text-[#2F3E4E] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
                <datalist id="sub-suggestions">
                  {subSuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>

            {/* Right: citation section */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Citations</label>
              <div className="border border-[#D9E1E8] rounded-lg p-3 bg-white space-y-2">
                <input
                  type="url"
                  value={citationUrl}
                  onChange={e => setCitationUrl(e.target.value)}
                  placeholder="https://example.com/source"
                  className="w-full h-8 border border-[#D9E1E8] px-2 rounded text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={citationLabel}
                    onChange={e => setCitationLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCitation() } }}
                    placeholder="Display name (e.g. CMS Guidelines)"
                    className="flex-1 h-8 border border-[#D9E1E8] px-2 rounded text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                  />
                  <button
                    type="button"
                    onClick={addCitation}
                    className="h-8 px-3 bg-[#7A8F79] text-white text-xs font-semibold rounded hover:bg-[#2F3E4E] transition shrink-0"
                  >
                    + Add
                  </button>
                </div>
                {citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {citations.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 border border-[#7A8F79] rounded-full px-2 py-0.5 text-[11px] text-[#7A8F79]"
                      >
                        {c.label}
                        <button
                          type="button"
                          onClick={() => removeCitation(i)}
                          className="text-red-400 hover:text-red-600 leading-none transition"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {citations.length === 0 && (
                  <p className="text-[10px] text-[#7A8F79] italic">No citations added — they appear as pill buttons at the end of the answer.</p>
                )}
              </div>
            </div>
          </div>

          {/* Published toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="faq-pub"
              checked={published}
              onChange={e => setPublished(e.target.checked)}
              className="accent-[#7A8F79]"
            />
            <label htmlFor="faq-pub" className="text-sm text-[#2F3E4E]">Published</label>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="bg-[#2F3E4E] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Item'}
            </button>
            <button onClick={cancel} className="border border-[#D9E1E8] text-[#7A8F79] px-5 py-2 rounded-lg text-sm font-semibold hover:text-[#2F3E4E] transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Item list ── */}
      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-[#7A8F79] italic">No FAQ items yet. Click &ldquo;+ Add FAQ Item&rdquo; to create one.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((cg, catIdx) => {
            const catKey = `cat:${catIdx}`
            return (
              <div
                key={cg.category}
                draggable
                onDragStart={e => onDragStart(e, { type: 'cat', catIdx })}
                onDragOver={e => onDragOver(e, catKey)}
                onDragEnd={onDragEnd}
                onDrop={e => onDrop(e, { type: 'cat', catIdx })}
                className={`rounded-xl border-2 transition-colors ${dragOverKey === catKey ? 'border-[#7A8F79] bg-[#F4F6F5]' : 'border-transparent'}`}
              >
                {/* Category header row */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="cursor-grab active:cursor-grabbing text-[#C0C8C0] select-none text-lg leading-none" title="Drag to reorder category">⠿</span>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E]">{cg.category}</p>
                  <span className="text-[10px] text-[#7A8F79] font-normal normal-case">
                    ({cg.subcategories.reduce((s, sg) => s + sg.items.length, 0)} items)
                  </span>
                </div>

                {/* Subcategory groups */}
                <div className="space-y-3 pl-5">
                  {cg.subcategories.map((sg, subIdx) => {
                    const subKey = `sub:${catIdx}:${subIdx}`
                    return (
                      <div
                        key={sg.name || '__root__'}
                        draggable
                        onDragStart={e => { e.stopPropagation(); onDragStart(e, { type: 'sub', catIdx, subIdx }) }}
                        onDragOver={e => { e.stopPropagation(); onDragOver(e, subKey) }}
                        onDragEnd={onDragEnd}
                        onDrop={e => { e.stopPropagation(); onDrop(e, { type: 'sub', catIdx, subIdx }) }}
                        className={`rounded-lg border transition-colors ${dragOverKey === subKey ? 'border-[#7A8F79] bg-[#F4F6F5]' : 'border-[#E8ECEA]'}`}
                      >
                        {/* Subtopic header (only shown when name is non-empty) */}
                        {sg.name && (
                          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                            <span className="cursor-grab active:cursor-grabbing text-[#C0C8C0] select-none" title="Drag to reorder subtopic">⠿</span>
                            <p className="text-xs font-semibold text-[#7A8F79] italic">{sg.name}</p>
                          </div>
                        )}

                        {/* Items */}
                        <div className={`space-y-1 ${sg.name ? 'px-3 pb-2' : 'p-2'}`}>
                          {sg.items.map((item, itemIdx) => {
                            const itemKey = `item:${catIdx}:${subIdx}:${itemIdx}`
                            return (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={e => { e.stopPropagation(); onDragStart(e, { type: 'item', catIdx, subIdx, itemIdx }) }}
                                onDragOver={e => { e.stopPropagation(); onDragOver(e, itemKey) }}
                                onDragEnd={onDragEnd}
                                onDrop={e => { e.stopPropagation(); onDrop(e, { type: 'item', catIdx, subIdx, itemIdx }) }}
                                className={`flex items-start gap-2 rounded-lg p-2.5 transition-colors ${
                                  dragOverKey === itemKey ? 'bg-[#E8F0E8] border border-[#7A8F79]' :
                                  item.published ? 'bg-white border border-[#E8ECEA]' : 'bg-[#FDFBF5] border border-dashed border-[#D9C88A]'
                                }`}
                              >
                                <span className="cursor-grab active:cursor-grabbing text-[#C0C8C0] select-none mt-0.5 shrink-0" title="Drag to reorder">⠿</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-[#2F3E4E] truncate">{item.question}</p>
                                    {parseCategories(item.category).length > 1 && parseCategories(item.category).slice(1).map(c => (
                                      <span key={c} className="text-[10px] bg-[#E8F0E8] text-[#7A8F79] border border-[#D9E1E8] px-1.5 py-0.5 rounded font-semibold shrink-0">{c}</span>
                                    ))}
                                    {!item.published && (
                                      <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold shrink-0">Draft</span>
                                    )}
                                  </div>
                                  <div
                                    className="text-xs text-[#7A8F79] line-clamp-1 mt-0.5"
                                    dangerouslySetInnerHTML={{ __html: item.answer }}
                                  />
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => togglePublished(item)}
                                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded transition ${item.published ? 'text-[#7A8F79] hover:text-[#2F3E4E]' : 'text-green-600 hover:text-green-800'}`}
                                  >
                                    {item.published ? 'Unpublish' : 'Publish'}
                                  </button>
                                  <button
                                    onClick={() => openEdit(item)}
                                    className="text-[11px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E] px-1.5 py-0.5 rounded transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item.id)}
                                    disabled={deletingId === item.id}
                                    className="text-[11px] font-semibold text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded transition disabled:opacity-40"
                                  >
                                    {deletingId === item.id ? '…' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
