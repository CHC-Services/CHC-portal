'use client'

import { useState, useEffect } from 'react'

type FaqItem = {
  id: string
  question: string
  answer: string
  category: string
  sortOrder: number
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
        <div className="px-4 pb-4 pl-12 text-sm text-[#2F3E4E] leading-relaxed whitespace-pre-line">
          {item.answer}
        </div>
      )}
    </div>
  )
}

export default function FaqPage() {
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    fetch('/api/faq')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setItems(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category)))]

  const filtered = activeCategory === 'All'
    ? items
    : items.filter(i => i.category === activeCategory)

  const grouped = filtered.reduce<Record<string, FaqItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

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
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-10 py-8">

        {/* Category filter tabs */}
        {categories.length > 2 && (
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
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, catItems]) => (
              <div key={category} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-[#F4F6F5] border-b border-[#D9E1E8]">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#7A8F79]">{category}</h2>
                </div>
                <div className="px-0">
                  {catItems.map(item => (
                    <AccordionItem key={item.id} item={item} />
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
