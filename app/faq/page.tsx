'use client'

import { useState, useEffect } from 'react'

type FaqItem = {
  id: string
  question: string
  answer: string
  category: string
  sortOrder: number
}

function parseCategories(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [raw]
  } catch {
    return [raw]
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-[#D9E1E8] last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 py-4 text-left hover:bg-[#F4F6F5] px-4 rounded-lg transition group"
      >
        <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-[#7A8F79] flex items-center justify-center text-[#7A8F79] font-bold text-sm group-hover:bg-[#7A8F79] group-hover:text-white transition">
          {open ? '−' : '+'}
        </span>
        <span className="font-semibold text-[#2F3E4E] text-sm leading-snug">{item.question}</span>
      </button>

      {open && (
        <div
          className="px-4 pb-4 pl-12 text-sm text-[#7A8F79] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: item.answer }}
        />
      )}
    </div>
  )
}

export default function FaqPage() {
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/faq')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setItems(data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Collect all unique categories across all items (multi-category aware)
  const categories = ['All', ...Array.from(
    new Set(items.flatMap(i => parseCategories(i.category)))
  )]

  // Filter by search first
  const searchLower = search.toLowerCase()
  const searchFiltered = search
    ? items.filter(i =>
        i.question.toLowerCase().includes(searchLower) ||
        stripHtml(i.answer).toLowerCase().includes(searchLower)
      )
    : items

  // Then filter by category (item matches if any of its categories match)
  const filtered = activeCategory === 'All'
    ? searchFiltered
    : searchFiltered.filter(i => parseCategories(i.category).includes(activeCategory))

  // Group into category buckets — each item appears under every category it belongs to
  const groupOrder: string[] = []
  const groupMap: Record<string, FaqItem[]> = {}

  if (search) {
    // When searching, show a single flat group labelled by the search term
    groupOrder.push('Search Results')
    groupMap['Search Results'] = filtered
  } else {
    for (const item of filtered) {
      const cats = activeCategory === 'All'
        ? parseCategories(item.category)
        : [activeCategory]
      for (const cat of cats) {
        if (!groupMap[cat]) { groupMap[cat] = []; groupOrder.push(cat) }
        if (!groupMap[cat].includes(item)) groupMap[cat].push(item)
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* Hero */}
      <div className="bg-[#2F3E4E] px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#7A8F79] text-sm font-semibold uppercase tracking-widest mb-2">
            Frequently Asked Questions
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            How Can We Help?
          </h1>
          <p className="mt-3 text-[#D9E1E8] text-sm max-w-xl leading-relaxed">
            Find answers to common questions about billing, enrollment, claims, and working with Coming Home Care.
          </p>

          {/* Search bar */}
          <div className="mt-6 relative max-w-xl">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions and answers…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-[#2F3E4E] bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#7A8F79] placeholder-[#aab]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8F79] hover:text-[#2F3E4E] text-xs font-semibold transition"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-10 py-8">

        {/* Category filter tabs — hidden while searching */}
        {!search && categories.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                  activeCategory === cat
                    ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
                    : 'bg-white text-[#2F3E4E] border-[#D9E1E8] hover:border-[#7A8F79]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-[#7A8F79] text-sm">No questions have been added yet. Check back soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-[#7A8F79] text-sm">No results for &ldquo;{search}&rdquo;. Try different keywords.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupOrder.map(cat => (
              <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-[#F4F6F5] border-b border-[#D9E1E8]">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#7A8F79]">{cat}</h2>
                </div>
                <div className="px-0">
                  {groupMap[cat].map(item => (
                    <AccordionItem key={`${cat}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-[#7A8F79]">
          Still have questions?{' '}
          <a href="mailto:info@cominghomecare.com" className="underline underline-offset-2 hover:text-[#2F3E4E] transition">
            Contact us at info@cominghomecare.com
          </a>
        </p>
      </div>
    </div>
  )
}
