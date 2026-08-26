'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { fmtPhoneInput } from '../../../lib/formatPhone'
import DateInput from '../../components/DateInput'
import { US_STATES } from '../../components/patient/types'

const inputClass = 'w-full border border-[#D9E1E8] p-2.5 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'

export default function YourInformationPage() {
  const router = useRouter()

  const [loaded, setLoaded] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/your-information', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setFirstName(data.firstName || '')
        setLastName(data.lastName || '')
        setDob(data.dob || '')
        setPhone(data.phone || '')
        setAddress(data.address || '')
        setCity(data.city || '')
        setState(data.state || '')
        setZip(data.zip || '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/your-information', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName, lastName, dob, phone, address, city, state, zip }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      router.push(data.role === 'guardian' ? '/login/link-patient' : '/nurse')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (!loaded) return null

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-start justify-center pt-16 px-4 pb-16">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#2F3E4E] px-8 py-6">
          <Image src="/chc_logo.png" alt="CHC Logo" width={140} height={48} className="h-auto mb-4 brightness-0 invert" />
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Welcome</p>
          <h2 className="text-xl font-bold text-white leading-snug">Your Information</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6">
          <p className="text-sm text-[#4a5568] leading-relaxed mb-5">
            Before you continue, confirm a few details for your account.
          </p>

          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <DateInput value={dob} onChange={e => setDob(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                type="tel"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={e => setPhone(fmtPhoneInput(e.target.value))}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className={labelClass}>City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <select value={state} onChange={e => setState(e.target.value)} required className={inputClass}>
                  <option value="" disabled>—</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Zip</label>
                <input type="text" value={zip} onChange={e => setZip(e.target.value)} required className={inputClass} />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
