'use client'

import { useEffect, useRef, useState } from 'react'

// Attaches pull-to-refresh to any page on mobile.
// Renders a visual indicator when pulling; reloads on release past threshold.
export default function PullToRefresh() {
  const [pullY, setPullY] = useState(0)      // how far pulled (px)
  const [releasing, setReleasing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const THRESHOLD = 72

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      // Only trigger when already scrolled to the very top
      if (window.scrollY > 2) return
      startY.current = e.touches[0].clientY
      pulling.current = true
      setReleasing(false)
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { setPullY(0); return }
      // Rubber-band: movement slows past 40px
      const clamped = Math.min(delta * 0.45, THRESHOLD + 20)
      setPullY(clamped)
    }

    function onTouchEnd() {
      if (!pulling.current) return
      pulling.current = false
      if (pullY >= THRESHOLD * 0.45) {
        setReleasing(true)
        setTimeout(() => window.location.reload(), 200)
      } else {
        setPullY(0)
        setReleasing(false)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullY])

  if (pullY <= 2) return null

  const progress = Math.min(pullY / (THRESHOLD * 0.45), 1)
  const ready = progress >= 1

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-[60] flex items-center justify-center pointer-events-none transition-all"
      style={{ top: `${220 + pullY * 0.4}px` }}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-xs font-semibold transition-all ${
          releasing ? 'bg-[#7A8F79] text-white scale-95 opacity-70' :
          ready     ? 'bg-[#7A8F79] text-white' :
                      'bg-white text-[#7A8F79] border border-[#D9E1E8]'
        }`}
        style={{ opacity: Math.max(0.3, progress) }}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${ready ? 'rotate-180' : ''}`}
          style={{ transform: `rotate(${releasing ? 180 : progress * 180}deg)` }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
        {releasing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
      </div>
    </div>
  )
}
