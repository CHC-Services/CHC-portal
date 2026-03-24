'use client'

import { forwardRef, useRef, useImperativeHandle, useState, useEffect } from 'react'

export type DateInputHandle = {
  focus: () => void
}

type Props = {
  value: string          // YYYY-MM-DD or ''
  onChange: (iso: string) => void
  className?: string
}

export const DateInput = forwardRef<DateInputHandle, Props>(function DateInput(
  { value, onChange, className = '' },
  ref
) {
  const mmRef   = useRef<HTMLInputElement>(null)
  const ddRef   = useRef<HTMLInputElement>(null)
  const yyyyRef = useRef<HTMLInputElement>(null)

  const [mm,   setMm]   = useState('')
  const [dd,   setDd]   = useState('')
  const [yyyy, setYyyy] = useState('')

  // Sync inward when parent sets value (e.g. Yesterday / Today quick-fill)
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-')
      setMm(m ?? '')
      setDd(d ?? '')
      setYyyy(y ?? '')
    } else {
      setMm('')
      setDd('')
      setYyyy('')
    }
  }, [value])

  useImperativeHandle(ref, () => ({
    focus: () => mmRef.current?.focus()
  }))

  function emit(newMm: string, newDd: string, newYyyy: string) {
    if (newMm.length === 2 && newDd.length === 2 && newYyyy.length === 4) {
      onChange(`${newYyyy}-${newMm.padStart(2,'0')}-${newDd.padStart(2,'0')}`)
    } else {
      onChange('')
    }
  }

  function handleMm(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setMm(val)
    emit(val, dd, yyyy)
    if (val.length === 2) ddRef.current?.focus()
  }

  function handleDd(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDd(val)
    emit(mm, val, yyyy)
    if (val.length === 2) yyyyRef.current?.focus()
  }

  function handleYyyy(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setYyyy(val)
    emit(mm, dd, val)
  }

  // Backspace on empty dd → go back to mm
  function handleDdKey(e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && dd === '') mmRef.current?.focus()
  }

  // Backspace on empty yyyy → go back to dd
  function handleYyyyKey(e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && yyyy === '') ddRef.current?.focus()
  }

  const seg = `border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] text-center tabular-nums ${className}`

  return (
    <div className="flex items-center gap-1">
      <input ref={mmRef}   type="text" inputMode="numeric" placeholder="MM"   value={mm}   onChange={handleMm}                         maxLength={2} required className={`${seg} w-12`} />
      <span className="text-[#7A8F79] font-bold select-none">/</span>
      <input ref={ddRef}   type="text" inputMode="numeric" placeholder="DD"   value={dd}   onChange={handleDd}   onKeyDown={handleDdKey}   maxLength={2} required className={`${seg} w-12`} />
      <span className="text-[#7A8F79] font-bold select-none">/</span>
      <input ref={yyyyRef} type="text" inputMode="numeric" placeholder="YYYY" value={yyyy} onChange={handleYyyy} onKeyDown={handleYyyyKey} maxLength={4} required className={`${seg} w-16`} />
    </div>
  )
})
