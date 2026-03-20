'use client'

import { useEffect, useState } from 'react'

type PortalMessage = {
  id: string
  title?: string | null
  body: string
  category: string
  createdAt: string
}

const CATEGORY_STYLE: Record<string, { badge: string; border: string }> = {
  Claims:   { badge: 'bg-blue-100 text-blue-700 border-blue-200',    border: 'border-l-blue-400' },
  Invoices: { badge: 'bg-green-100 text-green-700 border-green-200', border: 'border-l-green-400' },
  Events:   { badge: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-l-amber-400' },
  General:  { badge: 'bg-[#F4F6F5] text-[#7A8F79] border-[#D9E1E8]', border: 'border-l-[#7A8F79]' },
}

function getStyle(category: string) {
  return CATEGORY_STYLE[category] ?? CATEGORY_STYLE.General
}

export default function PortalMessages({ priority }: { priority?: string }) {
  const [messages, setMessages] = useState<PortalMessage[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/nurse/messages', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) setMessages(data)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || messages.length === 0) return null

  // Sort: priority category first, then by newest
  const sorted = [...messages].sort((a, b) => {
    const aPin = priority && a.category === priority ? 0 : 1
    const bPin = priority && b.category === priority ? 0 : 1
    if (aPin !== bPin) return aPin - bPin
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="mb-6 bg-white rounded-xl shadow-sm border border-[#D9E1E8] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#D9E1E8] flex items-center gap-2 bg-[#F4F6F5]">
        <span className="text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Portal Updates</span>
        <span className="bg-[#2F3E4E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {messages.length}
        </span>
      </div>
      <div className="divide-y divide-[#D9E1E8]">
        {sorted.map(msg => {
          const style = getStyle(msg.category)
          const isPriority = priority && msg.category === priority
          return (
            <div
              key={msg.id}
              className={`px-5 py-4 border-l-4 ${style.border} ${isPriority ? 'bg-[#fafbfa]' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.badge}`}>
                  {msg.category}
                </span>
                {isPriority && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#2F3E4E] text-white">
                    Relevant to this page
                  </span>
                )}
              </div>
              {msg.title && (
                <p className="text-sm font-semibold text-[#2F3E4E]">{msg.title}</p>
              )}
              <p className="text-sm text-[#2F3E4E] leading-relaxed mt-0.5">{msg.body}</p>
              <p className="text-[10px] text-[#7A8F79] mt-1.5">
                {new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
