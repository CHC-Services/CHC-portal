'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PortalMessages from '../components/PortalMessages'
import RotatingQuote from '../components/RotatingQuote'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  billed: boolean
  claimRef: string | null
  createdAt: string
}


export default function NurseDashboard() {
  const router = useRouter()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [invoiceSummary, setInvoiceSummary] = useState<{ totalDue: number; count: number } | null>(null)
  const [claimSummary, setClaimSummary] = useState<{ totalBilled: number; totalAllowed: number; totalPaid: number; avgPerHour: number | null; statusCounts: { submitted: number; pending: number; paid: number; denied: number } } | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [effectiveTier, setEffectiveTier] = useState<'FREE' | 'BASIC' | 'PRO'>('FREE')
  const [isTrialing, setIsTrialing] = useState(false)
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null)

  function loadEntries() {
    return fetch('/api/time-entry', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEntries(data)
      })
  }

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(async data => {
        if (!data.profile?.portalAgreementSignedAt) {
          router.replace('/nurse/agreement')
          return
        }
        if (!data.onboardingComplete) {
          router.replace('/nurse/onboarding')
          return
        }

        const planRes = await fetch('/api/nurse/plan', { credentials: 'include' })
        const planData = planRes.ok ? await planRes.json() : {}
        const tier: 'FREE' | 'BASIC' | 'PRO' = planData.effectiveTier || 'FREE'
        setEffectiveTier(tier)
        setIsTrialing(planData.isTrialing ?? false)
        setTrialExpiresAt(planData.trialExpiresAt ?? null)

        loadEntries()

        if (tier !== 'FREE') {
          fetch('/api/nurse/invoices/summary', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setInvoiceSummary(d) })
          fetch('/api/nurse/claims/summary', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setClaimSummary(d) })
        }
      })
  }, [router])

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const priorMonth = thisMonth === 0 ? 11 : thisMonth - 1
  const priorMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

  const yearOptions = Array.from(
    new Set([thisYear, ...entries.map(e => new Date(e.workDate).getFullYear())])
  ).sort((a, b) => b - a)

  const yearEntries = entries.filter(e => new Date(e.workDate).getFullYear() === selectedYear)

  const hoursThisMonth = yearEntries
    .filter(e => { const d = new Date(e.workDate); return d.getMonth() === thisMonth && d.getFullYear() === selectedYear })
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursPriorMonth = yearEntries
    .filter(e => { const d = new Date(e.workDate); return d.getMonth() === priorMonth && d.getFullYear() === (priorMonth === 11 ? selectedYear - 1 : selectedYear) })
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursYTD = yearEntries.reduce((sum, e) => sum + e.hours, 0)

  const hoursUnbilled = yearEntries
    .filter(e => !e.billed)
    .reduce((sum, e) => sum + e.hours, 0)

  const monthName = now.toLocaleString('default', { month: 'long' })
  const priorMonthName = new Date(priorMonthYear, priorMonth).toLocaleString('default', { month: 'long' })

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">

      {/* Page header */}
      <div className="flex items-stretch gap-6 mb-5">
        <div className="shrink-0">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Dashboard
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <RotatingQuote variant="header" className="flex-1 pl-8 ml-auto max-w-md" />
      </div>

      <PortalMessages priority="General" />

      {/* Year filter — hidden for FREE (only 14-day window, no year switching needed) */}
      {effectiveTier !== 'FREE' && (
        <div className="flex items-center gap-2 my-4 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Year</span>
          {yearOptions.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                selectedYear === y
                  ? 'bg-[#2F3E4E] text-white'
                  : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:bg-[#D9E1E8]'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Trial banner */}
      {isTrialing && trialExpiresAt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-amber-500 text-lg">⏳</span>
          <p className="text-xs text-amber-800 font-medium">
            You&apos;re on a free trial of <strong>myProvider Basic</strong> — expires {new Date(trialExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.
          </p>
        </div>
      )}

      {/* Account Summary */}
      {effectiveTier === 'FREE' ? (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Account Summary</p>
            <p className="text-xs text-[#7A8F79] mt-1">Invoice balances and outstanding totals are available on the <strong>Basic plan</strong>.</p>
          </div>
          <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
        </div>
      ) : invoiceSummary && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
            Account Summary
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Balance Due</p>
              <p className={`text-2xl font-black ${invoiceSummary.totalDue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                ${invoiceSummary.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Outstanding Invoices</p>
              <p className={`text-2xl font-black ${invoiceSummary.count > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {invoiceSummary.count}
              </p>
            </div>
          </div>
          {invoiceSummary.count === 0 && (
            <p className="text-xs text-[#7A8F79] italic mt-3">Your account is fully paid up. Thank you!</p>
          )}
        </div>
      )}

      {/* Reimbursement Summary */}
      {effectiveTier === 'FREE' ? (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Reimbursement Summary</p>
            <p className="text-xs text-[#7A8F79] mt-1">Total billed, allowed, paid, and average rate per hour available on the <strong>Basic plan</strong>.</p>
          </div>
          <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
        </div>
      ) : claimSummary && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
            Reimbursement Summary
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Billed</p>
              <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Allowed</p>
              <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.totalAllowed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Paid</p>
              <p className="text-2xl font-black text-green-600">${claimSummary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#E8EDE7] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Avg Rate per Hour</p>
              {claimSummary.avgPerHour !== null ? (
                <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.avgPerHour.toFixed(2)}</p>
              ) : (
                <p className="text-sm text-[#7A8F79] italic mt-1">No paid claims yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Claims Summary */}
      {effectiveTier === 'FREE' ? (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Claims Summary</p>
            <p className="text-xs text-[#7A8F79] mt-1">Claim status counts and history available on the <strong>Basic plan</strong>.</p>
          </div>
          <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
        </div>
      ) : claimSummary && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
            Claims Summary
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Submitted</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{claimSummary.statusCounts.submitted}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Pending</p>
              <p className="text-2xl font-black text-amber-600">{claimSummary.statusCounts.pending}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Paid</p>
              <p className="text-2xl font-black text-green-600">{claimSummary.statusCounts.paid}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Denied</p>
              <p className="text-2xl font-black text-red-500">{claimSummary.statusCounts.denied}</p>
            </div>
          </div>
        </div>
      )}

      {/* Logged Hours Summary */}
      {effectiveTier === 'FREE' ? (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Hours Summary</p>
            <p className="text-xs text-[#7A8F79] mt-1">Monthly, prior month, and year-to-date hour totals available on the <strong>Basic plan</strong>.</p>
          </div>
          <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
            Logged Hours Summary
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{monthName}</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{hoursThisMonth}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{priorMonthName}</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{hoursPriorMonth}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{selectedYear} Total</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{hoursYTD}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Waiting to be Billed</p>
              <p className="text-2xl font-black text-amber-600">{hoursUnbilled}</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#D9E1E8] text-right">
            <Link href="/nurse/hours" className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
              Submit hours &amp; view full history →
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}
