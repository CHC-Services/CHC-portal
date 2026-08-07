'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ServicesPage() {
  const [form, setForm] = useState({ name: '', email: '', question: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contact-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again or email us directly at support@cominghomecare.com.')
      }
    } catch {
      setError('Something went wrong. Please try again or email us directly at support@cominghomecare.com.')
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
            Billing & Care Coordination
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            More Than Billing — A Connected Care Platform
          </h1>
          <p className="mt-3 text-[#D9E1E8] text-sm max-w-xl leading-relaxed">
            Coming Home Care started as a medical billing service for home care providers, and has grown into a
            full care-coordination platform. Once enrolled, we manage claim submission, monitor for follow-up
            responses, track reimbursements, and give your whole care team — providers, families, and
            patients — a secure, connected place to stay on top of it all, so you can focus
            on what matters most: <span className="font-bold italic text-lg text-[#7A8F79]">care</span>.
          </p>
        </div>
      </div>

      {/* What we offer */}
      <div className="px-6 md:px-10 py-10 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">What&rsquo;s Included</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: '📤', title: 'Claim Billing', body: 'We submit claims to primary & secondary payers on your behalf, accurately and on time.' },
            { icon: '💰', title: 'Reimbursement Tracking', body: 'Full visibility into what was billed, what was paid, and what is still outstanding.' },
            { icon: '🗂️', title: 'Secure EOB Storage', body: 'Related EOBs are securely uploaded and available to be printed or downloaded.' },
            { icon: '👨‍👩‍👧', title: 'Family Portal Access', body: 'Family members and guardians get their own secure login to stay connected to a loved one’s care.' },
            { icon: '💊', title: 'Medication Order Reminders', body: 'Automatic refill and reorder reminders so medications never lapse.' },
            { icon: '🔗', title: 'Team Document Coordination', body: 'Providers, office staff, and families can share and review documents from one connected record.' },
            { icon: '📅', title: 'Prior Authorization Reminders', body: 'Advance alerts before a PA is set to expire, so renewals happen before care is interrupted.' },
            { icon: '🔒', title: 'HIPAA-Level Secure Storage', body: 'Documents are encrypted at rest and in transit, meeting HIPAA-level security standards.' },
          ].map(card => (
            <div key={card.title} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="text-3xl mb-3">{card.icon}</div>
              <p className="font-semibold text-[#2F3E4E] text-sm mb-1">{card.title}</p>
              <p className="text-xs text-[#7A8F79] leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>

        {/* Billing enrollment callout */}
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#2F3E4E] text-sm mb-1">Ready to enroll in billing services?</p>
            <p className="text-xs text-[#7A8F79]">Tell us about your patients and insurances so we can get you set up.</p>
          </div>
          <Link
            href="/inquiry"
            className="shrink-0 bg-[#2F3E4E] hover:bg-[#7A8F79] text-white font-semibold px-5 py-2.5 rounded-lg transition text-sm whitespace-nowrap"
          >
            Start Billing Inquiry →
          </Link>
        </div>

        {/* Simple contact form */}
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          {submitted ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-[#2F3E4E] mb-2">Question Received!</h2>
              <p className="text-sm text-[#7A8F79] max-w-sm mx-auto">
                Thanks for reaching out. Please allow <strong className="text-[#2F3E4E]">24–48 hours</strong> for
                our team to review and reply.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-[#2F3E4E] mb-1">Have a Question?</h2>
              <p className="text-sm text-[#7A8F79] mb-6">
                Send us a quick note and we&apos;ll get back to you within 24–48 hours.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79]"
                  />
                </div>

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

                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Question *</label>
                  <textarea
                    required
                    rows={5}
                    value={form.question}
                    onChange={e => setForm({ ...form, question: e.target.value })}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7A8F79] resize-none"
                  />
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2F3E4E] hover:bg-[#7A8F79] text-white font-semibold py-3 rounded-lg transition text-sm disabled:opacity-50"
                >
                  {loading ? 'Submitting…' : 'Submit Question'}
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
