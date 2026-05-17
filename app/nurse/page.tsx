'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PortalMessages from '../components/PortalMessages'
import RotatingQuote from '../components/RotatingQuote'
import {
  type DashboardSection,
  DEFAULTS,
  loadSettings,
} from '@/lib/portalSettings'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  billed: boolean
  claimRef: string | null
  createdAt: string
}

type NurseDocument = {
  id: string
  category: string
  expiresAt: string | null
}

export default function NurseDashboard() {
  const router = useRouter()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [invoiceSummary, setInvoiceSummary] = useState<{ totalDue: number; count: number; totalInvoices: number; totalPaid: number; accountTotal: number } | null>(null)
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null)
  const [claimSummary, setClaimSummary] = useState<{ totalBilled: number; totalAllowed: number; totalPaid: number; avgPerHour: number | null; statusCounts: { submitted: number; pending: number; paid: number; denied: number } } | null>(null)
  const [documents, setDocuments] = useState<NurseDocument[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [effectiveTier, setEffectiveTier] = useState<'FREE' | 'BASIC' | 'PRO'>('FREE')
  const [isTrialing, setIsTrialing] = useState(false)
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null)
  const [dashboardOrder, setDashboardOrder] = useState<DashboardSection[]>(DEFAULTS.dashboardOrder)

  function loadEntries() {
    return fetch('/api/time-entry', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEntries(data)
      })
  }

  useEffect(() => {
    setDashboardOrder(loadSettings().dashboardOrder ?? DEFAULTS.dashboardOrder)

    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(async data => {
        if (data.user?.lastLoginAt) setLastLoginAt(data.user.lastLoginAt)

        if (!data.profile?.portalAgreementSignedAt && !data.profile?.isDemo) {
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

        fetch('/api/nurse/documents', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.documents) setDocuments(d.documents) })

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

  const startYear = 2025
  const yearRange = Array.from({ length: thisYear - startYear + 1 }, (_, i) => startYear + i)
  const yearOptions = Array.from(
    new Set([...yearRange, ...entries.map(e => new Date(e.workDate).getFullYear())])
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

  // Document stats
  const docTotal = documents.length
  const docEOBs = documents.filter(d => d.category === 'EOB').length
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const docExpiring = documents.filter(d => d.expiresAt && new Date(d.expiresAt) <= in30Days && new Date(d.expiresAt) >= now).length

  // Card wrapper: clickable card with hover effect
  function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
      <Link href={href} className="block group mb-4">
        {children}
      </Link>
    )
  }

  const sectionMap: Record<DashboardSection, React.ReactNode> = {
    account: (
      <CardLink key="account" href="/nurse/invoices">
        {effectiveTier === 'FREE' ? (
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between gap-4 group-hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Account Summary</p>
              <p className="text-xs text-[#7A8F79] mt-1">Invoice balances and outstanding totals are available on the <strong>Basic plan</strong>.</p>
            </div>
            <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
          </div>
        ) : invoiceSummary ? (
          <div className="card bg-white rounded-xl p-5 group-hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">
                Account Summary
                <span className="ml-2 text-[#D9E1E8] group-hover:text-[#7A8F79] transition-colors">→</span>
              </p>
              {lastLoginAt && (
                <p className="text-[10px] text-[#7A8F79]">
                  Last login:{' '}
                  <span className="font-semibold text-[#2F3E4E]">
                    {new Date(lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                  </span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#2F3E4E]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Account Total</p>
                <p className="text-2xl font-black text-[#2F3E4E]">
                  ${invoiceSummary.accountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-green-400">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Paid to Date</p>
                <p className="text-2xl font-black text-green-600">
                  ${invoiceSummary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#7A8F79]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Invoices</p>
                <p className="text-2xl font-black text-[#2F3E4E]">{invoiceSummary.totalInvoices}</p>
              </div>
              <div className={`bg-[#F4F6F5] rounded-xl p-4 border-t-2 ${invoiceSummary.count > 0 ? 'border-amber-400' : 'border-green-400'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Invoices Due</p>
                <p className={`text-2xl font-black ${invoiceSummary.count > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {invoiceSummary.count}
                </p>
              </div>
              <div className={`bg-[#F4F6F5] rounded-xl p-4 border-t-2 ${invoiceSummary.totalDue > 0 ? 'border-red-400' : 'border-green-400'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Balance Due</p>
                <p className={`text-2xl font-black ${invoiceSummary.totalDue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  ${invoiceSummary.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            {invoiceSummary.count === 0 && (
              <p className="text-xs text-[#7A8F79] italic mt-3">Your account is fully paid up. Thank you!</p>
            )}
          </div>
        ) : null}
      </CardLink>
    ),

    reimbursement: (
      <CardLink key="reimbursement" href="/nurse/claims">
        {effectiveTier === 'FREE' ? (
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between gap-4 group-hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Reimbursement Summary</p>
              <p className="text-xs text-[#7A8F79] mt-1">Total billed, allowed, paid, and average rate per hour available on the <strong>Basic plan</strong>.</p>
            </div>
            <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
          </div>
        ) : claimSummary ? (
          <div className="card bg-white rounded-xl p-5 group-hover:shadow-md transition-shadow">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
              Claim Reimbursement Summary
              <span className="ml-2 text-[#D9E1E8] group-hover:text-[#7A8F79] transition-colors">→</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#2F3E4E]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Billed</p>
                <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#7A8F79]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Allowed</p>
                <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.totalAllowed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-green-400">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Paid</p>
                <p className="text-2xl font-black text-green-600">${claimSummary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[#E8EDE7] rounded-xl p-4 border-t-2 border-[#7A8F79]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Avg Rate per Hour</p>
                {claimSummary.avgPerHour !== null ? (
                  <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.avgPerHour.toFixed(2)}</p>
                ) : (
                  <p className="text-sm text-[#7A8F79] italic mt-1">No paid claims yet</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </CardLink>
    ),

    claims: (
      <CardLink key="claims" href="/nurse/claims">
        {effectiveTier === 'FREE' ? (
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between gap-4 group-hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Claims Summary</p>
              <p className="text-xs text-[#7A8F79] mt-1">Claim status counts and history available on the <strong>Basic plan</strong>.</p>
            </div>
            <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
          </div>
        ) : claimSummary ? (
          <div className="card bg-white rounded-xl p-5 group-hover:shadow-md transition-shadow">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
              Claim Count Summary
              <span className="ml-2 text-[#D9E1E8] group-hover:text-[#7A8F79] transition-colors">→</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#2F3E4E]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Submitted</p>
                <p className="text-2xl font-black text-[#2F3E4E]">{claimSummary.statusCounts.submitted}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-amber-400">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Pending</p>
                <p className="text-2xl font-black text-amber-600">{claimSummary.statusCounts.pending}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-green-400">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Paid</p>
                <p className="text-2xl font-black text-green-600">{claimSummary.statusCounts.paid}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-red-400">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Denied</p>
                <p className="text-2xl font-black text-red-500">{claimSummary.statusCounts.denied}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardLink>
    ),

    hours: (
      <CardLink key="hours" href="/nurse/hours">
        {effectiveTier === 'FREE' ? (
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between gap-4 group-hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Hours Summary</p>
              <p className="text-xs text-[#7A8F79] mt-1">Monthly, prior month, and year-to-date hour totals available on the <strong>Basic plan</strong>.</p>
            </div>
            <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
          </div>
        ) : (
          <div className="card bg-white rounded-xl p-5 group-hover:shadow-md transition-shadow">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
              Logged Hours Summary
              <span className="ml-2 text-[#D9E1E8] group-hover:text-[#7A8F79] transition-colors">→</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#7A8F79]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{monthName}</p>
                <p className="text-2xl font-black text-[#2F3E4E]">{hoursThisMonth}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#7A8F79]/50">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{priorMonthName}</p>
                <p className="text-2xl font-black text-[#2F3E4E]">{hoursPriorMonth}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#2F3E4E]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{selectedYear} Total</p>
                <p className="text-2xl font-black text-[#2F3E4E]">{hoursYTD}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-amber-400">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Waiting to be Billed</p>
                <p className="text-2xl font-black text-amber-600">{hoursUnbilled}</p>
              </div>
            </div>
          </div>
        )}
      </CardLink>
    ),

    documents: (
      <CardLink key="documents" href="/nurse/documents">
        <div className="card bg-white rounded-xl p-5 group-hover:shadow-md transition-shadow">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
            Documents Summary
            <span className="ml-2 text-[#D9E1E8] group-hover:text-[#7A8F79] transition-colors">→</span>
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#2F3E4E]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Documents</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{docTotal}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4 border-t-2 border-[#7A8F79]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">EOBs</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{docEOBs}</p>
            </div>
            <div className={`bg-[#F4F6F5] rounded-xl p-4 border-t-2 ${docExpiring > 0 ? 'border-amber-400' : 'border-green-400'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Expiring in 30 Days</p>
              <p className={`text-2xl font-black ${docExpiring > 0 ? 'text-amber-600' : 'text-green-600'}`}>{docExpiring}</p>
            </div>
          </div>
          {docExpiring > 0 && (
            <p className="text-xs text-amber-700 font-medium mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ {docExpiring} document{docExpiring > 1 ? 's' : ''} expiring soon — review your documents.
            </p>
          )}
          {docTotal === 0 && (
            <p className="text-xs text-[#7A8F79] italic mt-3">No documents uploaded yet.</p>
          )}
        </div>
      </CardLink>
    ),
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] pr-4 md:pr-6 lg:pr-6 py-4 md:py-6">
      <div className="max-w-5xl mr-auto">

        {/* Page header */}
        <div className="flex items-stretch gap-6 mb-5">
          <div className="shrink-0 page-heading">
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

        {/* Year filter — hidden for FREE */}
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

        {/* Sections in user-defined order */}
        {dashboardOrder.map(key => sectionMap[key])}

      </div>
    </div>
  )
}
