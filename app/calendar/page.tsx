'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type GlobalEvent = {
  id: string
  title: string
  description?: string
  eventDate: string
  category: string
  recurrence?: string
}

type PersonalReminder = {
  id: string
  title: string
  category: string
  dueDate: string
  notes?: string
}

type CalendarItem = {
  id: string
  title: string
  date: Date
  description?: string
  category: string
  type: 'global' | 'personal'
  recurrence?: string
}

const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
  tax:        { icon: '🧾', color: 'bg-amber-50 border-amber-200 text-amber-700', label: 'Tax Deadline' },
  renewal:    { icon: '📄', color: 'bg-blue-50 border-blue-200 text-blue-700',   label: 'Renewal' },
  compliance: { icon: '✅', color: 'bg-green-50 border-green-200 text-green-700', label: 'Compliance' },
  general:    { icon: '📅', color: 'bg-[#F4F6F5] border-[#D9E1E8] text-[#2F3E4E]', label: 'Event' },
  license:    { icon: '📄', color: 'bg-blue-50 border-blue-200 text-blue-700',   label: 'License' },
  medicaid:   { icon: '🏥', color: 'bg-purple-50 border-purple-200 text-purple-700', label: 'Medicaid' },
  bcbs:       { icon: '💳', color: 'bg-indigo-50 border-indigo-200 text-indigo-700', label: 'BCBS' },
  npi:        { icon: '🔢', color: 'bg-gray-50 border-gray-200 text-gray-700',   label: 'NPI' },
  insurance:  { icon: '🛡️', color: 'bg-red-50 border-red-200 text-red-700',     label: 'Insurance' },
}

function meta(category: string) {
  return CATEGORY_META[category] || CATEGORY_META.general
}

function daysFromNow(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function CalendarPage() {
  const router = useRouter()
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'global' | 'personal'>('all')

  useEffect(() => {
    fetch('/api/nurse/calendar', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        const global: CalendarItem[] = data.globalEvents.map((e: GlobalEvent) => ({
          id: e.id,
          title: e.title,
          date: new Date(e.eventDate),
          description: e.description,
          category: e.category,
          type: 'global' as const,
          recurrence: e.recurrence,
        }))
        const personal: CalendarItem[] = data.personalReminders.map((r: PersonalReminder) => ({
          id: r.id,
          title: r.title,
          date: new Date(r.dueDate),
          description: r.notes,
          category: r.category,
          type: 'personal' as const,
        }))
        const merged = [...global, ...personal].sort((a, b) => a.date.getTime() - b.date.getTime())
        setItems(merged)
      })
      .finally(() => setLoading(false))
  }, [router])

  const filtered = items.filter(i => filter === 'all' || i.type === filter)

  // Group by month
  const grouped: Record<string, CalendarItem[]> = {}
  for (const item of filtered) {
    const key = item.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Calendar
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">
            Your upcoming deadlines, renewal dates, tax filings, and personal reminders.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'global', 'personal'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                filter === f
                  ? 'bg-[#2F3E4E] text-white'
                  : 'bg-white text-[#7A8F79] hover:bg-[#D9E1E8]'
              }`}
            >
              {f === 'all' ? 'All Events' : f === 'global' ? '📢 Shared Deadlines' : '🔒 My Reminders'}
            </button>
          ))}
          <Link
            href="/nurse/profile"
            className="ml-auto text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] self-center transition"
          >
            + Add Personal Reminder →
          </Link>
        </div>

        {loading ? (
          <p className="text-[#7A8F79] text-sm">Loading your calendar…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-[#2F3E4E] font-semibold">Nothing upcoming</p>
            <p className="text-sm text-[#7A8F79] mt-1">Add personal reminders from your profile page.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([month, monthItems]) => (
              <div key={month}>
                <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">{month}</p>
                <div className="space-y-3">
                  {monthItems.map(item => {
                    const m = meta(item.category)
                    const days = daysFromNow(item.date)
                    const overdue = days < 0
                    const urgent = days >= 0 && days <= 14
                    return (
                      <div
                        key={item.id}
                        className={`flex gap-4 items-start rounded-xl border p-4 shadow-sm bg-white ${
                          overdue ? 'border-red-300' : urgent ? 'border-amber-300' : 'border-[#D9E1E8]'
                        }`}
                      >
                        <div className={`text-2xl w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${m.color} border`}>
                          {m.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-[#2F3E4E]">{item.title}</p>
                            {item.type === 'global' && (
                              <span className="text-[10px] bg-[#2F3E4E] text-white px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold">Shared</span>
                            )}
                            {item.recurrence && (
                              <span className="text-[10px] bg-[#F4F6F5] text-[#7A8F79] px-2 py-0.5 rounded-full uppercase tracking-wide">Recurring</span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 font-semibold ${overdue ? 'text-red-500' : urgent ? 'text-amber-600' : 'text-[#7A8F79]'}`}>
                            {formatDate(item.date)}
                            {days >= 0 && days <= 30 && ` · ${days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} away`}`}
                            {overdue && ` · Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`}
                          </p>
                          {item.description && (
                            <p className="text-xs text-[#7A8F79] mt-1 leading-relaxed">{item.description}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

