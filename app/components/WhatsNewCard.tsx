'use client'

import { useEffect, useState } from 'react'
import { WHATS_NEW } from '../../lib/whatsNew'

const DISMISS_PREFIX = 'whatsNewDismissed'

// A "New for X" dashboard card that jumps up and teeters for a moment on
// first appearance, then settles — meant to actually catch the eye rather
// than blend into the rest of the dashboard. Dismissible, and namespaced by
// both role and content version (lib/whatsNew.ts) so bumping the copy
// re-surfaces it once for everyone who already dismissed an older version.
export default function WhatsNewCard({ roleKey }: { roleKey: 'nurse' | 'guardian' }) {
  const content = WHATS_NEW[roleKey]
  const dismissKey = `${DISMISS_PREFIX}:${roleKey}:${content?.version}`

  const [dismissed, setDismissed] = useState(true) // hidden until localStorage check, avoids a flash
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    if (!content) return
    const seen = localStorage.getItem(dismissKey) === '1'
    setDismissed(seen)
    // Inline styles beat any CSS class (including a Tailwind motion-reduce
    // variant), so the reduced-motion check has to happen here in JS, not
    // just via a class on the element.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!seen && !prefersReducedMotion) {
      // Trigger the entrance animation one tick after mount so it actually plays.
      const t = setTimeout(() => setEntering(true), 30)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissKey])

  if (!content || dismissed) return null

  function dismiss() {
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-[#D9E1E8] px-5 py-4 mb-6"
      style={entering ? { animation: 'whatsNewEntrance 1.3s cubic-bezier(.36,.07,.19,.97) both' } : undefined}
    >
      <style>{`
        @keyframes whatsNewEntrance {
          0%   { transform: translateY(36px) rotate(0deg); opacity: 0; }
          30%  { transform: translateY(-8px) rotate(-2.5deg); opacity: 1; }
          42%  { transform: translateY(0) rotate(2.5deg); }
          54%  { transform: translateY(-3px) rotate(-1.5deg); }
          66%  { transform: translateY(0) rotate(1.5deg); }
          78%  { transform: translateY(-1px) rotate(-0.5deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
      `}</style>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest bg-[#7A8F79] text-white px-2 py-1 rounded-full shrink-0">New</span>
          <div>
            <p className="text-base font-bold text-[#2F3E4E] mb-1.5">{content.heading}</p>
            <ul className="space-y-1">
              {content.items.map(item => (
                <li key={item} className="text-sm text-[#7A8F79] flex gap-1.5">
                  <span className="text-[#7A8F79]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-[#7A8F79] hover:text-[#2F3E4E] transition text-sm shrink-0 leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
