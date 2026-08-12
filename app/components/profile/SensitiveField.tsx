'use client'

import { useState } from 'react'
import DateInput from '../DateInput'

// Shared show/hide-masked input for encrypted profile fields (DOB, SSN, NPI,
// Medicaid ID). Extracted from app/nurse/profile/page.tsx so every profile
// card can use the same encrypted-field UX instead of redefining it per page.
export default function SensitiveField({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
        {label}
        <span className="ml-2 text-[10px] normal-case font-normal bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">encrypted</span>
      </label>
      <div className="relative">
        {type === 'date' && show ? (
          <DateInput
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] pr-16"
          />
        ) : (
          <input
            type={type === 'date' ? 'password' : (show ? type : 'password')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] pr-16"
          />
        )}
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7A8F79] hover:text-[#2F3E4E]">
          {show ? 'hide' : 'show'}
        </button>
      </div>
    </div>
  )
}
