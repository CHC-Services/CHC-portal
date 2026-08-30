'use client'

import { useState, useEffect } from 'react'
import { campaignRuleLabel, campaignWindowLabel } from '../../../lib/campaignDiscount'
import { FEE_PLAN_CODES, FEE_PLAN_LABEL } from '../../../lib/feePlans'
import DateInput from '../../components/DateInput'

type Campaign = {
  id: string
  name: string
  description?: string
  type: string
  flatAmtPerDos?: number
  weeklyMaxAmt?: number
  percentOff?: number
  startDate?: string
  weekCount?: number
  endDate?: string
  promoSlug?: string
  active: boolean
  siteWide: boolean
  appliesFeePlans: string[]
  _count?: { enrollments: number }
}

const TYPE_LABELS: Record<string, string> = {
  flat_per_dos: '$X per date of service (weekly cap)',
  percent_off:  '% off invoice total',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formMsg, setFormMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('flat_per_dos')
  const [flatAmtPerDos, setFlatAmtPerDos] = useState('')
  const [weeklyMaxAmt, setWeeklyMaxAmt] = useState('')
  const [percentOff, setPercentOff] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [promoSlug, setPromoSlug] = useState('')
  const [siteWide, setSiteWide] = useState(false)
  const [scopeMode, setScopeMode] = useState<'all' | 'specific'>('all')
  const [appliesFeePlans, setAppliesFeePlans] = useState<string[]>([])

  async function fetchCampaigns() {
    const res = await fetch('/api/admin/campaigns', { credentials: 'include' })
    if (res.ok) setCampaigns(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchCampaigns() }, [])

  function resetForm() {
    setName(''); setDescription(''); setType('flat_per_dos')
    setFlatAmtPerDos(''); setWeeklyMaxAmt(''); setPercentOff('')
    setStartDate(''); setEndDate(''); setPromoSlug('')
    setSiteWide(false); setScopeMode('all'); setAppliesFeePlans([])
    setFormMsg(''); setEditingId(null)
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id)
    setName(c.name)
    setDescription(c.description || '')
    setType(c.type)
    setFlatAmtPerDos(c.flatAmtPerDos?.toString() || '')
    setWeeklyMaxAmt(c.weeklyMaxAmt?.toString() || '')
    setPercentOff(c.percentOff?.toString() || '')
    setStartDate(c.startDate ? c.startDate.slice(0, 10) : '')
    // Editing doesn't surface the legacy weekCount field — only setting an
    // explicit stop date here. A campaign that only ever had weekCount set
    // keeps working off it untouched unless a stop date is added.
    setEndDate(c.endDate ? c.endDate.slice(0, 10) : '')
    setPromoSlug(c.promoSlug || '')
    setSiteWide(!!c.siteWide)
    setScopeMode(c.appliesFeePlans && c.appliesFeePlans.length > 0 ? 'specific' : 'all')
    setAppliesFeePlans(c.appliesFeePlans || [])
    setFormMsg('')
    setShowForm(true)
  }

  function toggleFeePlan(code: string) {
    setAppliesFeePlans(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
  }

  async function save() {
    if (!name.trim()) { setFormMsg('Name is required.'); return }
    if (scopeMode === 'specific' && appliesFeePlans.length === 0) {
      setFormMsg('Select at least one service code, or switch back to Entire Invoice.')
      return
    }
    setSaving(true)
    setFormMsg('')

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      flatAmtPerDos: type === 'flat_per_dos' ? parseFloat(flatAmtPerDos) || null : null,
      weeklyMaxAmt:  type === 'flat_per_dos' ? parseFloat(weeklyMaxAmt)  || null : null,
      percentOff:    type === 'percent_off'  ? parseFloat(percentOff)    || null : null,
      startDate: startDate || null,
      endDate: endDate || null,
      promoSlug: promoSlug.trim() || null,
      siteWide,
      appliesFeePlans: scopeMode === 'specific' ? appliesFeePlans : [],
    }

    const url  = editingId ? `/api/admin/campaigns/${editingId}` : '/api/admin/campaigns'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)
    if (res.ok) {
      resetForm()
      setShowForm(false)
      fetchCampaigns()
    } else {
      const d = await res.json()
      setFormMsg(d.error || 'Failed to save.')
    }
  }

  async function toggleActive(c: Campaign) {
    await fetch(`/api/admin/campaigns/${c.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    fetchCampaigns()
  }

  async function deleteCampaign(c: Campaign) {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return
    await fetch(`/api/admin/campaigns/${c.id}`, { method: 'DELETE', credentials: 'include' })
    fetchCampaigns()
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8]">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#2F3E4E]">Billing Campaigns</h1>
            <p className="text-sm text-[#7A8F79] mt-0.5">Create and manage discount campaigns for providers.</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-[#2F3E4E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            + New Campaign
          </button>
        </div>

        {/* Create / Edit form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#7A8F79] border-b border-[#D9E1E8] pb-3">
              {editingId ? 'Edit Campaign' : 'New Campaign'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Discount Title <span className="normal-case font-normal">(shown on the invoice)</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fall 2026 Referral Promo"
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Discount Type</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Description <span className="normal-case font-normal">(optional)</span></label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal notes about this campaign"
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            </div>

            {/* Type-specific fields */}
            {type === 'flat_per_dos' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">$ per Date of Service</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={flatAmtPerDos} onChange={e => setFlatAmtPerDos(e.target.value)}
                      placeholder="3.00"
                      className="w-full border border-[#D9E1E8] rounded-lg pl-6 pr-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Weekly Max <span className="normal-case font-normal">(Mon–Sun, optional)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={weeklyMaxAmt} onChange={e => setWeeklyMaxAmt(e.target.value)}
                      placeholder="10.00"
                      className="w-full border border-[#D9E1E8] rounded-lg pl-6 pr-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
              </div>
            )}

            {type === 'percent_off' && (
              <div className="space-y-1 max-w-xs">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Percent Off</label>
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.1" value={percentOff} onChange={e => setPercentOff(e.target.value)}
                    placeholder="25"
                    className="w-full border border-[#D9E1E8] rounded-lg pl-3 pr-8 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">%</span>
                </div>
              </div>
            )}

            {/* Date window */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Start Date <span className="normal-case font-normal">(optional)</span></label>
                <DateInput value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Stop Date <span className="normal-case font-normal">(optional)</span></label>
                <DateInput value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Promo Slug <span className="normal-case font-normal">(for future link)</span></label>
                <input value={promoSlug} onChange={e => setPromoSlug(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                  placeholder="FB-SPRING26"
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] font-mono focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                {promoSlug && (
                  <p className="text-[10px] text-[#7A8F79] mt-0.5">Future link: /join?ref={promoSlug}</p>
                )}
              </div>
            </div>

            {/* Applies To — entire invoice, or scoped to specific service codes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Applies To</label>
              <div className="flex gap-2">
                {(['all', 'specific'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setScopeMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                      scopeMode === m ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#f4f6f8]'
                    }`}>
                    {m === 'all' ? 'Entire Invoice' : 'Specific Service Codes'}
                  </button>
                ))}
              </div>
              {scopeMode === 'specific' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {FEE_PLAN_CODES.map(p => (
                    <label key={p.value} className="flex items-center gap-2 text-xs text-[#2F3E4E] border border-[#D9E1E8] rounded-lg px-2.5 py-2 cursor-pointer hover:border-[#7A8F79]">
                      <input type="checkbox" checked={appliesFeePlans.includes(p.value)} onChange={() => toggleFeePlan(p.value)}
                        className="accent-[#7A8F79]" />
                      <span className="truncate">{p.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Site-Wide */}
            <label className="flex items-start gap-2.5 border border-[#D9E1E8] rounded-lg px-3 py-2.5 cursor-pointer hover:border-[#7A8F79]">
              <input type="checkbox" checked={siteWide} onChange={e => setSiteWide(e.target.checked)}
                className="accent-[#7A8F79] mt-0.5" />
              <span>
                <span className="block text-sm font-semibold text-[#2F3E4E]">Site-Wide Promotion</span>
                <span className="block text-xs text-[#7A8F79]">Applies automatically to every invoice generated while active — no per-provider enrollment needed. A provider's own personal campaign enrollment, if they have one, still takes priority over this.</span>
              </span>
            </label>

            {formMsg && <p className="text-xs font-semibold text-red-500">{formMsg}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={() => { resetForm(); setShowForm(false) }}
                className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm font-semibold hover:bg-[#f4f6f8] transition">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
          </div>
        )}

        {/* Campaign list */}
        {loading ? (
          <p className="text-sm text-[#7A8F79] px-2">Loading…</p>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-[#7A8F79] text-sm">No campaigns yet. Create one to start offering discounts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${c.active ? 'border-[#7A8F79]' : 'border-[#D9E1E8]'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#2F3E4E]">{c.name}</p>
                      {!c.active && (
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Inactive</span>
                      )}
                      {c.siteWide && (
                        <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Site-Wide</span>
                      )}
                      {c.promoSlug && (
                        <span className="text-[10px] font-mono bg-[#f4f6f8] text-[#7A8F79] px-2 py-0.5 rounded">/join?ref={c.promoSlug}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#7A8F79] mt-0.5">
                      {campaignRuleLabel(c as any)} · {campaignWindowLabel(c as any)}
                    </p>
                    <p className="text-xs text-[#7A8F79] mt-0.5">
                      Applies to: {c.appliesFeePlans && c.appliesFeePlans.length > 0
                        ? c.appliesFeePlans.map(code => FEE_PLAN_LABEL[code] || code).join(', ')
                        : 'Entire invoice'}
                    </p>
                    {c.description && <p className="text-xs text-[#4a5a6a] mt-1">{c.description}</p>}
                    <p className="text-[10px] text-[#7A8F79] mt-1.5">
                      {c.siteWide
                        ? 'Auto-applies to every invoice — no enrollment needed'
                        : `${c._count?.enrollments ?? 0} active enrollment${c._count?.enrollments !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEdit(c)}
                      className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">Edit</button>
                    <button onClick={() => toggleActive(c)}
                      className={`text-xs font-semibold transition ${c.active ? 'text-amber-500 hover:text-amber-700' : 'text-green-600 hover:text-green-800'}`}>
                      {c.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => deleteCampaign(c)}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold transition">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
