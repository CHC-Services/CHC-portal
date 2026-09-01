'use client'

import { useEffect, useRef, useState } from 'react'

// Reusable audio-capture control — record/pause/resume/stop&save/cancel, with
// a running duration timer. Fully self-contained (owns getUserMedia/
// MediaRecorder internally); the caller just gets a final Blob via onSave or
// a cancellation signal via onCancel. Not wired to any particular feature —
// drop it in anywhere audio capture is needed.
//
// Mobile OSes (iOS Safari in particular) forcibly end the microphone's
// MediaStreamTrack when the screen locks or the tab is backgrounded long
// enough — there is no way for web content to prevent this. Previously this
// desynced our `phase` state from the MediaRecorder's real internal state:
// the browser auto-stops the recorder (and fires a `stop` event) the moment
// the track ends, but `onstop` was only wired up inside stopAndSave(), so
// that event fired into the void while the phone slept. When the nurse woke
// the phone and tapped Resume/Stop, those handlers called .resume()/.stop()
// on an already-inactive MediaRecorder, which throws synchronously — the
// throw happened before the matching setPhase(...) call, so the UI never
// updated and every subsequent tap repeated the same silent failure. Cancel
// still worked because it doesn't touch the (already-dead) recorder for its
// happy path.
//
// Fix: `recorder.onstop` is wired up once, immediately, and is the single
// place a final Blob gets built — whether the stop was the nurse tapping
// "Stop & Save" or the OS yanking the mic out from under her. An unexpected
// stop auto-saves whatever was captured (same path as a deliberate Stop &
// Save) instead of leaving her stuck, since the caller's next phase is a
// transcript she reviews before signing anyway. Track `onended` is also
// wired up directly as a belt-and-suspenders trigger, and every recorder
// call is wrapped so a stale/inactive recorder can never again produce a
// button that just silently does nothing.

type Phase = 'requesting' | 'idle' | 'recording' | 'paused' | 'finalizing'

// The upload route this feeds (app/api/quick-notes/notes/[id]/voice-entries/start)
// sits behind this server's ~4MB request-body ceiling (see the same limit
// noted in app/api/admin/documents/route.ts) — a recording that grows past
// that used to upload fine client-side and only fail once it hit the server,
// by which point the nurse had already stopped talking and had no chance to
// react. These two caps (whichever is hit first — bitrate varies by browser/
// device, so real accumulated bytes are tracked live rather than estimated)
// drive the progress bar below and force a clean auto-stop-and-save well
// before the actual server limit, instead of an upload failure after the fact.
const MAX_RECORDING_BYTES = 3.5 * 1024 * 1024 // ~3.5MB, safely under the ~4MB server ceiling
const MAX_RECORDING_SECONDS = 600 // 10 minutes — a generous ceiling for one spoken note; she can start a new voice entry to continue

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
  const [interrupted, setInterrupted] = useState(false)
  const [totalBytes, setTotalBytes] = useState(0)
  const [limitReason, setLimitReason] = useState<'size' | 'duration' | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mountedRef = useRef(true)
  // Guards against building/emitting a Blob more than once — both the track
  // ending and the recorder's own auto-stop can trigger the same finalize path.
  const finalizedRef = useRef(false)
  const cancelledRef = useRef(false)
  // Real running total, not the totalBytes state (which is only for the
  // progress-bar render) — ondataavailable's closure would otherwise see a
  // stale value from whenever the recorder was created.
  const totalBytesRef = useRef(0)
  // Guards against triggering the size and duration checks both firing for
  // the same recording.
  const autoStoppedRef = useRef(false)

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
        // Belt-and-suspenders: browsers are spec-required to auto-stop the
        // MediaRecorder (firing `stop`) when its source track ends, but we
        // force it ourselves too in case that doesn't fire promptly — this
        // is what actually saves her audio when the OS revokes the mic
        // mid-recording instead of leaving the recorder in limbo.
        stream.getTracks().forEach(track => {
          track.onended = () => {
            if (cancelledRef.current) return
            try {
              if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                recorderRef.current.stop()
              } else {
                // Recorder was already idle/paused-with-no-data — finalize
                // directly since no `stop` event will arrive to do it for us.
                finalize()
              }
            } catch {
              finalize()
            }
          }
        })
        setPhase('idle')
      })
      .catch(() => {
        if (mountedRef.current) setError("Couldn't access the microphone — check your browser/device permissions and try again.")
      })
    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Timer only advances while actively recording — holds in place while
  // paused, so it reflects actual submitted-audio duration, not wall-clock
  // time since the first press.
  useEffect(() => {
    if (phase !== 'recording') return
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [phase])

  // Duration side of the recording-limit check — the size side is checked
  // directly in ondataavailable below, since that's where real byte counts
  // arrive.
  useEffect(() => {
    if (elapsedSeconds >= MAX_RECORDING_SECONDS) autoStop('duration')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds])

  // Cuts the recording off cleanly the moment either cap is reached, instead
  // of letting her keep talking into a recording that's already too big to
  // upload — reuses the same stop->onstop->finalize path a manual "Stop &
  // Save" tap goes through, so whatever was captured up to this point is
  // still saved normally.
  function autoStop(reason: 'size' | 'duration') {
    if (autoStoppedRef.current) return
    autoStoppedRef.current = true
    setLimitReason(reason)
    setPhase('finalizing')
    stopAndSave()
  }

  // Single place a final Blob gets produced, regardless of what triggered
  // the stop. Safe to call more than once (only the first call does anything).
  function finalize() {
    if (finalizedRef.current) return
    finalizedRef.current = true
    streamRef.current?.getTracks().forEach(t => { t.onended = null; t.stop() })
    if (cancelledRef.current) {
      chunksRef.current = []
      onCancel()
      return
    }
    if (chunksRef.current.length === 0) {
      if (mountedRef.current) setError("The recording was interrupted before anything was captured — please try again.")
      return
    }
    const mimeType = recorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    onSave(blob)
  }

  function beginOrResume() {
    if (phase === 'idle') {
      if (!streamRef.current) return
      chunksRef.current = []
      finalizedRef.current = false
      cancelledRef.current = false
      autoStoppedRef.current = false
      totalBytesRef.current = 0
      setTotalBytes(0)
      setLimitReason(null)
      const recorder = new MediaRecorder(streamRef.current)
      recorder.ondataavailable = e => {
        if (e.data.size <= 0) return
        chunksRef.current.push(e.data)
        totalBytesRef.current += e.data.size
        setTotalBytes(totalBytesRef.current)
        if (totalBytesRef.current >= MAX_RECORDING_BYTES) autoStop('size')
      }
      // Wired up immediately (not just inside a "Stop & Save" click) so an
      // OS-forced stop while the screen is locked still gets captured.
      recorder.onstop = finalize
      recorderRef.current = recorder
      // Timeslice so chunks (and real byte counts) arrive periodically
      // instead of only at stop() — needed for the live capacity check above.
      recorder.start(1000)
      setEverStarted(true)
      setInterrupted(false)
      setPhase('recording')
    } else if (phase === 'paused') {
      try {
        if (recorderRef.current?.state === 'paused') {
          recorderRef.current.resume()
          setPhase('recording')
        } else {
          // Recorder is no longer in a resumable state (e.g. the mic was
          // revoked while paused) — recover instead of leaving the tap dead.
          finalize()
        }
      } catch {
        finalize()
      }
    }
  }

  function pause() {
    try {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.pause()
        setPhase('paused')
      } else {
        finalize()
      }
    } catch {
      finalize()
    }
  }

  function stopAndSave() {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      } else {
        // Already stopped (e.g. by the OS while she was away) — finalize()
        // has either already run via that stop event, or needs to run now.
        finalize()
      }
    } catch {
      finalize()
    }
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
    cancelledRef.current = true
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
        return
      }
    } catch { /* fall through to direct finalize below */ }
    finalize()
  }

  // If she comes back to a phone that woke up mid-recording, the track/
  // onstop handlers above will already have finalized (and this component
  // will be mid-unmount as the parent moves to its transcribing phase) —
  // but on the off chance the tab is still catching up, surface a clear
  // "reconnecting" state instead of buttons that look interactive but aren't.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      if (!mountedRef.current || finalizedRef.current) return
      if (phase !== 'recording' && phase !== 'paused') return
      const track = streamRef.current?.getAudioTracks()[0]
      const recorderDead = !recorderRef.current || recorderRef.current.state === 'inactive'
      if (track?.readyState === 'ended' || recorderDead) {
        setInterrupted(true)
        setPhase('finalizing')
        finalize()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [phase])

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

  if (phase === 'finalizing') {
    return (
      <div className="border border-[#D9E1E8] bg-[#F4F6F5] rounded-lg p-3 space-y-1">
        <p className="text-sm font-semibold text-[#2F3E4E]">
          {limitReason
            ? `Recording ${limitReason === 'size' ? 'length' : 'time'} limit reached — saving what you recorded…`
            : interrupted ? 'Recording was interrupted — saving what was captured…' : 'Saving…'}
        </p>
        {limitReason && (
          <p className="text-xs text-[#7A8F79]">Start a new voice entry to keep going.</p>
        )}
      </div>
    )
  }

  const sizeFraction = Math.min(totalBytes / MAX_RECORDING_BYTES, 1)
  const durationFraction = Math.min(elapsedSeconds / MAX_RECORDING_SECONDS, 1)
  const capacityUsed = Math.max(sizeFraction, durationFraction)
  const capacityPct = Math.round(capacityUsed * 100)
  const barColor = capacityUsed >= 0.9 ? 'bg-red-500' : capacityUsed >= 0.7 ? 'bg-amber-500' : 'bg-green-500'

  return (
    <div className="space-y-2">
      {everStarted && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[#2F3E4E] tabular-nums">{formatDuration(elapsedSeconds)}</p>
            <p className="text-[10px] font-semibold text-[#7A8F79]">{capacityPct}% of max length</p>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#F4F6F5] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${capacityPct}%` }} />
          </div>
          {capacityUsed >= 0.85 && phase === 'recording' && (
            <p className="text-[10px] font-semibold text-amber-600">Approaching the recording limit — wrap up or pause &amp; submit soon.</p>
          )}
        </div>
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
