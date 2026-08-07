'use client'

import { useState } from 'react'
import Link from 'next/link'
import { fmtPhoneInput } from '../../lib/formatPhone'

export default function InquiryPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    patientCount: '1',
    insuranceCount: '1',
    insuranceNames: [''],
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleCountChange(count: string) {
    const n = Math.max(1, Math.min(10, parseInt(count) || 1))
    const names = Array.from({ length: n }, (_, i) => form.insuranceNames[i] || '')
    setForm({ ...form, insuranceCount: String(n), insuranceNames: names })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again or email us directly at enroll@cominghomecare.com.')
      }
    } catch {
      setError('Something went wrong. Please try again or email us directly at enroll@cominghomecare.com.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* Hero */}
      <div className="bg-[#2F3E4E] px-6 md:px-10 py-12 md:py-16">
        <div className="max-w-3xl">
          <p className="text-[#7A8F79] text-sm font-semibold uppercase tracking-widest mb-2">
            Billing Enrollment Inquiry
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            Let Us Handle Your Billing
          </h1>
          <p className="mt-3 text-[#D9E1E8] text-sm max-w-xl leading-relaxed">
            Tell us a bit about your billing needs and we&apos;ll follow up within 24&ndash;48 hours. Looking for
            general info instead? Visit our <Link href="/services" className="font-semibold text-[#7A8F79] underline underline-offset-2 hover:text-white transition">Services page</Link>.
          </p>
        </div>
      </div>

      <div className="px-6 md:px-10 py-10 max-w-3xl">
        {/* Contact Form */}
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          {submitted ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-[#2F3E4E] mb-2">Inquiry Received!</h2>
              <p className="text-sm text-[#7A8F79] max-w-sm mx-auto">
                Thank you for reaching out. Please allow <strong className="text-[#2F3E4E]">24–48 hours</strong> for
                our team to review your inquiry and get back to you.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-[#2F3E4E] mb-1">Request More Information</h2>
              <p className="text-sm text-[#7A8F79] mb-6">
                Fill out the form below and we&apos;ll be in touch within 24–48 hours. Or <Link href="/signup" className="font-semibold text-[#2F3E4E] underline underline-offset-2 hover:text-[#7A8F79] transition">
              register as a new user
            </Link> to enroll in billing services.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Name row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">First Name *</label>
                    <input
                      required
                      value={form.firstName}
                      onChange={e => setForm({ ...form, firstName: e.target.value })}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Last Name *</label>
                    <input
                      required
                      value={form.lastName}
                      onChange={e => setForm({ ...form, lastName: e.target.value })}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                    Phone Number{' '}
                    <span className="text-[#7A8F79] font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: fmtPhoneInput(e.target.value) })}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                  />
                </div>

                {/* Patient count */}
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                    How many patients do you submit claims for currently? *
                  </label>
                  <select
                    value={form.patientCount}
                    onChange={e => setForm({ ...form, patientCount: e.target.value })}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                  >
                    {['1', '2', '3', '4', '5+'].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Insurance count */}
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                    How many insurances do you bill? *
                  </label>
                  <select
                    value={form.insuranceCount}
                    onChange={e => handleCountChange(e.target.value)}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Insurance names */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#2F3E4E]">Insurance Name(s) *</label>
                  {form.insuranceNames.map((name, i) => (
                    <input
                      key={i}
                      required
                      placeholder={`Insurance ${i + 1}`}
                      value={name}
                      onChange={e => {
                        const updated = [...form.insuranceNames]
                        updated[i] = e.target.value
                        setForm({ ...form, insuranceNames: updated })
                      }}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                    />
                  ))}
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2F3E4E] hover:bg-[#7A8F79] text-white font-semibold py-3 rounded-lg transition text-sm disabled:opacity-50"
                >
                  {loading ? 'Submitting…' : 'Submit Inquiry'}
                </button>

                <p className="text-xs text-center text-[#7A8F79]">
                  Please allow 24–48 hours for our team to review and reply.
                  <br/><br/>* indicates a required field
                </p>

              </form>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
