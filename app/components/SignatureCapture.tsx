'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'

// Reusable canvas signature-capture UI. Reuses the exact device-pixel-ratio
// scaling + PNG export pattern already proven in app/nurse/documents/page.tsx's
// W-9 signing flow, but this component's job ends at producing a data URL —
// what the caller does with it (save it as the nurse's reusable signature,
// embed it into a specific signed document, etc.) is the caller's concern.
export default function SignatureCapture({
  existingImageUrl, onSave, saving,
}: {
  existingImageUrl?: string | null
  onSave: (dataUrl: string) => void
  saving?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [redrawing, setRedrawing] = useState(!existingImageUrl)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    setRedrawing(!existingImageUrl)
  }, [existingImageUrl])

  useEffect(() => {
    if (!redrawing) return
    const timer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ratio = Math.max(window.devicePixelRatio || 1, 2)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)
      const pad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(0,0,0,0)',
        penColor: '#000000',
        minWidth: 1.5,
        maxWidth: 4,
      })
      pad.addEventListener('endStroke', () => setEmpty(pad.isEmpty()))
      padRef.current = pad
      setEmpty(true)
    }, 80)
    return () => clearTimeout(timer)
  }, [redrawing])

  function clearPad() {
    padRef.current?.clear()
    setEmpty(true)
  }

  function save() {
    if (!padRef.current || padRef.current.isEmpty()) return
    onSave(padRef.current.toDataURL('image/png'))
  }

  if (!redrawing && existingImageUrl) {
    return (
      <div className="space-y-3">
        <div className="border border-[#D9E1E8] rounded-lg bg-[#F4F6F5] p-4 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingImageUrl} alt="Your signature" className="max-h-24" />
        </div>
        <button
          type="button"
          onClick={() => setRedrawing(true)}
          className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition"
        >
          Redraw Signature
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full h-32 border border-[#D9E1E8] rounded-lg bg-white touch-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={empty || saving}
          className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Signature'}
        </button>
        <button
          type="button"
          onClick={clearPad}
          className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition"
        >
          Clear
        </button>
        {existingImageUrl && (
          <button
            type="button"
            onClick={() => setRedrawing(false)}
            className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition ml-auto"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
