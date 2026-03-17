'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Profile = Record<string, any>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({
  label,
  field,
  profile,
  setProfile,
  type = 'text',
  sensitive = false,
}: {
  label: string
  field: string
  profile: Profile
  setProfile: (p: Profile) => void
  type?: string
  sensitive?: boolean
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
        {label}
        {sensitive && (
          <span className="ml-2 text-[10px] normal-case font-normal bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
            encrypted
          </span>
        )}
      </label>
      <div className="relative">
        <input
          type={sensitive && !show ? 'password' : type}
          value={profile[field] || ''}
          onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
          className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] pr-16"
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7A8F79] hover:text-[#2F3E4E]"
          >
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </div>
  )
}

function AliasEditor({ aliases, onChange }: { aliases: string[]; onChange: (a: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const val = input.trim()
    if (!val || aliases.includes(val)) return
    onChange([...aliases, val])
    setInput('')
  }

  function remove(alias: string) {
    onChange(aliases.filter(a => a !== alias))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {aliases.length === 0 && (
          <span className="text-xs text-[#7A8F79] italic">No aliases set — this provider will see no claims.</span>
        )}
        {aliases.map(alias => (
          <span key={alias} className="flex items-center gap-1.5 bg-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-3 py-1 rounded-full">
            {alias}
            <button
              type="button"
              onClick={() => remove(alias)}
              className="text-[#7A8F79] hover:text-red-500 transition text-base leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="e.g. Janine or JCST"
          className="flex-1 border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />
        <button
          type="button"
          onClick={add}
          className="bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition"
        >
          Add
        </button>
      </div>
    </div>
  )
}

const ROLE_OPTIONS = [
  { value: 'nurse',    label: 'Nurse — Healthcare caregiver' },
  { value: 'biller',   label: 'Biller — Third-party billing access' },
  { value: 'provider', label: 'Provider — Other medical provider' },
  { value: 'guardian', label: 'Guardian — Parent / family member' },
  { value: 'admin',    label: 'Admin — Full portal access' },
]

export default function NurseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [userRole, setUserRole] = useState('')
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleMessage, setRoleMessage] = useState('')

  useEffect(() => {
    fetch(`/api/admin/nurses/${id}`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return }
        return r.json()
      })
      .then(data => {
        if (data) {
          setProfile(data)
          setUserRole(data.user?.role || 'nurse')
        }
      })
      .finally(() => setLoading(false))
  }, [id, router])

  async function saveRole() {
    setRoleSaving(true)
    setRoleMessage('')
    const res = await fetch(`/api/admin/users/${profile.userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role: userRole }),
    })
    setRoleSaving(false)
    setRoleMessage(res.ok ? 'Role updated.' : 'Error updating role.')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const res = await fetch(`/api/admin/nurses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile)
    })

    setSaving(false)
    setMessage(res.ok ? 'Saved successfully.' : 'Error saving.')
  }

  if (loading) return <div className="p-8 text-[#7A8F79]">Loading…</div>

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">
          ← Back to Roster
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#2F3E4E]">{profile.displayName}</h1>
          {profile.accountNumber && (
            <p className="text-sm font-mono text-[#7A8F79]">{profile.accountNumber}</p>
          )}
        </div>
      </div>

      {/* Portal Access — role dropdown, saved independently */}
      <div className="max-w-2xl mb-6 bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8] mb-4">
          Portal Access
        </h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Role</label>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={saveRole}
            disabled={roleSaving}
            className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold disabled:opacity-50"
          >
            {roleSaving ? 'Saving…' : 'Update Role'}
          </button>
        </div>
        {roleMessage && (
          <p className={`mt-2 text-xs font-medium ${roleMessage.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
            {roleMessage}
          </p>
        )}
      </div>

      <form onSubmit={save} className="space-y-6 max-w-2xl">

        {/* Individual Provider */}
        <Section title="Individual Provider Information">
          <div className="grid grid-cols-3 gap-3">
            <Field label="First Name"     field="firstName"     profile={profile} setProfile={setProfile} />
            <Field label="MI"             field="middleInitial" profile={profile} setProfile={setProfile} />
            <Field label="Last Name"      field="lastName"      profile={profile} setProfile={setProfile} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"          field="phone"         profile={profile} setProfile={setProfile} />
            <Field label="Email"          field="user.email"    profile={profile} setProfile={setProfile} type="email" />
          </div>
          <Field label="Home Address"     field="address"       profile={profile} setProfile={setProfile} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"           field="city"          profile={profile} setProfile={setProfile} />
            <Field label="State"          field="state"         profile={profile} setProfile={setProfile} />
            <Field label="ZIP"            field="zip"           profile={profile} setProfile={setProfile} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of Birth"  field="dob"           profile={profile} setProfile={setProfile} type="date" />
            <Field label="SSN"            field="ssn"           profile={profile} setProfile={setProfile} sensitive />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="NPI"            field="npiNumber"     profile={profile} setProfile={setProfile} />
            <Field label="Medicaid ID"    field="medicaidNumber" profile={profile} setProfile={setProfile} />
          </div>
          <Field label="BCBS Payor ID"    field="bcbsPayorId"   profile={profile} setProfile={setProfile} />
        </Section>

        {/* Business Provider toggle */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!profile.hasBusinessProvider}
              onChange={(e) => setProfile({ ...profile, hasBusinessProvider: e.target.checked })}
              className="w-4 h-4 accent-[#7A8F79]"
            />
            <span className="font-semibold text-[#2F3E4E]">This provider has a separate Business entity</span>
          </label>

          {profile.hasBusinessProvider && (
            <div className="mt-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
                Business Provider Information
              </h2>
              <Field label="Entity Name"       field="bizEntityName"      profile={profile} setProfile={setProfile} />
              <Field label="Service Address"   field="bizServiceAddress"  profile={profile} setProfile={setProfile} />
              <Field label="Business Email"    field="bizEmail"           profile={profile} setProfile={setProfile} type="email" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="EIN"             field="ein"                profile={profile} setProfile={setProfile} sensitive />
                <Field label="FEIN"            field="fein"               profile={profile} setProfile={setProfile} sensitive />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Business NPI"    field="bizNpi"             profile={profile} setProfile={setProfile} />
                <Field label="Business Medicaid ID" field="bizMedicaidId" profile={profile} setProfile={setProfile} />
              </div>
            </div>
          )}
        </div>

        {/* Payment */}
        <Section title="Payment Information">
          <Field label="Bank Name"         field="bankName"       profile={profile} setProfile={setProfile} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Routing #"       field="bankRouting"    profile={profile} setProfile={setProfile} sensitive />
            <Field label="Account #"       field="bankAccount"    profile={profile} setProfile={setProfile} sensitive />
          </div>
        </Section>

        {/* Claims Access */}
        <Section title="Claims Access — Provider Aliases">
          <p className="text-xs text-[#7A8F79]">
            This provider will see any claim where the Provider Name in the CSV matches one of these aliases exactly.
          </p>
          <AliasEditor
            aliases={profile.providerAliases || []}
            onChange={(aliases) => setProfile({ ...profile, providerAliases: aliases })}
          />
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>

        {message && (
          <p className={`text-sm text-center font-medium ${message.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
            {message}
          </p>
        )}

      </form>
    </div>
  )
}
