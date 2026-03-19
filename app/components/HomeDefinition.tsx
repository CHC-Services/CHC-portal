'use client'

import { useState, useEffect } from 'react'

const DEFINITIONS = [
  "A place to land — where the paperwork is handled, deadlines are tracked, and you finally get a moment to breathe.",
  "A space to grow — resources, guides, and real support for the business side of caregiving, so you can become the provider you were meant to be.",
  "A community to belong to — where it's okay to vent, laugh, learn, ask questions, and remember why you chose this work.",
]

export default function HomeDefinition() {
  // Pick a random definition once on load — changes only on page refresh
  const [index] = useState(() => Math.floor(Math.random() * DEFINITIONS.length))
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Slight delay so the fade-in is noticeable on load
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="mb-6 pb-5 border-b border-[#3d5166]">
      <p className="text-white font-bold text-base tracking-tight">
        home{' '}
        <span className="text-sm font-normal text-[#7A8F79] italic tracking-normal">/hōm/</span>
        <span className="ml-3 text-[10px] uppercase tracking-widest text-[#7A8F79] font-semibold align-middle">noun</span>
      </p>
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
          minHeight: '2.5rem',
        }}
        className="mt-2 flex gap-2 items-start"
      >
        <span className="text-[#7A8F79] font-bold text-sm shrink-0 mt-0.5">{index + 1}.</span>
        <p className="text-[#D9E1E8] text-sm italic leading-relaxed">{DEFINITIONS[index]}</p>
      </div>
    </div>
  )
}
