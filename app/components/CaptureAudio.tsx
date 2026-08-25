'use client'

import { useEffect, useRef, useState } from 'react'

// Reusable audio-capture control — record/pause/resume/stop&save/cancel, with
// a running duration timer. Fully self-contained (owns getUserMedia/
// MediaRecorder internally); the caller just gets a final Blob via onSave or
// a cancellation signal via onCancel. Not wired to any particular feature —
// drop it in anywhere audio capture is needed.

type Phase = 'requesting' | 'idle' | 'recording' | 'paused'

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function CaptureAudio({
  onSave,
  onCancel,
}: {
  onSave: (blob: Blob) => void
  onCancel: () => void
}) {
  const [phase, setPhase] = useState<Phase>('requesting')
  const [error, setError] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [everStarted, setEverStarted] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mountedRef = useRef(true)

  // Mic permission is requested the moment this mounts, not on the first
  // Record press — there's no reliable cross-browser way to check
  // permission status without actually calling getUserMedia (the
  // Permissions API doesn't cover microphone in Safari at all), so this is
  // the only way to surface the prompt/denial before she's mid-interaction
  // rather than have it interrupt an already-in-progress attempt.
  useEffect(() => {
    mountedRef.current = true
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        setPhase('idle')
      })
      .catch(() => {
        if (mountedRef.current) setError("Couldn't access the microphone — check your browser/device permissions and try again.")
      })
    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Timer only advances while actively recording — holds in place while
  // paused, so it reflects actual submitted-audio duration, not wall-clock
  // time since the first press.
  useEffect(() => {
    if (phase !== 'recording') return
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [phase])

  function beginOrResume() {
    if (phase === 'idle') {
      if (!streamRef.current) return
      chunksRef.current = []
      const recorder = new MediaRecorder(streamRef.current)
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorderRef.current = recorder
      recorder.start()
      setEverStarted(true)
      setPhase('recording')
    } else if (phase === 'paused') {
      recorderRef.current?.resume()
      setPhase('recording')
    }
  }

  function pause() {
    recorderRef.current?.pause()
    setPhase('paused')
  }

  function stopAndSave() {
    const recorder = recorderRef.current
    if (!recorder) return
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      onSave(blob)
    }
    recorder.stop()
  }

  function handleCancelClick() {
    if (!everStarted) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCancel()
      return
    }
    setConfirmingCancel(true)
  }

  function confirmCancel() {
    recorderRef.current?.stop()
    chunksRef.current = []
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCancel()
  }

  const toggleBtn = 'w-full md:w-auto px-6 py-4 md:py-3 rounded-xl font-semibold transition text-white disabled:opacity-50'
  const stopBtn = 'w-full md:w-auto px-6 py-4 md:py-3 rounded-xl font-semibold transition text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:hover:bg-green-600'

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-red-600">Back</button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {everStarted && (
        <p className="text-sm font-bold text-[#2F3E4E] tabular-nums">{formatDuration(elapsedSeconds)}</p>
      )}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        {phase === 'recording' ? (
          <button type="button" onClick={pause} className={`${toggleBtn} bg-amber-500 hover:bg-amber-600`}>
            ⏸ Pause Recording
          </button>
        ) : phase === 'paused' ? (
          <button type="button" onClick={beginOrResume} className={`${toggleBtn} bg-red-600 hover:bg-red-700`}>
            ● Resume Recording
          </button>
        ) : (
          <button type="button" onClick={beginOrResume} disabled={phase === 'requesting'} className={`${toggleBtn} bg-red-600 hover:bg-red-700`}>
            ● Record
          </button>
        )}
        <button type="button" onClick={stopAndSave} disabled={!everStarted} className={stopBtn}>
          ⏹ Stop Recording &amp; Save
        </button>
        <button
          type="button"
          onClick={handleCancelClick}
          className="w-full md:w-auto px-6 py-4 md:py-3 rounded-full border-2 border-[#D9E1E8] text-[#7A8F79] hover:border-red-300 hover:text-red-500 transition flex items-center justify-center gap-1.5 text-sm font-semibold"
        >
          ✕ Cancel
        </button>
      </div>

      {confirmingCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirmingCancel(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-[#2F3E4E] mb-3">Continuing will delete recorded audio for this entry, would you like to continue?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmingCancel(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">
                Go Back
              </button>
              <button type="button" onClick={confirmCancel} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
