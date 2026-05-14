'use client'

import { useState, useEffect } from 'react'

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
  { text: "Nursing is a progressive art such that to stand still is to go backward.", author: "Florence Nightingale" },
  { text: "Being a nurse means to hold all your own tears and start drawing smiles on people's faces.", author: "Dana Basem" },
  { text: "Everything is sketchy. The world does nothing but sketch. The more you sketch, the more the world becomes clear.", author: "Combined" },
  { text: "The best way to find yourself is to lose yourself in the service of others.", author: "Mahatma Gandhi" },
  { text: "Life is not easy for any of us. But what of that? We must have perseverance and, above all, confidence in ourselves.", author: "Marie Curie" },
  { text: "Nursing is not for everyone. It takes a special kind of person to be a nurse, but those who are nurses know they have found their calling.", author: "Unknown" },
  { text: "Start by doing what's necessary; then do what's possible; and suddenly you are doing the impossible.", author: "Francis of Assisi" },
  { text: "I didn't want just any career, so I'm not going to be just any nurse.", author: "Unknown" },
  { text: "Show kindness in every interaction, you never know how much it might mean to someone who is struggling.", author: "Unknown" },
]

type Direction = 'up' | 'down' | 'left' | 'right'
const DIRS: Direction[] = ['up', 'down', 'left', 'right']

function exitTransform(d: Direction) {
  if (d === 'up')    return 'translate3d(0,-16px,0)'
  if (d === 'down')  return 'translate3d(0,16px,0)'
  if (d === 'left')  return 'translate3d(-20px,0,0)'
  return                    'translate3d(20px,0,0)'
}
function enterTransform(d: Direction) {
  if (d === 'up')    return 'translate3d(0,16px,0)'
  if (d === 'down')  return 'translate3d(0,-16px,0)'
  if (d === 'left')  return 'translate3d(20px,0,0)'
  return                    'translate3d(-20px,0,0)'
}

type Phase = 'show' | 'exit' | 'enter'

function quoteStyle(phase: Phase, dir: Direction): React.CSSProperties {
  if (phase === 'show') return {
    opacity: 1,
    transform: 'translate3d(0,0,0)',
    transition: 'opacity 420ms cubic-bezier(0.4,0,0.2,1), transform 420ms cubic-bezier(0.4,0,0.2,1)',
  }
  if (phase === 'exit') return {
    opacity: 0,
    transform: exitTransform(dir),
    transition: 'opacity 320ms cubic-bezier(0.4,0,0.2,1), transform 320ms cubic-bezier(0.4,0,0.2,1)',
  }
  // 'enter' — starting position, no transition (snaps instantly, then show animates it in)
  return {
    opacity: 0,
    transform: enterTransform(dir),
    transition: 'none',
  }
}

export default function RotatingQuote({
  interval = 90000,
  compact = false,
  variant,
  className = '',
}: {
  interval?: number
  compact?: boolean
  variant?: 'header' | 'mobileBanner'
  className?: string
}) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [phase, setPhase] = useState<Phase>('show')
  const [dir, setDir] = useState<Direction>('up')

  useEffect(() => {
    const timer = setInterval(() => {
      const d = DIRS[Math.floor(Math.random() * DIRS.length)]
      setDir(d)
      setPhase('exit')
      const swap = setTimeout(() => {
        setIndex(i => (i + 1) % QUOTES.length)
        setPhase('enter')
        const show = setTimeout(() => setPhase('show'), 40)
        return () => clearTimeout(show)
      }, 340)
      return () => clearTimeout(swap)
    }, interval)
    return () => clearInterval(timer)
  }, [interval])

  const quote = QUOTES[index]
  const style = quoteStyle(phase, dir)

  if (variant === 'mobileBanner') {
    return (
      <div className={`overflow-hidden ${className}`}>
        <div style={style}>
          <p className="font-cormorant font-semibold text-white text-base italic leading-snug">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="font-cormorant text-[#7A8F79] text-sm mt-1 self-end pr-4">
            &mdash; {quote.author}
          </p>
        </div>
      </div>
    )
  }

  if (variant === 'header') {
    return (
      <div className={`flex flex-col justify-center text-right overflow-hidden ${className}`}>
        <div style={style}>
          <p className="font-cormorant font-semibold text-[#2F3E4E] text-lg leading-snug">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="font-cormorant text-[#7A8F79] text-sm uppercase tracking-widest mt-1 text-right">
            &mdash; {quote.author}
          </p>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={`bg-[#2F3E4E] rounded-xl px-8 py-6 overflow-hidden ${className}`}>
        <div style={style}>
          <p className="font-cormorant font-semibold text-[#D9E1E8] text-lg italic leading-snug">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="font-cormorant text-[#7A8F79] text-base mt-2 self-end pr-4">
            &mdash; {quote.author}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-[#2F3E4E] rounded-xl p-8 text-center overflow-hidden ${className}`}>
      <div style={style}>
        <p className="font-cormorant font-semibold text-[#D9E1E8] text-xl italic leading-snug max-w-xl mx-auto">
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="font-cormorant text-[#7A8F79] ml-48 text-lg mt-4 self-end pr-4">
          &mdash; {quote.author}
        </p>
      </div>
    </div>
  )
}
