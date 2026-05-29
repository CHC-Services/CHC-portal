'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return
    const next = [...code]
    next[i] = val
    setCode(next)
    if (val && i < 5) inputs.current[i + 1]?.focus()
    if (next.every(d => d !== '')) submitCode(next.join(''))
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const next = pasted.split('')
      setCode(next)
      inputs.current[5]?.focus()
      submitCode(pasted)
    }
    e.preventDefault()
  }

  async function submitCode(fullCode: string) {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: fullCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid code')
        setCode(['', '', '', '', '', ''])
        setTimeout(() => inputs.current[0]?.focus(), 50)
        setLoading(false)
        return
      }
      if (data.role === 'admin') {
        router.push('/admin')
      } else if ((data.role === 'nurse' || data.role === 'provider') && !data.portalAgreementSigned) {
        router.push('/nurse/agreement')
      } else {
        router.push('/nurse')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-stretch">

      {/* Left branding panel */}
      <div className="hidden md:flex flex-col justify-center bg-[#2F3E4E] text-white w-1/3 px-12 py-16 gap-6">
        <div className="border-t border-[#3d5166] pt-6">
          <p className="text-sm tracking-widest text-[#7A8F79] font-semibold">
            <span className="italic text-lg">my</span><span className="font-bold text-lg text-white">Provider</span>
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white leading-snug">Text Message<br />Authentication</p>
          <p className="text-sm text-[#D9E1E8] mt-3 leading-relaxed">
            We sent a one-time code to your phone. Enter the 6-digit number from that text message.
          </p>
        </div>
        <div className="border-t border-[#3d5166] pt-4 text-xs text-[#7A8F79] leading-relaxed">
          The code expires in five minutes. If you don&apos;t receive it, try logging in again.
        </div>
      </div>

      {/* Right — code entry */}
      <div className="flex flex-col justify-center w-full md:w-2/3 px-8 md:px-16 py-16">
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-2">
            <Image src="/chc_logo.png" alt="CHC Logo" width={180} height={60} className="h-auto mb-6" />
          </div>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Security Check</p>
          <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">Enter your 6-digit code</h1>
          <p className="text-sm text-[#7A8F79] mb-8">Enter the 6-digit code we sent to your phone.</p>

          {/* 6 digit inputs */}
          <div className="flex gap-2 mb-6" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading}
                className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl text-[#2F3E4E] bg-white focus:outline-none focus:border-[#7A8F79] transition disabled:opacity-50"
                style={{ borderColor: digit ? '#7A8F79' : '#D9E1E8' }}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-center">
              {error}
            </p>
          )}

          {loading && (
            <p className="text-sm text-[#7A8F79] text-center">Verifying…</p>
          )}

          <p className="mt-6 text-center text-xs text-[#7A8F79]">
            Wrong account?{' '}
            <a href="/login" className="underline underline-offset-2 hover:text-[#2F3E4E] transition">
              Back to login
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
