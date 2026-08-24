'use client'

import { useEffect, useState } from 'react'

// A rough, self-explanatory "value proof" tile — not a precise time-and-
// motion study. Formula: word count of every AI-compiled note (any note with
// at least one voice entry) divided by a standard 40 WPM typing pace. Renders
// inline as a section inside MicroChargingDevices.tsx's card (no card of its
// own) so anything Micro-Charting-related lives in one place, and so it's
// easy to find again later (e.g. checking back mid free-trial to see the
// value add for herself).
type TimeSaved = { noteCount: number; wordCount: number; minutesSaved: number }

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`
}

export default function MicroChargingTimeSaved() {
  const [data, setData] = useState<TimeSaved | null>(null)

  useEffect(() => {
    fetch('/api/nurse/my-notes/time-saved', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
  }, [])

  return (
    <div className="pt-3 border-t border-[#D9E1E8] space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Time Saved</p>
        {data != null && data.noteCount > 0 && (
          <p className="text-lg font-bold text-[#2F3E4E]">{formatDuration(data.minutesSaved)}</p>
        )}
      </div>

      {data == null ? (
        <p className="text-xs text-[#7A8F79]">Loading…</p>
      ) : data.noteCount === 0 ? (
        <p className="text-xs text-[#7A8F79] leading-relaxed">
          Record your first note with Micro-Charting to start seeing your time savings add up here.
        </p>
      ) : (
        <p className="text-xs text-[#7A8F79] leading-relaxed">
          Est. of time saved with <em>Micro-Charting</em> <strong className="text-[#2F3E4E]">{data.noteCount}</strong> note{data.noteCount !== 1 ? 's' : ''} dictated instead of typed.
        </p>
      )}
    </div>
  )
}
