'use client'

import { useState } from 'react'
import { fmtPhoneInput } from '../../lib/formatPhone'
import { GUARDIAN_RELATIONSHIPS, type GuardianRelationship } from '../../lib/guardianRelationship'

export type GuardianInviteData = {
  name: string
  email: string
  phone: string
  relationship: GuardianRelationship
  hipaaAcknowledged: true
}

type Props = {
  patientName: string
  onInvite: (data: GuardianInviteData) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}

const HIPAA_URL = 'https://www.hhs.gov/hipaa/for-professionals/index.html'

export default function GuardianInviteModal({ patientName, onInvite, onClose }: Props) {
  const [step, setStep] = useState<'hipaa' | 'form'>('hipaa')
  const [acknowledged, setAcknowledged] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState<GuardianRelationship>('Parent')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    setError('')
    const result = await onInvite({ name: name.trim(), email: email.trim(), phone, relationship, hipaaAcknowledged: true })
    setSubmitting(false)
    if (result.ok) {
      setSuccess(`Invitation sent to ${email.trim()}.`)
    } else {
      setError(result.error || 'Failed to send invitation.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        {step === 'hipaa' ? (
          <>
            <h2 className="text-lg font-bold text-[#2F3E4E] mb-3">Before You Invite a Care Team Member</h2>
            <div className="bg-[#F4F6F5] border border-[#D9E1E8] rounded-xl p-4 text-sm text-[#2F3E4E] space-y-2 mb-4 leading-relaxed">
              <p>
                This site contains sensitive medical information. Only individuals actively on{' '}
                <strong>{patientName}&rsquo;s</strong> care team are allowed to access and view data here.
              </p>
              <p>
                By inviting a new care team member, you are confirming that the invitee has full authorization
                and approval to have an account for this patient.
              </p>
              <p>
                Coming Home Care is not responsible for medical information once it has been shared or
                downloaded from this site.
              </p>
              <p>
                If you have any questions, please review the{' '}
                <a href={HIPAA_URL} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-[#2F3E4E]">
                  current HIPAA regulations
                </a>.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm text-[#2F3E4E] mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>I have read this notice and confirm the person I am about to invite is authorized to have access.</span>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 border border-[#D9E1E8] rounded-lg py-2 text-sm font-semibold text-[#7A8F79]">
                Cancel
              </button>
              <button
                type="button"
                disabled={!acknowledged}
                onClick={() => setStep('form')}
                className="flex-1 bg-[#2F3E4E] text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </>
        ) : success ? (
          <>
            <h2 className="text-lg font-bold text-[#2F3E4E] mb-2">Invitation Sent</h2>
            <p className="text-sm text-[#7A8F79] mb-4">{success}</p>
            <button onClick={onClose} className="w-full bg-[#2F3E4E] text-white rounded-lg py-2 text-sm font-semibold">
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="text-lg font-bold text-[#2F3E4E] mb-3">Invite a Care Team Member</h2>
            {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}
            <div className="space-y-2 mb-4">
              <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              <input type="tel" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(fmtPhoneInput(e.target.value))}
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Relationship to Patient</label>
                <select
                  value={relationship}
                  onChange={e => setRelationship(e.target.value as GuardianRelationship)}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  {GUARDIAN_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('hipaa')} className="flex-1 border border-[#D9E1E8] rounded-lg py-2 text-sm font-semibold text-[#7A8F79]">
                Back
              </button>
              <button type="submit" disabled={submitting} className="flex-1 bg-[#2F3E4E] text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
                {submitting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
