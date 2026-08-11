'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Drop-in replacement for <input type="date">. Same value/onChange contract
// (ISO "yyyy-mm-dd" string in, a fake ChangeEvent with .target.value out) so
// existing call sites swap the tag without touching their state logic.
//
// Native <input type="date"> already auto-advances month->day->year as you
// type in Chrome/Edge/Safari, but that's the browser's own picker UI and
// isn't guaranteed everywhere — this reimplements the same auto-advance
// behavior as three plain text segments so it's consistent regardless of
// browser, at the cost of the native calendar popup / mobile date-wheel.
type FakeEvent = { target: { value: string } }

type Props = {
  value: string
  onChange: (e: FakeEvent) => void
  required?: boolean
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  id?: string
  title?: string
  autoFocus?: boolean
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  // Focuses this ref once the year segment is filled — chains a run of date
  // fields (e.g. submit date -> DOS start -> DOS stop) into one continuous type.
  nextRef?: React.RefObject<HTMLInputElement | null>
}

function parseIso(value: string): { mm: string; dd: string; yyyy: string } {
  const m = (value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return { mm: '', dd: '', yyyy: '' }
  return { yyyy: m[1], mm: m[2], dd: m[3] }
}

const DateInput = forwardRef<HTMLInputElement, Props>(function DateInput(
  { value, onChange, required, disabled, className, style, id, title, autoFocus, onBlur, onKeyDown, nextRef },
  forwardedRef
) {
  const [mm, setMm] = useState('')
  const [dd, setDd] = useState('')
  const [yyyy, setYyyy] = useState('')
  const ddRef = useRef<HTMLInputElement>(null)
  const yyyyRef = useRef<HTMLInputElement>(null)
  const mmRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // A ref on <DateInput> focuses the month segment — matches how a ref on a
  // plain <input> would let a caller focus the field.
  useImperativeHandle(forwardedRef, () => mmRef.current as HTMLInputElement)

  useEffect(() => {
    if (autoFocus) mmRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (onBlur && !containerRef.current?.contains(e.relatedTarget as Node)) onBlur()
  }

  // Resync from the parent's value when it changes from outside (form reset,
  // loading an existing record) — but not on every keystroke, since we already
  // hold the authoritative in-progress segments locally while typing.
  useEffect(() => {
    const parsed = parseIso(value)
    const composed = mm.length === 2 && dd.length === 2 && yyyy.length === 4 ? `${yyyy}-${mm}-${dd}` : ''
    if (value !== composed) {
      setMm(parsed.mm); setDd(parsed.dd); setYyyy(parsed.yyyy)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function emit(nmm: string, ndd: string, nyyyy: string) {
    if (nmm.length === 2 && ndd.length === 2 && nyyyy.length === 4) {
      const monthNum = parseInt(nmm, 10)
      const dayNum = parseInt(ndd, 10)
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        onChange({ target: { value: `${nyyyy}-${nmm}-${ndd}` } })
        return
      }
    }
    onChange({ target: { value: '' } })
  }

  function handleMm(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
    setMm(digits)
    emit(digits, dd, yyyy)
    if (digits.length === 2 || (digits.length === 1 && parseInt(digits, 10) > 1)) ddRef.current?.focus()
  }

  function handleDd(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDd(digits)
    emit(mm, digits, yyyy)
    if (digits.length === 2 || (digits.length === 1 && parseInt(digits, 10) > 3)) yyyyRef.current?.focus()
  }

  function handleYyyy(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
    setYyyy(digits)
    emit(mm, dd, digits)
    if (digits.length === 4 && nextRef?.current) {
      setTimeout(() => nextRef.current!.focus(), 10)
    }
  }

  function handleMmKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget
    if (e.key === 'ArrowRight' && el.selectionStart === mm.length) ddRef.current?.focus()
    onKeyDown?.(e)
  }
  function handleDdKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget
    if (e.key === 'Backspace' && dd === '') mmRef.current?.focus()
    else if (e.key === 'ArrowLeft' && el.selectionStart === 0) mmRef.current?.focus()
    else if (e.key === 'ArrowRight' && el.selectionStart === dd.length) yyyyRef.current?.focus()
    onKeyDown?.(e)
  }
  function handleYyyyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget
    if (e.key === 'Backspace' && yyyy === '') ddRef.current?.focus()
    else if (e.key === 'ArrowLeft' && el.selectionStart === 0) ddRef.current?.focus()
    onKeyDown?.(e)
  }

  const segCls = 'bg-transparent outline-none text-center tabular-nums min-w-0'

  return (
    <div ref={containerRef} id={id} title={title} onBlur={handleContainerBlur} className={`${className || ''} flex items-center justify-center gap-1`} style={style}>
      <input
        ref={mmRef} value={mm} onChange={handleMm} onKeyDown={handleMmKeyDown}
        onFocus={e => e.currentTarget.select()}
        placeholder="MM" inputMode="numeric" maxLength={2} disabled={disabled} required={required}
        className={segCls} style={{ width: '2.1ch' }} aria-label="Month"
      />
      <span className="opacity-50">/</span>
      <input
        ref={ddRef} value={dd} onChange={handleDd} onKeyDown={handleDdKeyDown}
        onFocus={e => e.currentTarget.select()}
        placeholder="DD" inputMode="numeric" maxLength={2} disabled={disabled} required={required}
        className={segCls} style={{ width: '2.1ch' }} aria-label="Day"
      />
      <span className="opacity-50">/</span>
      <input
        ref={yyyyRef} value={yyyy} onChange={handleYyyy} onKeyDown={handleYyyyKeyDown}
        onFocus={e => e.currentTarget.select()}
        placeholder="YYYY" inputMode="numeric" maxLength={4} disabled={disabled} required={required}
        className={segCls} style={{ width: '4.1ch' }} aria-label="Year"
      />
    </div>
  )
})

export default DateInput
