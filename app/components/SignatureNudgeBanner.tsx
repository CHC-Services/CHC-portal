'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const DISMISS_KEY = 'signatureNudgeDismissedAt'
const DISMISS_MS = 24 * 60 * 60 * 1000 // reappears next day if still unset, not dismissed forever

export default function SignatureNudgeBanner({
  profileHref, exploreHref,
}: {
  profileHref: string // '/nurse/profile' or '/admin/profile'
  exploreHref: string // where to see Progress Notes in action — '/nurse/patients' or '/admin/patients'
}) {
  const [dismissed, setDismissed] = useState(true) // default hidden until we check localStorage, avoids a flash

  useEffect(() => {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    setDismissed(Date.now() - at < DISMISS_MS)
  }, [])

  if (dismissed) return null

  return (
    <div className="bg-white border border-[#D9E1E8] rounded-xl shadow-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-[#2F3E4E]">✍️ Set up your e-signature</p>
        <p className="text-xs text-[#7A8F79] mt-0.5">
          Needed to sign Progress Notes electronically (and other forms/documents) — takes about a minute.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link href={exploreHref} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition underline">
          See a Progress Note
        </Link>
        <Link href={profileHref} className="text-sm font-semibold text-white bg-[#2F3E4E] px-4 py-1.5 rounded-lg hover:bg-[#7A8F79] transition">
          Set it up
        </Link>
        <button
          type="button"
          onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setDismissed(true) }}
          className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
