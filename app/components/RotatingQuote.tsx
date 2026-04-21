'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const QUOTES = [
  { text: "A good physician treats the disease; a great physician treats the patient who has the disease.", author: "William Osler" },
  { text: "Small consistent actions create extraordinary outcomes.", author: "Coming Home Care" },
  { text: "Care for others, but remember even the strongest hearts need rest to keep beating well.", author: "Anonymous" },
  { text: "Nurses: turning caffeine into care, one shift at a time.", author: "Anonymous" },
  { text: "I attribute my success to this: I never gave or took any excuse.", author: "Florence Nightingale" },
  { text: "Wherever the art of Medicine is loved, there is also a love of Humanity.", author: "Hippocrates" },
  { text: "Behind every chart is a human story, and you are part of its healing.", author: "Unknown" },
  { text: "Every small act of care creates a ripple of healing far beyond what you can see.", author: "Anonymous" },
  { text: "Kindness is a language every patient understands.", author: "Unknown" },
  { text: "Sometimes the most important medicine is simply being there.", author: "Unknown" },
  { text: "To do what nobody else will do, in a way that nobody else can do, in spite of all we go through—that is nursing.", author: "Rawsi Williams" },
  { text: "How very little can be done under the spirit of fear.", author: "Florence Nightingale" },
  { text: "The greatest wealth is health.", author: "Virgil" },
]

export default function RotatingQuote({
  interval = 8000,
  showCta = false,
  ctaLabel = 'Access Your Portal →',
  ctaHref = '/login',
  compact = false,
  className = '',
}: {
  interval?: number
  showCta?: boolean
  ctaLabel?: string
  ctaHref?: string
  compact?: boolean
  className?: string
}) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      const swap = setTimeout(() => {
        setIndex(i => (i + 1) % QUOTES.length)
        setVisible(true)
      }, 350)
      return () => clearTimeout(swap)
    }, interval)
    return () => clearInterval(timer)
  }, [interval])

  const quote = QUOTES[index]

  if (compact) {
    return (
      <div
        className={`bg-[#2F3E4E] rounded-xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
      >
        <div
          className="transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <p className="font-cormorant text-[#D9E1E8] text-xl italic leading-snug max-w-lg">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="font-cormorant text-[#7A8F79] text-base mt-2">
            &mdash; {quote.author}
          </p>
        </div>
        {showCta && (
          <Link
            href={ctaHref}
            className="shrink-0 text-xs font-semibold text-[#7A8F79] hover:text-white transition uppercase tracking-widest"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-[#2F3E4E] rounded-xl p-8 text-center ${className}`}>
      <div
        className="transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="font-cormorant text-[#D9E1E8] text-2xl italic leading-snug max-w-xl mx-auto">
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="font-cormorant text-[#7A8F79] text-lg mt-4">
          &mdash; {quote.author}
        </p>
      </div>
      {showCta && (
        <Link
          href={ctaHref}
          className="mt-6 inline-block bg-[#7A8F79] text-white font-semibold px-7 py-3 rounded-lg hover:bg-[#657a64] transition text-sm"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
