'use client'

import { useState, useEffect } from 'react'

const DEFINITIONS = [
  "A place to land — where the paperwork is handled, deadlines are tracked, and you finally get a moment to breathe.",
  "A space to grow — resources, guides, and real support for the business side of caregiving, so you can become the provider you were meant to be.",
  "A community to belong to — where it's okay to vent, laugh, learn, ask questions, and remember why you chose this work.",
]

export default function HomeDefinition() {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    // in → hold → out → next in
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(setTimeout(() => setPhase('hold'), 600))   // finish fade-in
    timers.push(setTimeout(() => setPhase('out'), 4200))   // start fade-out
    timers.push(setTimeout(() => {                          // swap and restart
      setIndex(i => (i + 1) % DEFINITIONS.length)
      setPhase('in')
    }, 4900))

    return () => timers.forEach(clearTimeout)
  }, [index])

  const opacity = phase === 'hold' ? 1 : 0
  const translateY = phase === 'in' ? 6 : phase === 'out' ? -6 : 0

  return (
    <div className="mt-6 pt-5 border-t border-[#3d5166]">
      <p className="text-white font-bold text-base tracking-tight">
        home{' '}
        <span className="text-sm font-normal text-[#7A8F79] italic tracking-normal">/hōm/</span>
        <span className="ml-3 text-[10px] uppercase tracking-widest text-[#7A8F79] font-semibold align-middle">noun</span>
      </p>
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          transition: 'opacity 0.6s ease, transform 0.6s ease',
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
