'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminNav from '../../../components/AdminNav'
import { DateInput, DateInputHandle } from '../../../components/DateInput'
import { fmtPhoneInput } from '../../../../lib/formatPhone'
import { shortInvoiceNumber } from '../../../../lib/formatInvoice'

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
          onChange={(e) => {
            const val = type === 'tel' ? fmtPhoneInput(e.target.value) : e.target.value
            setProfile({ ...profile, [field]: val })
          }}
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

const FEE_PLANS = [
  { value: 'A1', label: 'A1 — Medicaid Single Payer', amount: 2.00 },
  { value: 'A2', label: 'A2 — Commercial Single Payer', amount: 3.00 },
  { value: 'B',  label: 'B — Dual Payer', amount: 4.00 },
  { value: 'C',  label: 'C — 3+ Payer', amount: 6.00 },
]

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes?: string
  billed: boolean
  readyToInvoice: boolean
  invoiceFeePlan?: string
  invoiceFeeAmt?: number
  invoiceId?: string
  invoice?: { invoiceNumber: string; status: string }
  claimRef?: string
}

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
  const [isDemo, setIsDemo] = useState(false)
  const [demoSaving, setDemoSaving] = useState(false)
  const [demoSeeding, setDemoSeeding] = useState(false)
  const [demoSeedMsg, setDemoSeedMsg] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [notifSaving, setNotifSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  // Plan & trial
  const [planTier, setPlanTier] = useState('FREE')
  const [trialPreset, setTrialPreset] = useState('none')
  const [trialCustomDate, setTrialCustomDate] = useState('')
  const [planSaving, setPlanSaving] = useState(false)
  const [planMessage, setPlanMessage] = useState('')

  // Documents
  const [documents, setDocuments] = useState<{id:string;title:string;fileName:string;category:string;fileSize:number|null;expiresAt:string|null;createdAt:string;reminderDays:number[];visibleToNurse:boolean}[]>([])
  const [docViewing, setDocViewing] = useState<string | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docTitle, setDocTitle] = useState('')
  const [docCategory, setDocCategory] = useState('General')
  const [docExpiry, setDocExpiry] = useState('')
  const [docReminderDays, setDocReminderDays] = useState<number[]>([])
  const [docVisibleToNurse, setDocVisibleToNurse] = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [docMessage, setDocMessage] = useState('')
  const [docMessageIsError, setDocMessageIsError] = useState(false)
  const [docDeleting, setDocDeleting] = useState<string | null>(null)
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [catDeleting, setCatDeleting] = useState<string | null>(null)
  const [catEditingId, setCatEditingId] = useState<string | null>(null)
  const [catEditName, setCatEditName] = useState('')

  // Time entries + invoicing
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [claimRefs, setClaimRefs] = useState<Record<string, string>>({})
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showInvoicePreview, setShowInvoicePreview] = useState(false)
  const [invoiceDueTerm, setInvoiceDueTerm] = useState('30')
  const [invoiceNotes, setInvoiceNotes] = useState('The dates above have been submitted for processing. If any dates were omitted, please let me know. Thank you for your support (and patience). — Alex')
  const [invoiceSending, setInvoiceSending] = useState(false)
  const [invoiceMessage, setInvoiceMessage] = useState('')

  // Multi-select + bulk actions
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkFlagging, setBulkFlagging] = useState(false)

  // Campaign enrollment
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [activeEnrollment, setActiveEnrollment] = useState<any | null>(null)
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)
  const [enrollmentSaving, setEnrollmentSaving] = useState(false)
  const [enrollmentMsg, setEnrollmentMsg] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [manualDiscountAmt, setManualDiscountAmt] = useState('')
  const [manualDiscountNote, setManualDiscountNote] = useState('')
  const [invoicePreview, setInvoicePreview] = useState<any | null>(null)

  // Late fee + prompt pay
  const [lateFeePlan, setLateFeePlan] = useState<'none' | 'flat' | 'percent'>('none')
  const [lateFeeAmt, setLateFeeAmt] = useState('')
  const [lateFeePercent, setLateFeePercent] = useState('')
  const [promptPayEnabled, setPromptPayEnabled] = useState(false)
  const [promptPayDays, setPromptPayDays] = useState('14')
  const [promptPayCredit, setPromptPayCredit] = useState('5')

  // Tab navigation
  const [activeTab, setActiveTab] = useState('profile')

  // Claims (filtered for this nurse)
  const [claims, setClaims] = useState<any[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)

  // Time log sort
  const [sortField, setSortField] = useState<'date' | 'hours' | 'notes'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Claims year filter
  const [claimsYear, setClaimsYear] = useState('')

  // Receipts & Statements
  type InvoiceRecord = {
    id: string
    invoiceNumber: string
    totalAmount: number
    paidAmount: number
    status: string
    sentAt: string
    dueDate: string
    payments: { id: string; receiptNumber: string; amount: number; method: string | null; note: string | null; appliedAt: string; s3Key: string | null }[]
    entries: { id: string }[]
  }
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceRecord[]>([])
  const [receiptYearFilter, setReceiptYearFilter] = useState<string>('all')
  const [statementOpening, setStatementOpening] = useState(false)

  // Invoice preview modal
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceRecord | null>(null)
  const [previewDetail, setPreviewDetail] = useState<any | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSending, setPreviewSending] = useState(false)
  const [previewMessage, setPreviewMessage] = useState('')

  // Activity log modal
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [invoiceActivity, setInvoiceActivity] = useState<{id:string;action:string;documentType:string;reference:string|null;note:string|null;createdAt:string}[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  async function fetchClaims() {
    setClaimsLoading(true)
    const res = await fetch('/api/admin/claims', { credentials: 'include' })
    const data = await res.json()
    if (Array.isArray(data.claims)) setClaims(data.claims)
    setClaimsLoading(false)
  }

  async function fetchInvoiceHistory() {
    const res = await fetch(`/api/admin/nurses/${id}/invoices`, { credentials: 'include' })
    const data = await res.json()
    if (Array.isArray(data.invoices)) setInvoiceHistory(data.invoices)
  }

  async function fetchActivity() {
    setActivityLoading(true)
    const res = await fetch(`/api/admin/nurses/${id}/invoice-activity`, { credentials: 'include' })
    const data = await res.json()
    if (Array.isArray(data.activities)) setInvoiceActivity(data.activities)
    setActivityLoading(false)
  }

  async function logActivity(action: string, documentType: string, reference?: string, invoiceId?: string) {
    await fetch(`/api/admin/nurses/${id}/invoice-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, documentType, reference, invoiceId }),
    })
    // Refresh log in background if modal is open
    fetchActivity()
  }

  async function openInvoicePreview(inv: InvoiceRecord) {
    setPreviewMessage('')
    setPreviewInvoice(inv)
    setPreviewLoading(true)
    setPreviewDetail(null)
    const res = await fetch(`/api/admin/invoices/${inv.id}`, { credentials: 'include' })
    const data = await res.json()
    setPreviewDetail(data)
    setPreviewLoading(false)
  }

  async function sendInvoiceEmail(inv: InvoiceRecord) {
    setPreviewSending(true)
    setPreviewMessage('')
    const res = await fetch(`/api/admin/invoices/${inv.id}/html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
    if (res.ok) {
      setPreviewMessage('Invoice emailed successfully.')
      await logActivity('Email', 'Invoice', inv.invoiceNumber, inv.id)
    } else {
      setPreviewMessage('Failed to send email.')
    }
    setPreviewSending(false)
  }

  async function printInvoice(inv: InvoiceRecord) {
    window.open(`/api/admin/invoices/${inv.id}/html`, '_blank')
    await logActivity('Print', 'Invoice', inv.invoiceNumber, inv.id)
  }

  async function sendStatement(filter: string, yearLabel?: string) {
    setStatementOpening(true)
    const res = await fetch(`/api/admin/nurses/${id}/statement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ filter }),
    })
    if (res.ok) {
      await logActivity('Email', 'Statement', yearLabel || 'Full Statement')
    }
    setStatementOpening(false)
  }

  function printStatement(yearParam?: string) {
    const url = yearParam
      ? `/api/admin/invoices/${id}/statement?year=${yearParam}`
      : `/api/admin/invoices/${id}/statement`
    window.open(url, '_blank')
    logActivity('Print', 'Statement', yearParam ? `${yearParam} Statement` : 'Full Statement')
  }

  // Inline hours editing
  const [editingHoursId, setEditingHoursId] = useState<string | null>(null)
  const [editHoursVal, setEditHoursVal] = useState('')
  const [savingHours, setSavingHours] = useState(false)

  async function saveHoursEdit(entryId: string) {
    const h = parseFloat(editHoursVal)
    if (isNaN(h) || h <= 0) { setEditingHoursId(null); return }
    setSavingHours(true)
    await fetch(`/api/admin/time-entry/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ hours: h }),
    })
    setSavingHours(false)
    setEditingHoursId(null)
    fetchEntries()
  }

  // Log hours form
  const [workDate, setWorkDate] = useState('')
  const workDateRef = useRef<DateInputHandle>(null)
  const [workHours, setWorkHours] = useState('')
  const [workNotes, setWorkNotes] = useState('')
  const [workSubmitting, setWorkSubmitting] = useState(false)
  const [workMessage, setWorkMessage] = useState('')

  async function fetchDocuments() {
    const res = await fetch(`/api/admin/documents?nurseId=${id}`, { credentials: 'include' })
    const data = await res.json()
    setDocuments(data.documents || [])
  }

  async function fetchCategories() {
    const res = await fetch('/api/admin/document-categories', { credentials: 'include' })
    const data = await res.json()
    setCategories(data.categories || [])
  }

  async function fetchEntries() {
    const r = await fetch(`/api/admin/time-entry?nurseId=${id}`, { credentials: 'include' })
    const d = await r.json()
    if (Array.isArray(d)) {
      setEntries(d)
      const refs: Record<string, string> = {}
      d.forEach((e: TimeEntry) => { refs[e.id] = e.claimRef || '' })
      setClaimRefs(refs)
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    setCatSaving(true)
    const res = await fetch('/api/admin/document-categories', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setNewCatName('')
      setDocCategory(name)
      fetchCategories()
    }
    setCatSaving(false)
  }

  async function handleDeleteCategory(catId: string, catName: string) {
    setCatDeleting(catId)
    await fetch(`/api/admin/document-categories/${catId}`, { method: 'DELETE', credentials: 'include' })
    if (docCategory === catName) setDocCategory('General')
    fetchCategories()
    setCatDeleting(null)
  }

  async function handleRenameCategory(catId: string) {
    const name = catEditName.trim()
    if (!name) return
    const res = await fetch(`/api/admin/document-categories/${catId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setCatEditingId(null)
      setCatEditName('')
      fetchCategories()
    }
  }

  async function fetchCampaigns() {
    const [campRes, enrollRes] = await Promise.all([
      fetch('/api/admin/campaigns', { credentials: 'include' }),
      fetch(`/api/admin/invoices/preview?nurseId=${id}`, { credentials: 'include' }),
    ])
    if (campRes.ok) setCampaigns(await campRes.json())
    if (enrollRes.ok) {
      const data = await enrollRes.json()
      setActiveEnrollment(data.enrollment || null)
      setInvoicePreview(data)
    }
  }

  async function enrollInCampaign() {
    if (!selectedCampaignId) return
    setEnrollmentSaving(true)
    setEnrollmentMsg('')
    const res = await fetch(`/api/admin/campaigns/${selectedCampaignId}/enroll`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nurseId: id }),
    })
    setEnrollmentSaving(false)
    if (res.ok) {
      setEnrollmentMsg('Campaign applied.')
      setSelectedCampaignId('')
      fetchCampaigns()
    } else {
      const d = await res.json()
      setEnrollmentMsg(d.error || 'Failed to enroll.')
    }
  }

  async function unenrollFromCampaign(campaignId: string) {
    setEnrollmentSaving(true)
    setEnrollmentMsg('')
    const res = await fetch(`/api/admin/campaigns/${campaignId}/enroll`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nurseId: id }),
    })
    setEnrollmentSaving(false)
    if (res.ok) {
      setEnrollmentMsg('Campaign removed.')
      fetchCampaigns()
    } else {
      setEnrollmentMsg('Failed to remove campaign.')
    }
  }

  useEffect(() => {
    fetch(`/api/admin/nurses/${id}`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return }
        return r.json()
      })
      .then(data => {
        if (data) {
          setProfile({ ...data, 'user.email': data.user?.email || '' })
          setUserRole(data.user?.role || 'nurse')
          setIsDemo(data.isDemo ?? false)
          setNotifEnabled(data.receiveNotifications !== false)
          setPlanTier(data.planTier || 'FREE')
          if (data.trialExpiresAt) {
            setTrialPreset('custom')
            setTrialCustomDate(data.trialExpiresAt.slice(0, 10))
          }
        }
      })
      .finally(() => setLoading(false))

    fetchEntries()
    fetchDocuments()
    fetchCategories()
    fetchInvoiceHistory()
    fetchClaims()
    fetchActivity()
    fetchCampaigns()
  }, [id, router])

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!docFile || !docTitle) return
    setDocUploading(true)
    setDocMessage('')
    setDocMessageIsError(false)

    try {
      // Step 1 — get a presigned POST policy from the server (tiny JSON request, no file bytes)
      const presignRes = await fetch('/api/admin/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: docFile.name,
          contentType: docFile.type || 'application/octet-stream',
          nurseId: id,
          category: docCategory,
        }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) {
        setDocMessage(`Upload Failed: ${presignData.error || 'Could not get upload URL.'}`)
        setDocMessageIsError(true)
        setDocUploading(false)
        return
      }

      // Step 2 — POST the file directly to S3 via presigned POST.
      // Use no-cors so browser doesn't block the response — S3 returns 204 on
      // success and we don't need to read the body. Step 3 will confirm the file
      // actually landed by saving the DB record.
      const formData = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) =>
        formData.append(k, v),
      )
      formData.append('file', docFile)
      await fetch(presignData.url, { method: 'POST', body: formData, mode: 'no-cors' })

      // Step 3 — tell the server to save the DB record now that the file is in S3
      const confirmRes = await fetch('/api/admin/documents/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nurseId: id,
          title: docTitle,
          storageKey: presignData.storageKey,
          fileName: docFile.name,
          fileSize: docFile.size,
          mimeType: docFile.type || null,
          category: docCategory,
          expiresAt: docExpiry || null,
          reminderDays: docReminderDays,
          visibleToNurse: docVisibleToNurse,
        }),
      })
      const confirmData = await confirmRes.json()
      if (confirmData.ok) {
        setDocMessage('Document uploaded.')
        setDocMessageIsError(false)
        setDocFile(null)
        setDocTitle('')
        setDocCategory('General')
        setDocExpiry('')
        setDocReminderDays([])
        setDocVisibleToNurse(false)
        fetchDocuments()
      } else {
        setDocMessage(`Upload Failed: ${confirmData.error || 'File uploaded but record not saved.'}`)
        setDocMessageIsError(true)
      }
    } catch (err: any) {
      setDocMessage(`Upload Failed: ${err?.message || 'Network error — check your connection.'}`)
      setDocMessageIsError(true)
    }

    setDocUploading(false)
  }

  async function handleDocView(docId: string) {
    setDocViewing(docId)
    const res = await fetch(`/api/admin/documents/${docId}`, { credentials: 'include' })
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer')
    setDocViewing(null)
  }

  async function handleDocDelete(docId: string) {
    setDocDeleting(docId)
    await fetch(`/api/admin/documents/${docId}`, { method: 'DELETE', credentials: 'include' })
    fetchDocuments()
    setDocDeleting(null)
  }

  async function toggleInvoiceFlag(entry: TimeEntry, checked: boolean, feePlan?: string) {
    const plan = feePlan ?? entry.invoiceFeePlan ?? 'A1'
    const res = await fetch(`/api/admin/time-entry/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ readyToInvoice: checked, invoiceFeePlan: checked ? plan : null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updated } : e))
    }
  }

  async function saveClaimRef(entryId: string, ref: string) {
    const res = await fetch(`/api/admin/time-entry/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ claimRef: ref }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, claimRef: updated.claimRef } : e))
    }
  }

  async function createInvoice() {
    setInvoiceSending(true)
    setInvoiceMessage('')
    const manualAmt = parseFloat(manualDiscountAmt)
    const body: Record<string, unknown> = {
      nurseId: id,
      dueTerm: invoiceDueTerm,
      notes: invoiceNotes,
      manualDiscountAmt: manualAmt > 0 ? manualAmt : undefined,
      manualDiscountNote: manualAmt > 0 ? (manualDiscountNote || 'Manual discount') : undefined,
    }
    if (lateFeePlan === 'flat') {
      body.lateFeePlan = 'flat'
      body.lateFeeAmt = parseFloat(lateFeeAmt) || 0
    } else if (lateFeePlan === 'percent') {
      body.lateFeePlan = 'percent'
      body.lateFeePercent = parseFloat(lateFeePercent) || 0
    }
    if (promptPayEnabled) {
      body.promptPayDays = parseInt(promptPayDays) || 14
      body.promptPayCredit = parseFloat(promptPayCredit) || 5
    }
    const res = await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setInvoiceSending(false)
    if (res.ok) {
      setInvoiceMessage(`Invoice ${shortInvoiceNumber(data.invoiceNumber)} sent successfully.`)
      setShowInvoiceModal(false)
      setInvoiceNotes('')
      setManualDiscountAmt('')
      setManualDiscountNote('')
      setLateFeePlan('none')
      setLateFeeAmt('')
      setLateFeePercent('')
      setPromptPayEnabled(false)
      setPromptPayDays('14')
      setPromptPayCredit('5')
      fetchEntries()
      fetchInvoiceHistory()
      fetchCampaigns()
    } else {
      setInvoiceMessage(data.error || 'Failed to create invoice.')
    }
  }

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

  async function savePlan() {
    setPlanSaving(true)
    setPlanMessage('')

    let trialExpiresAt: string | null = null
    if (trialPreset === '1week') {
      const d = new Date(); d.setDate(d.getDate() + 7)
      trialExpiresAt = d.toISOString()
    } else if (trialPreset === '2weeks') {
      const d = new Date(); d.setDate(d.getDate() + 14)
      trialExpiresAt = d.toISOString()
    } else if (trialPreset === 'custom' && trialCustomDate) {
      trialExpiresAt = new Date(trialCustomDate + 'T23:59:59Z').toISOString()
    }

    const res = await fetch(`/api/admin/nurses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ planTier, trialExpiresAt }),
    })
    setPlanSaving(false)
    setPlanMessage(res.ok ? 'Plan saved.' : 'Error saving plan.')
  }

  async function toggleDemo() {
    setDemoSaving(true)
    const next = !isDemo
    const res = await fetch(`/api/admin/nurses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isDemo: next }),
    })
    setDemoSaving(false)
    if (res.ok) setIsDemo(next)
  }

  async function seedDemoData() {
    if (!confirm('This will wipe and re-seed all time entries, claims, and invoices for this demo account. Continue?')) return
    setDemoSeeding(true)
    setDemoSeedMsg('')
    const res = await fetch('/api/admin/demo/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId: id }),
    })
    const data = await res.json()
    setDemoSeeding(false)
    if (res.ok) {
      setDemoSeedMsg(`Seeded: ${data.seeded.timeEntries} time entries, ${data.seeded.claims} claims, ${data.seeded.invoices} invoices.`)
    } else {
      setDemoSeedMsg(data.error || 'Seed failed.')
    }
  }

  async function resendInvite() {
    if (!confirm(`This will reset ${profile.displayName}'s password and send them a new login email. Continue?`)) return
    setInviteSending(true)
    setInviteMessage('')
    const res = await fetch(`/api/admin/nurses/${id}/resend-invite`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    setInviteSending(false)
    setInviteMessage(res.ok
      ? `Invite resent to ${data.email}. Their password has been reset.`
      : data.error || 'Failed to send invite.')
  }

  async function setPassword() {
    if (!newPassword.trim()) return
    setPwSaving(true)
    setPwMessage('')
    const res = await fetch(`/api/admin/nurses/${id}/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: newPassword }),
    })
    setPwSaving(false)
    if (res.ok) {
      setPwMessage('Password updated successfully.')
      setNewPassword('')
    } else {
      setPwMessage('Error updating password.')
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    setSaving(true)
    setMessage('')
    const res = await fetch(`/api/admin/nurses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile)
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setMessage('Saved successfully.')
    } else {
      setMessage(data.error || 'Error saving profile.')
    }
  }

  async function submitTimeEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!workDate || !workHours) return
    setWorkSubmitting(true)
    setWorkMessage('')
    const res = await fetch('/api/admin/time-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId: id, workDate, hours: parseFloat(workHours), notes: workNotes }),
    })
    const data = await res.json()
    setWorkSubmitting(false)
    if (res.ok) {
      setWorkMessage('Entry added.')
      setWorkDate('')
      setWorkHours('')
      setWorkNotes('')
      fetchEntries()
      requestAnimationFrame(() => workDateRef.current?.focus())
    } else {
      setWorkMessage(data.error || 'Failed to add entry.')
    }
  }

  function toggleSelect(entryId: string) {
    setSelectedEntries(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  function toggleSelectAll() {
    if (allNonInvoicedSelected) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(notInvoicedEntries.map(e => e.id)))
    }
  }

  async function bulkDelete() {
    const ids = [...selectedEntries].filter(sid => notInvoicedEntries.some(e => e.id === sid && !e.billed))
    if (!ids.length || !confirm(`Delete ${ids.length} time entr${ids.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    await Promise.all(ids.map(entryId =>
      fetch('/api/admin/time-entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: entryId }),
      })
    ))
    setBulkDeleting(false)
    setSelectedEntries(new Set())
    fetchEntries()
  }

  async function handleBulkInvoice() {
    const ids = [...selectedEntries].filter(sid => notInvoicedEntries.some(e => e.id === sid))
    if (!ids.length) return
    setBulkFlagging(true)
    await Promise.all(ids.map(entryId => {
      const entry = entries.find(e => e.id === entryId)
      return fetch(`/api/admin/time-entry/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ readyToInvoice: true, invoiceFeePlan: entry?.invoiceFeePlan || 'A1' }),
      })
    }))
    setBulkFlagging(false)
    setSelectedEntries(new Set())
    await fetchEntries()
    setShowInvoicePreview(false)
    setShowInvoiceModal(true)
  }

  // Computed values
  const invoiceGroupMap = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    if (entry.invoiceId) {
      const group = invoiceGroupMap.get(entry.invoiceId) || []
      group.push(entry)
      invoiceGroupMap.set(entry.invoiceId, group)
    }
  }
  const notInvoicedEntries = entries.filter(e => !e.invoiceId)
  const allNonInvoicedSelected = notInvoicedEntries.length > 0 && notInvoicedEntries.every(e => selectedEntries.has(e.id))
  const selectedCount = [...selectedEntries].filter(sid => notInvoicedEntries.some(e => e.id === sid)).length
  const pendingEntries = notInvoicedEntries.filter(e => e.readyToInvoice)
  const pendingTotal = pendingEntries.reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)

  if (loading) return <div className="p-8 text-[#7A8F79]">Loading…</div>

  // ── Derived values for claims tab ──
  const allNurseClaims = claims.filter(c => c.nurseId === id)
  const nurseClaims = claimsYear
    ? allNurseClaims.filter(c => c.dosStart && new Date(c.dosStart).getUTCFullYear().toString() === claimsYear)
    : allNurseClaims
  const totalBilled = nurseClaims.reduce((s: number, c: any) => s + (c.totalBilled ?? 0), 0)
  const paidReimbursement = nurseClaims.reduce((s: number, c: any) => s + (c.primaryPaidAmt ?? 0) + (c.secondaryPaidAmt ?? 0), 0)
  const owedReimbursement = nurseClaims.reduce((s: number, c: any) => s + (c.remainingBalance ?? 0), 0)

  // ── Sorted time entries for proHours ──
  function sortedEntries(list: TimeEntry[]) {
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = new Date(a.workDate).getTime() - new Date(b.workDate).getTime()
      else if (sortField === 'hours') cmp = a.hours - b.hours
      else if (sortField === 'notes') cmp = (a.notes || '').localeCompare(b.notes || '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  function SortTh({ field, label }: { field: typeof sortField; label: string }) {
    const active = sortField === field
    return (
      <th
        className="text-left py-2 pr-4 cursor-pointer select-none"
        onClick={() => { if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc') } }}
      >
        <span className={`flex items-center gap-1 ${active ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'}`}>
          {label}
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : <span className="text-[#D9E1E8]"> ↕</span>}
        </span>
      </th>
    )
  }

  const TABS = [
    { id: 'profile',    label: 'proFile' },
    { id: 'hours',      label: 'proHours' },
    { id: 'claims',     label: 'proClaims' },
    { id: 'invoicing',  label: 'proInvoicing' },
    { id: 'docs',       label: 'proDocs' },
  ]

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      {/* ── Row 1: Back to Roster ── */}
      <div className="mb-2">
        <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">
          ← Back to Roster
        </Link>
      </div>

      {/* ── Row 2: Provider name + account number ── */}
      <div className="flex items-baseline gap-4 mb-5">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">{profile.displayName}</h1>
        {profile.accountNumber && (
          <span className="text-2xl font-mono font-bold text-[#7A8F79]">#{profile.accountNumber}</span>
        )}
      </div>

      {/* ── Sub-nav ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(tab => {
          const active = activeTab === tab.id
          const pro = tab.label.slice(0, 3)
          const rest = tab.label.slice(3)
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                active
                  ? 'bg-white text-[#2F3E4E] shadow'
                  : 'bg-[#2F3E4E] text-white hover:bg-[#3d5166]'
              }`}
            >
              <span className={`italic ${active ? 'text-[#7A8F79]' : 'text-[#7A8F79]'}`}>{pro}</span>
              {rest}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════
          proFile tab
      ══════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

          {/* ── Col 1: Individual Provider Info + Business Provider Info ── */}
          <div className="space-y-6">

            {/* Individual Provider Information */}
            <Section title="Individual Provider Information">
              <div className="grid grid-cols-3 gap-3">
                <Field label="First Name"     field="firstName"     profile={profile} setProfile={setProfile} />
                <Field label="MI"             field="middleInitial" profile={profile} setProfile={setProfile} />
                <Field label="Last Name"      field="lastName"      profile={profile} setProfile={setProfile} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"          field="phone"         profile={profile} setProfile={setProfile} type="tel" />
                <Field label="Email"          field="user.email"    profile={profile} setProfile={setProfile} type="email" />
              </div>
              <Field label="Home Address"     field="address"       profile={profile} setProfile={setProfile} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="City"           field="city"          profile={profile} setProfile={setProfile} />
                <Field label="State"          field="state"         profile={profile} setProfile={setProfile} />
                <Field label="ZIP"            field="zip"           profile={profile} setProfile={setProfile} />
              </div>
              <Field label="Preferred Name (optional)" field="displayName" profile={profile} setProfile={setProfile} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of Birth"  field="dob"           profile={profile} setProfile={setProfile} type="date" sensitive />
                <Field label="SSN"            field="ssn"           profile={profile} setProfile={setProfile} sensitive />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="NPI (Individual)" field="npiNumber"   profile={profile} setProfile={setProfile} sensitive />
                <Field label="Medicaid ID"    field="medicaidNumber" profile={profile} setProfile={setProfile} sensitive />
              </div>
            </Section>

            {/* Business Provider Information */}
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

                  {/* NPI Type + NPI + Medicaid ID — top row */}
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Business NPI</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={profile.bizNpi || ''}
                          onChange={(e) => setProfile({ ...profile, bizNpi: e.target.value })}
                          className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                          placeholder="10-digit NPI"
                          maxLength={10}
                        />
                        <button
                          type="button"
                          title="Look up NPI in NPPES registry"
                          onClick={async () => {
                            const npi = (profile.bizNpi || '').replace(/\D/g, '')
                            if (npi.length !== 10) { alert('Enter a 10-digit NPI first.'); return }
                            const res = await fetch(`/api/admin/npi-lookup?npi=${npi}`, { credentials: 'include' })
                            const d = await res.json()
                            if (!d.found) { alert(d.message || 'No record found for that NPI.'); return }
                            setProfile((p: Profile) => ({
                              ...p,
                              ...(d.npiType      && { bizNpiType:       d.npiType }),
                              ...(d.entityName   && { bizEntityName:    d.entityName }),
                              ...(d.address      && { bizServiceAddress: d.address }),
                              ...(d.city         && { bizCity:          d.city }),
                              ...(d.state        && { bizState:         d.state }),
                              ...(d.zip          && { bizZip:           d.zip }),
                            }))
                          }}
                          className="shrink-0 px-3 py-2 rounded-lg bg-[#F4F6F5] border border-[#D9E1E8] text-[#7A8F79] text-xs font-semibold hover:border-[#7A8F79] hover:text-[#2F3E4E] transition"
                        >
                          🔍 Lookup
                        </button>
                      </div>
                      {/* NPI Type checkboxes */}
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#2F3E4E]">
                          <input type="radio" name={`bizNpiType-${profile.id}`} value="Type1"
                            checked={profile.bizNpiType === 'Type1'}
                            onChange={() => setProfile({ ...profile, bizNpiType: 'Type1' })}
                            className="accent-[#7A8F79]" />
                          Type 1 — Individual
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#2F3E4E]">
                          <input type="radio" name={`bizNpiType-${profile.id}`} value="Type2"
                            checked={profile.bizNpiType === 'Type2'}
                            onChange={() => setProfile({ ...profile, bizNpiType: 'Type2' })}
                            className="accent-[#7A8F79]" />
                          Type 2 — Organizational
                        </label>
                      </div>
                    </div>
                    <Field label="Business Medicaid ID" field="bizMedicaidId" profile={profile} setProfile={setProfile} />
                  </div>

                  <Field label="Entity Name"       field="bizEntityName"     profile={profile} setProfile={setProfile} />
                  <Field label="Service Address"   field="bizServiceAddress" profile={profile} setProfile={setProfile} />
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="City"  field="bizCity"  profile={profile} setProfile={setProfile} />
                    <Field label="State" field="bizState" profile={profile} setProfile={setProfile} />
                    <Field label="Zip"   field="bizZip"   profile={profile} setProfile={setProfile} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Business Phone"  field="bizPhone" profile={profile} setProfile={setProfile} type="tel" />
                    <Field label="Business Email"  field="bizEmail" profile={profile} setProfile={setProfile} type="email" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="EIN"  field="ein"  profile={profile} setProfile={setProfile} sensitive />
                    <Field label="FEIN" field="fein" profile={profile} setProfile={setProfile} sensitive />
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={save}
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
          </div>

          {/* ── Col 2: Portal Access + Payment Information ── */}
          <div className="space-y-6">

            {/* Portal Access */}
            <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8] mb-4">
              Portal Access
            </h2>

            {/* Last login */}
            <div className="mb-4 flex items-center gap-2">
              {profile.user?.lastLoginAt ? (() => {
                const last = new Date(profile.user.lastLoginAt)
                const daysAgo = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
                const color = daysAgo <= 7 ? 'bg-green-100 text-green-700' : daysAgo <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                return (
                  <>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>
                      {daysAgo === 0 ? 'Active today' : daysAgo === 1 ? 'Active yesterday' : `Active ${daysAgo} days ago`}
                    </span>
                    <span className="text-xs text-[#7A8F79]">
                      Last login: {last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </>
                )
              })() : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                  Never logged in
                </span>
              )}
            </div>

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

            {/* Demo account toggle */}
            <div className="mt-4 pt-4 border-t border-[#D9E1E8] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#2F3E4E]">Demo Account</p>
                <p className="text-xs text-[#7A8F79] mt-0.5">Excluded from metrics. All writes blocked for this user.</p>
              </div>
              <button
                type="button"
                onClick={toggleDemo}
                disabled={demoSaving}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${isDemo ? 'bg-amber-400' : 'bg-[#D9E1E8]'} disabled:opacity-50`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDemo ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {isDemo && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">Demo Mode Active</p>
                <p className="text-[11px] text-amber-700">Populate this account with realistic mock time entries, claims, and invoices so the portal looks fully active for demos.</p>
                <button
                  type="button"
                  onClick={seedDemoData}
                  disabled={demoSeeding}
                  className="w-full bg-amber-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                >
                  {demoSeeding ? 'Seeding…' : '🌱 Populate Demo Data'}
                </button>
                {demoSeedMsg && (
                  <p className={`text-[11px] font-semibold ${demoSeedMsg.includes('failed') || demoSeedMsg.includes('Error') ? 'text-red-600' : 'text-green-700'}`}>
                    {demoSeedMsg}
                  </p>
                )}
              </div>
            )}

            {/* Plan & Trial */}
            <div className="mt-4 pt-4 border-t border-[#D9E1E8]">
              <p className="text-xs font-semibold text-[#2F3E4E] mb-0.5">myProvider Plan</p>
              <p className="text-xs text-[#7A8F79] mb-3">Controls which features this nurse can access.</p>

              {/* Tier selector */}
              <div className="mb-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'FREE',  label: 'Free',       sub: 'Hours only' },
                    { value: 'BASIC', label: 'Basic',      sub: '$5/mo' },
                    { value: 'PRO',   label: 'Pro',        sub: '$10/mo · Soon' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPlanTier(opt.value)}
                      disabled={opt.value === 'PRO'}
                      className={`rounded-lg border px-2 py-2 text-left transition disabled:opacity-40 disabled:cursor-not-allowed
                        ${planTier === opt.value
                          ? 'border-[#2F3E4E] bg-[#2F3E4E] text-white'
                          : 'border-[#D9E1E8] bg-white text-[#2F3E4E] hover:border-[#7A8F79]'}`}
                    >
                      <p className="text-xs font-bold leading-tight">{opt.label}</p>
                      <p className={`text-[10px] leading-tight mt-0.5 ${planTier === opt.value ? 'text-[#B0C4B1]' : 'text-[#7A8F79]'}`}>{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trial window — only relevant when tier is BASIC */}
              {planTier === 'BASIC' && (
                <div className="mb-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Trial Window</label>
                  <select
                    value={trialPreset}
                    onChange={e => {
                      setTrialPreset(e.target.value)
                      if (e.target.value !== 'custom') setTrialCustomDate('')
                    }}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  >
                    <option value="none">No trial — active subscription</option>
                    <option value="1week">1-week free trial</option>
                    <option value="2weeks">2-week free trial</option>
                    <option value="custom">Custom expiry date…</option>
                  </select>
                  {trialPreset === 'custom' && (
                    <input
                      type="date"
                      value={trialCustomDate}
                      onChange={e => setTrialCustomDate(e.target.value)}
                      className="mt-2 w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  )}
                  {trialPreset !== 'none' && (
                    <p className="text-[11px] text-[#7A8F79] mt-1.5">
                      After the trial expires the nurse will revert to Free access automatically.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={savePlan}
                  disabled={planSaving}
                  className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold disabled:opacity-50"
                >
                  {planSaving ? 'Saving…' : 'Save Plan'}
                </button>
                {planMessage && (
                  <p className={`text-xs font-medium ${planMessage.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
                    {planMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#D9E1E8]">
              <p className="text-xs font-semibold text-[#2F3E4E] mb-1">Set Password Manually</p>
              <p className="text-xs text-[#7A8F79] mb-2">Set a specific password without sending an email.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="flex-1 border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
                <button
                  type="button"
                  onClick={setPassword}
                  disabled={pwSaving || !newPassword.trim()}
                  className="shrink-0 bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold disabled:opacity-50"
                >
                  {pwSaving ? 'Saving…' : 'Set Password'}
                </button>
              </div>
              {pwMessage && (
                <p className={`mt-2 text-xs font-medium ${pwMessage.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
                  {pwMessage}
                </p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-[#D9E1E8] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#2F3E4E]">Resend Portal Invite</p>
                <p className="text-xs text-[#7A8F79] mt-0.5">Resets their password and sends a new welcome email.</p>
              </div>
              <button
                type="button"
                onClick={resendInvite}
                disabled={inviteSending}
                className="shrink-0 ml-4 bg-[#7A8F79] text-white px-4 py-2 rounded-lg hover:bg-[#657a64] transition text-sm font-semibold disabled:opacity-50"
              >
                {inviteSending ? 'Sending…' : 'Resend Invite'}
              </button>
            </div>
            {inviteMessage && (
              <p className={`mt-2 text-xs font-medium ${inviteMessage.includes('Failed') || inviteMessage.includes('error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
                {inviteMessage}
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-[#D9E1E8] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#2F3E4E]">Weekly Reminder Emails</p>
                <p className="text-xs text-[#7A8F79] mt-0.5">
                  {notifEnabled ? 'This provider receives weekly hour submission reminders.' : 'Weekly reminders are turned off for this provider.'}
                </p>
              </div>
              <button
                type="button"
                disabled={notifSaving}
                onClick={async () => {
                  const next = !notifEnabled
                  setNotifSaving(true)
                  const res = await fetch(`/api/admin/nurses/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ receiveNotifications: next }),
                  })
                  setNotifSaving(false)
                  if (res.ok) setNotifEnabled(next)
                }}
                className={`shrink-0 ml-4 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${
                  notifEnabled
                    ? 'bg-[#D9E1E8] text-[#2F3E4E] hover:bg-red-100 hover:text-red-600'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {notifSaving ? 'Saving…' : notifEnabled ? 'Turn Off' : 'Turn On'}
              </button>
            </div>
          </div>

            {/* Notification Preferences (read-only view of provider's own settings) */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8] mb-4">
                Notification Preferences
              </h2>
              <p className="text-xs text-[#7A8F79] mb-4">Set by the provider in their own profile. Read-only here.</p>
              <div className="space-y-2.5">
                {([
                  { label: 'New Claim Alerts',          field: 'notifyNewClaim',        desc: 'Notified when a claim is added to their account' },
                  { label: 'New Document Alerts',       field: 'notifyNewDocument',     desc: 'Notified when a document is uploaded to their account' },
                  { label: 'Billing Reminders',         field: 'notifyBillingReminder', desc: 'Receives billing-related reminder emails' },
                  { label: 'Document Expiry Reminders', field: 'notifyDocExpiring',     desc: 'Notified when a license or document is expiring' },
                  { label: 'Weekly Hour Reminders',     field: 'receiveNotifications',  desc: 'Receives weekly hour submission reminder emails' },
                ] as { label: string; field: string; desc: string }[]).map(({ label, field, desc }) => {
                  const enabled = profile[field] !== false
                  return (
                    <div key={field} className="flex items-center justify-between gap-3 py-1">
                      <div>
                        <p className="text-sm font-semibold text-[#2F3E4E] leading-tight">{label}</p>
                        <p className="text-xs text-[#7A8F79] mt-0.5">{desc}</p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {enabled ? 'Opted In' : 'Opted Out'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Payment Information */}
            <Section title="Payment Information">
              <Field label="Bank Name"         field="bankName"       profile={profile} setProfile={setProfile} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Routing #"       field="bankRouting"    profile={profile} setProfile={setProfile} sensitive />
                <Field label="Account #"       field="bankAccount"    profile={profile} setProfile={setProfile} sensitive />
              </div>
            </Section>

            {/* ── Billing Campaign ── */}
            <Section title="Billing Campaign">
              {enrollmentLoading ? (
                <p className="text-xs text-[#7A8F79]">Loading…</p>
              ) : activeEnrollment ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-0.5">Active Campaign</p>
                        <p className="text-sm font-bold text-[#2F3E4E]">{activeEnrollment.campaignName}</p>
                        <p className="text-xs text-[#7A8F79] mt-0.5">{activeEnrollment.ruleLabel}</p>
                        <p className="text-xs text-[#7A8F79]">{activeEnrollment.windowLabel}</p>
                      </div>
                      <button
                        onClick={() => unenrollFromCampaign(activeEnrollment.campaignId)}
                        disabled={enrollmentSaving}
                        className="text-xs text-red-400 hover:text-red-600 font-semibold whitespace-nowrap transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                    {invoicePreview && invoicePreview.discountAmt > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-green-600 uppercase tracking-widest font-semibold">Gross</p>
                          <p className="text-sm font-bold text-[#2F3E4E]">${invoicePreview.grossAmount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-green-600 uppercase tracking-widest font-semibold">Discount</p>
                          <p className="text-sm font-bold text-green-700">−${invoicePreview.discountAmt.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-green-600 uppercase tracking-widest font-semibold">Total</p>
                          <p className="text-sm font-bold text-[#2F3E4E]">${invoicePreview.totalAmount.toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#7A8F79]">To switch campaigns, remove this one then assign a new one.</p>
                  {enrollmentMsg && <p className="text-xs font-semibold text-[#7A8F79]">{enrollmentMsg}</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#7A8F79]">No active campaign. Select one to apply a discount to future invoices.</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedCampaignId}
                      onChange={e => setSelectedCampaignId(e.target.value)}
                      className="flex-1 border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    >
                      <option value="">— Select a campaign —</option>
                      {campaigns.filter(c => c.active).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={enrollInCampaign}
                      disabled={!selectedCampaignId || enrollmentSaving}
                      className="bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
                    >
                      {enrollmentSaving ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                  {campaigns.length === 0 && (
                    <p className="text-xs text-[#7A8F79]">
                      No campaigns created yet. <a href="/admin/campaigns" className="underline text-[#2F3E4E]">Create one →</a>
                    </p>
                  )}
                  {enrollmentMsg && <p className="text-xs font-semibold text-[#7A8F79]">{enrollmentMsg}</p>}
                </div>
              )}
            </Section>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          proHours tab
      ══════════════════════════════════════════════════ */}
      {activeTab === 'hours' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Col 1: Log Hours */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8] mb-4">
              Log Hours
            </h2>
            <form onSubmit={submitTimeEntry} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Date of Service</label>
                  <DateInput ref={workDateRef} value={workDate} onChange={setWorkDate} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={workHours}
                    onChange={e => setWorkHours(e.target.value)}
                    placeholder="e.g. 8"
                    required
                    className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Notes <span className="normal-case font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={workNotes}
                  onChange={e => setWorkNotes(e.target.value)}
                  placeholder="e.g. Home visit — patient care"
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={workSubmitting || !workDate || !workHours}
                  className="bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
                >
                  {workSubmitting ? 'Adding…' : 'Add Entry'}
                </button>
                {workMessage && <p className="text-sm text-[#7A8F79]">{workMessage}</p>}
              </div>
            </form>
          </div>

          {/* Col 2+3: Time Log & Invoice Assignment */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">
                Time Log &amp; Invoice Assignment
              </h2>
              {pendingEntries.length > 0 && selectedCount === 0 && (
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="bg-[#7A8F79] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#2F3E4E] transition"
                >
                  Create Invoice ({pendingEntries.length} flagged · ${pendingTotal.toFixed(2)})
                </button>
              )}
            </div>

            {/* Bulk action bar */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-3 bg-[#F4F6F5] rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-[#2F3E4E]">{selectedCount} selected</span>
                <button
                  type="button"
                  onClick={bulkDelete}
                  disabled={bulkDeleting}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold border border-red-200 px-3 py-1 rounded-lg transition disabled:opacity-50"
                >
                  {bulkDeleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={handleBulkInvoice}
                  disabled={bulkFlagging}
                  className="text-xs bg-[#2F3E4E] text-white font-semibold px-3 py-1 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50"
                >
                  {bulkFlagging ? 'Preparing…' : 'Create Invoice'}
                </button>
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-sm text-[#7A8F79] italic">No time entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                      <th className="text-left py-2 pr-3 w-8">
                        <input
                          type="checkbox"
                          checked={allNonInvoicedSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-[#7A8F79]"
                          title={allNonInvoicedSelected ? 'Deselect all' : 'Select all'}
                        />
                      </th>
                      <SortTh field="date" label="Date" />
                      <th className="text-left py-2 pr-4">Claim Ref #</th>
                      <SortTh field="hours" label="Hrs" />
                      <SortTh field="notes" label="Notes" />
                      <th className="text-left py-2">Fee / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...invoiceGroupMap.entries()].map(([invoiceId, group]) => {
                      const dates = group.map(e => new Date(e.workDate).getTime())
                      const minDate = new Date(Math.min(...dates)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                      const maxDate = new Date(Math.max(...dates)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                      const totalFee = group.reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)
                      const invoiceNum = group[0]?.invoice?.invoiceNumber ? shortInvoiceNumber(group[0].invoice.invoiceNumber) : invoiceId.slice(0, 8)
                      const firstRef = group.find(e => e.claimRef)?.claimRef
                      return (
                        <tr key={invoiceId} className="border-b border-[#D9E1E8] bg-green-50">
                          <td className="py-2 pr-3"><span className="block w-4 h-4 rounded bg-green-200" /></td>
                          <td className="py-2 pr-4 text-xs text-[#2F3E4E] whitespace-nowrap">
                            {minDate === maxDate ? minDate : `${minDate} – ${maxDate}`}
                          </td>
                          <td className="py-2 pr-4 text-xs text-[#7A8F79]">{firstRef || '—'}</td>
                          <td className="py-2 pr-4 text-right text-xs text-[#7A8F79]">{group.reduce((s, e) => s + e.hours, 0)}</td>
                          <td className="py-2 pr-4 text-xs text-[#7A8F79] italic">{group.length} entr{group.length === 1 ? 'y' : 'ies'}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">{invoiceNum}</span>
                              <span className="text-xs font-bold text-green-700">${totalFee.toFixed(2)}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {sortedEntries(notInvoicedEntries).map((entry, i) => {
                      const isSelected = selectedEntries.has(entry.id)
                      const dateStr = new Date(entry.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-[#D9E1E8] last:border-0 transition-colors ${isSelected ? 'bg-blue-50' : i % 2 === 0 ? '' : 'bg-[#F4F6F5]'}`}
                        >
                          <td className="py-2.5 pr-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(entry.id)} className="w-4 h-4 accent-[#7A8F79]" />
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-[#2F3E4E] whitespace-nowrap">{dateStr}</td>
                          <td className="py-2.5 pr-4">
                            <input
                              type="text"
                              value={claimRefs[entry.id] ?? entry.claimRef ?? ''}
                              onChange={e => setClaimRefs(prev => ({ ...prev, [entry.id]: e.target.value }))}
                              onBlur={e => saveClaimRef(entry.id, e.target.value)}
                              placeholder="CLM-001"
                              className="border border-[#D9E1E8] rounded px-2 py-1 text-xs text-[#2F3E4E] w-24 focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                            />
                          </td>
                          <td
                            className="py-2.5 pr-4 text-right text-xs font-semibold text-[#2F3E4E] select-none"
                            title={entry.invoiceId ? 'Already invoiced' : 'Double-click to edit hours'}
                            onDoubleClick={() => {
                              if (entry.invoiceId) return
                              setEditingHoursId(entry.id)
                              setEditHoursVal(String(entry.hours))
                            }}
                          >
                            {editingHoursId === entry.id ? (
                              <input
                                autoFocus
                                type="number"
                                min="1"
                                step="1"
                                value={editHoursVal}
                                onChange={(e: { target: HTMLInputElement }) => setEditHoursVal(e.target.value)}
                                onKeyDown={(e: { key: string }) => {
                                  if (e.key === 'Enter') saveHoursEdit(entry.id)
                                  if (e.key === 'Escape') setEditingHoursId(null)
                                }}
                                onBlur={() => saveHoursEdit(entry.id)}
                                disabled={savingHours}
                                className="w-14 border border-[#7A8F79] rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                              />
                            ) : (
                              <span className={`${entry.invoiceId ? 'text-[#7A8F79] cursor-not-allowed' : 'underline decoration-dotted decoration-[#7A8F79] underline-offset-2 cursor-text'}`}>
                                {entry.hours}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-[#7A8F79] italic text-xs max-w-[120px] truncate">{entry.notes || '—'}</td>
                          <td className="py-2.5">
                            {entry.readyToInvoice ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={entry.invoiceFeePlan ?? 'A1'}
                                  onChange={e => toggleInvoiceFlag(entry, true, e.target.value)}
                                  className="border border-[#D9E1E8] rounded px-1.5 py-1 text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                                >
                                  {FEE_PLANS.map(p => (
                                    <option key={p.value} value={p.value}>{p.value} — ${p.amount.toFixed(2)}</option>
                                  ))}
                                </select>
                                <span className="text-xs font-bold text-[#2F3E4E]">${(entry.invoiceFeeAmt ?? 0).toFixed(2)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#D9E1E8] italic">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}{/* end proHours tab */}

      {/* ══════════════════════════════════════════════════
          proClaims tab
      ══════════════════════════════════════════════════ */}
      {activeTab === 'claims' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Col 1: Claims Access Aliases */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
              Claims Access — Provider Aliases
            </h2>
            <p className="text-xs text-[#7A8F79]">
              This provider will see any claim where the Provider Name in the CSV matches one of these aliases exactly.
            </p>
            <AliasEditor
              aliases={profile.providerAliases || []}
              onChange={(aliases) => setProfile({ ...profile, providerAliases: aliases })}
            />
            <p className="text-xs text-[#7A8F79] italic">Changes are saved with the Save Profile button.</p>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Aliases'}
            </button>
          </div>

          {/* Col 2+3: Metric cards */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-[#2F3E4E]">{nurseClaims.length}</p>
              <p className="text-xs text-[#7A8F79] mt-1 font-semibold uppercase tracking-wide">Total Claims</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-[#2F3E4E]">${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-[#7A8F79] mt-1 font-semibold uppercase tracking-wide">Total Billed</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-green-600">${paidReimbursement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-[#7A8F79] mt-1 font-semibold uppercase tracking-wide">Paid Reimbursement</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-amber-600">${owedReimbursement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-[#7A8F79] mt-1 font-semibold uppercase tracking-wide">Owed Reimbursement</p>
            </div>
          </div>

          {/* Full-width: Claims table */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#D9E1E8]">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">
                Claims — {profile.displayName}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {(['', '2024', '2025', '2026', '2027', '2028', '2029', '2030'] as const).map(y => (
                  <button
                    key={y || 'all'}
                    onClick={() => setClaimsYear(y)}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                      claimsYear === y
                        ? 'bg-[#2F3E4E] text-white'
                        : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'
                    }`}
                  >
                    {y || 'All'}
                  </button>
                ))}
              </div>
            </div>
            {claimsLoading ? (
              <p className="text-sm text-[#7A8F79] italic">Loading claims…</p>
            ) : allNurseClaims.length === 0 ? (
              <p className="text-sm text-[#7A8F79] italic">No claims found for this provider.</p>
            ) : nurseClaims.length === 0 ? (
              <p className="text-sm text-[#7A8F79] italic">No claims found for {claimsYear}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[900px] text-[#2F3E4E]">
                  <thead>
                    <tr className="text-[#7A8F79] uppercase tracking-wide border-b border-[#D9E1E8]">
                      <th className="text-left py-2 pr-3">Claim ID</th>
                      <th className="text-left py-2 pr-3">DOS Start</th>
                      <th className="text-left py-2 pr-3">DOS Stop</th>
                      <th className="text-left py-2 pr-3">Stage</th>
                      <th className="text-right py-2 pr-3">Total Billed</th>
                      <th className="text-left py-2 pr-3">Primary Payer</th>
                      <th className="text-right py-2 pr-3">Primary Paid</th>
                      <th className="text-left py-2 pr-3">Secondary Payer</th>
                      <th className="text-right py-2 pr-3">Secondary Paid</th>
                      <th className="text-right py-2">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nurseClaims.map((c: any, i: number) => {
                      const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'
                      const money = (v: number | null) => v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'
                      const stageColor = (s: string) => {
                        if (['Paid', 'Finalized'].includes(s)) return 'bg-green-100 text-green-700'
                        if (['Denied', 'Rejected'].includes(s)) return 'bg-red-100 text-red-700'
                        if (s === 'Pending') return 'bg-yellow-100 text-yellow-700'
                        if (['INS-1 Submitted', 'INS-2 Submitted', 'Resubmitted'].includes(s)) return 'bg-blue-100 text-blue-700'
                        if (s === 'Info Requested') return 'bg-orange-100 text-orange-700'
                        if (s === 'Appealed') return 'bg-purple-100 text-purple-700'
                        return 'bg-gray-100 text-gray-600'
                      }
                      return (
                        <tr key={c.id} className={`border-b border-[#D9E1E8] last:border-0 ${i % 2 === 0 ? '' : 'bg-[#F4F6F5]'}`}>
                          <td className="py-2 pr-3 font-mono text-[#2F3E4E]">{c.claimId || '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{fmt(c.dosStart)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{fmt(c.dosStop)}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] whitespace-nowrap ${stageColor(c.claimStage || '')}`}>
                              {c.claimStage || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right font-semibold">{money(c.totalBilled)}</td>
                          <td className="py-2 pr-3 max-w-[120px] truncate">{c.primaryPayer || '—'}</td>
                          <td className="py-2 pr-3 text-right text-green-600 font-semibold">{money(c.primaryPaidAmt)}</td>
                          <td className="py-2 pr-3 max-w-[120px] truncate">{c.secondaryPayer || '—'}</td>
                          <td className="py-2 pr-3 text-right text-green-600 font-semibold">{money(c.secondaryPaidAmt)}</td>
                          <td className="py-2 text-right font-bold text-amber-600">{money(c.remainingBalance)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}{/* end proClaims tab */}

      {/* ══════════════════════════════════════════════════
          proInvoicing tab
      ══════════════════════════════════════════════════ */}
      {activeTab === 'invoicing' && (() => {
        const fmtD = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        const invoicedTotal = invoiceHistory.reduce((s, inv) => s + inv.totalAmount, 0)
        const outstandingInvoices = invoiceHistory.filter(inv => ['Sent','Partial','Overdue','Pending'].includes(inv.status))
        const outstandingTotal = outstandingInvoices.reduce((s, inv) => s + (inv.totalAmount - (inv.paidAmount || 0)), 0)
        const statusColor = (s: string) => {
          if (s === 'Paid') return 'bg-green-100 text-green-700'
          if (['Sent','Pending'].includes(s)) return 'bg-blue-100 text-blue-700'
          if (s === 'Partial') return 'bg-amber-100 text-amber-700'
          if (['Overdue','Disputed'].includes(s)) return 'bg-red-100 text-red-700'
          if (s === 'WrittenOff') return 'bg-gray-100 text-gray-500'
          return 'bg-gray-100 text-gray-600'
        }
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ── Col 1: Invoice Summary + Receipts & Statements ── */}
            <div className="space-y-6">

              {/* Invoice Summary */}
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
                  Invoice Summary
                </h2>
                <div className="space-y-3">
                  <div className="bg-[#F4F6F5] rounded-lg p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Invoices Created</p>
                    <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{invoiceHistory.length}</p>
                    <p className="text-sm font-semibold text-[#7A8F79] mt-0.5">${invoicedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`rounded-lg p-4 ${outstandingInvoices.length > 0 ? 'bg-amber-50' : 'bg-[#F4F6F5]'}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Outstanding</p>
                    <p className={`text-2xl font-bold mt-1 ${outstandingInvoices.length > 0 ? 'text-amber-600' : 'text-[#2F3E4E]'}`}>
                      {outstandingInvoices.length}
                    </p>
                    <p className={`text-sm font-semibold mt-0.5 ${outstandingInvoices.length > 0 ? 'text-[#7A8F79]' : 'text-[#7A8F79]'}`}>
                      ${outstandingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                {invoiceMessage && (
                  <p className={`text-xs font-semibold ${invoiceMessage.includes('sent') ? 'text-[#7A8F79]' : 'text-red-500'}`}>
                    {invoiceMessage}
                  </p>
                )}
              </div>

              {/* Receipts & Statements */}
              {(() => {
                const years = Array.from(new Set(
                  invoiceHistory.map(inv => new Date(inv.sentAt).getFullYear().toString())
                )).sort((a, b) => Number(b) - Number(a))
                const allReceipts = invoiceHistory.flatMap(inv =>
                  inv.payments.map(p => ({ ...p, invoiceNumber: inv.invoiceNumber, invoiceId: inv.id }))
                ).filter(p => {
                  if (receiptYearFilter === 'all') return true
                  return new Date(p.appliedAt).getFullYear().toString() === receiptYearFilter
                }).sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
                const totalReceived = allReceipts.reduce((s, p) => s + p.amount, 0)
                return (
                  <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">
                        Receipts &amp; Statements
                      </h2>
                      <button
                        onClick={() => { setShowActivityLog(true); fetchActivity() }}
                        className="text-[10px] text-[#7A8F79] hover:text-[#2F3E4E] underline transition"
                      >
                        View Send Log
                      </button>
                    </div>

                    {/* Year filters */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setReceiptYearFilter('all')}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${receiptYearFilter === 'all' ? 'bg-[#2F3E4E] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
                      >All</button>
                      {years.map(y => (
                        <button
                          key={y}
                          onClick={() => setReceiptYearFilter(y)}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${receiptYearFilter === y ? 'bg-[#2F3E4E] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
                        >{y}</button>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Receipts</span>
                        <p className="text-lg font-bold text-[#2F3E4E]">{allReceipts.length}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Total Received</span>
                        <p className="text-lg font-bold text-green-600">${totalReceived.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Statement action buttons */}
                    <div className="flex flex-col gap-2">
                      {receiptYearFilter !== 'all' ? (
                        <button
                          onClick={() => printStatement(receiptYearFilter)}
                          className="text-xs bg-[#F4F6F5] text-[#2F3E4E] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#D9E1E8] transition text-left"
                        >
                          🖨 Print {receiptYearFilter} Statement
                        </button>
                      ) : (
                        <button
                          onClick={() => printStatement()}
                          className="text-xs bg-[#F4F6F5] text-[#2F3E4E] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#D9E1E8] transition text-left"
                        >
                          🖨 Print Full Statement
                        </button>
                      )}
                    </div>

                    {allReceipts.length === 0 ? (
                      <p className="text-sm text-[#7A8F79] italic">No payment receipts recorded yet.</p>
                    ) : (
                      <div className="divide-y divide-[#D9E1E8] border border-[#D9E1E8] rounded-xl overflow-hidden">
                        {allReceipts.map(p => (
                          <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#2F3E4E] font-mono">{p.receiptNumber}</span>
                                <span className="text-[10px] font-semibold bg-[#D9E1E8] text-[#2F3E4E] px-1.5 py-0.5 rounded-full">{p.method || 'Other'}</span>
                                <span className="text-[10px] text-[#7A8F79]">→ {shortInvoiceNumber(p.invoiceNumber)}</span>
                              </div>
                              <span className="text-[10px] text-[#7A8F79]">{fmtD(p.appliedAt)}</span>
                            </div>
                            <span className="text-sm font-bold text-green-600 whitespace-nowrap">${p.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* ── Col 2+3: Invoice list ── */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
                Invoices — {profile.displayName}
              </h2>
              {invoiceHistory.length === 0 ? (
                <p className="text-sm text-[#7A8F79] italic">No invoices created yet.</p>
              ) : (
                <div className="space-y-3">
                  {invoiceHistory.map(inv => {
                    const balance = inv.totalAmount - (inv.paidAmount || 0)
                    return (
                      <div key={inv.id} className="border border-[#D9E1E8] rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-[#F4F6F5]">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-mono font-bold text-sm text-[#2F3E4E]">{shortInvoiceNumber(inv.invoiceNumber)}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(inv.status)}`}>
                              {inv.status}
                            </span>
                            <span className="text-xs text-[#7A8F79]">Issued {fmtD(inv.sentAt)}</span>
                            <span className="text-xs text-[#7A8F79]">Due By{fmtD(inv.dueDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-sm font-bold text-[#2F3E4E]">${inv.totalAmount.toFixed(2)}</span>
                            {balance > 0 && (
                              <span className="text-xs font-semibold text-amber-600">({balance.toFixed(2)} owed)</span>
                            )}
                            <button
                              onClick={() => openInvoicePreview(inv)}
                              className="text-xs bg-[#2F3E4E] text-white px-3 py-1 rounded-lg font-semibold hover:bg-[#7A8F79] transition"
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                        {inv.entries.length > 0 && (
                          <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-wide">
                              {inv.entries.length} entr{inv.entries.length === 1 ? 'y' : 'ies'}
                            </span>
                            {inv.payments.length > 0 && inv.payments.map(p => (
                              <span key={p.id} className="text-[10px] bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                                {p.receiptNumber} · ${p.amount.toFixed(2)} via {p.method || 'Other'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )
      })()}
      {/* end proInvoicing tab */}

      {/* ══════════════════════════════════════════════════
          proDocs tab
      ══════════════════════════════════════════════════ */}
      {activeTab === 'docs' && (
        <div className="space-y-6">

          {/* Document Library */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
              Document Library — {profile.displayName}
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-[#7A8F79] italic">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => {
                  const days = doc.expiresAt
                    ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null
                  const expiryColor = days == null ? '' : days < 0 ? 'text-red-600' : days <= 30 ? 'text-orange-500' : 'text-[#7A8F79]'
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-[#F4F6F5] rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#2F3E4E] truncate">{doc.title}</p>
                          <span className="text-[10px] font-semibold bg-[#D9E1E8] text-[#2F3E4E] px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">{doc.category}</span>
                        </div>
                        <p className="text-[11px] text-[#7A8F79] truncate">{doc.fileName}</p>
                        {doc.expiresAt && (
                          <p className={`text-[11px] font-semibold mt-0.5 ${expiryColor}`}>
                            {days != null && days < 0 ? 'Expired' : `Expires ${new Date(doc.expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}`}
                            {doc.reminderDays.length > 0 && ` · Reminders: ${doc.reminderDays.join(', ')}d`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          const next = !doc.visibleToNurse
                          await fetch(`/api/admin/documents/${doc.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ visibleToNurse: next }),
                          })
                          setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, visibleToNurse: next } : d))
                        }}
                        title={doc.visibleToNurse ? 'Visible to nurse — click to hide' : 'Hidden from nurse — click to share'}
                        className={`text-xs px-2 py-1 rounded border transition ${doc.visibleToNurse ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}
                      >
                        {doc.visibleToNurse ? 'Shared' : 'Share'}
                      </button>
                      <button
                        onClick={() => handleDocView(doc.id)}
                        disabled={docViewing === doc.id}
                        className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] px-2 py-1 rounded transition disabled:opacity-50"
                      >
                        {docViewing === doc.id ? '…' : 'View'}
                      </button>
                      <button
                        onClick={() => handleDocDelete(doc.id)}
                        disabled={docDeleting === doc.id}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-2 py-1 rounded transition disabled:opacity-50"
                      >
                        {docDeleting === doc.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upload New Document */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8] mb-4">
              Upload New Document
            </h2>
            <form onSubmit={handleDocUpload} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Document Title</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    placeholder="e.g. Medicaid License 2026"
                    className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Category</label>
                    <button
                      type="button"
                      onClick={() => setShowCatManager(v => !v)}
                      className="text-[10px] text-[#7A8F79] hover:text-[#2F3E4E] underline transition"
                    >
                      {showCatManager ? 'Done' : 'Manage folders'}
                    </button>
                  </div>
                  <select
                    value={docCategory}
                    onChange={e => setDocCategory(e.target.value)}
                    className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  {showCatManager && (
                    <div className="mt-2 border border-[#D9E1E8] rounded-lg p-3 bg-[#FAFBFC] space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">Folder List</p>
                      <div className="space-y-1">
                        {categories.map(c => (
                          <div key={c.id} className="flex items-center gap-2 py-0.5">
                            {catEditingId === c.id ? (
                              <>
                                <input
                                  type="text"
                                  value={catEditName}
                                  onChange={e => setCatEditName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRenameCategory(c.id) } if (e.key === 'Escape') { setCatEditingId(null); setCatEditName('') } }}
                                  autoFocus
                                  className="flex-1 border border-[#7A8F79] px-2 py-0.5 rounded text-sm text-[#2F3E4E] focus:outline-none"
                                />
                                <button type="button" onClick={() => handleRenameCategory(c.id)} className="text-[11px] text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">Save</button>
                                <button type="button" onClick={() => { setCatEditingId(null); setCatEditName('') }} className="text-[11px] text-[#7A8F79] hover:text-[#2F3E4E] transition">Cancel</button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 text-sm text-[#2F3E4E]">{c.name}</span>
                                <button
                                  type="button"
                                  onClick={() => { setCatEditingId(c.id); setCatEditName(c.name) }}
                                  className="text-[11px] text-[#7A8F79] hover:text-[#2F3E4E] transition"
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(c.id, c.name)}
                                  disabled={catDeleting === c.id}
                                  className="text-[11px] text-red-400 hover:text-red-600 transition disabled:opacity-40"
                                >
                                  {catDeleting === c.id ? '…' : 'Remove'}
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <form onSubmit={handleAddCategory} className="flex gap-2 pt-1 border-t border-[#D9E1E8]">
                        <input
                          type="text"
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          placeholder="New folder name"
                          className="flex-1 border border-[#D9E1E8] px-2 py-1 rounded text-sm text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                        />
                        <button
                          type="submit"
                          disabled={catSaving || !newCatName.trim()}
                          className="bg-[#7A8F79] text-white px-3 py-1 rounded text-xs font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
                        >
                          {catSaving ? '…' : 'Add'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
                  Expiration Date <span className="normal-case font-normal text-[#7A8F79]">(optional)</span>
                </label>
                <input
                  type="date"
                  value={docExpiry}
                  onChange={e => setDocExpiry(e.target.value)}
                  className="w-full border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">File</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={e => setDocFile(e.target.files?.[0] || null)}
                    className="flex-1 text-sm text-[#2F3E4E] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#D9E1E8] file:text-[#2F3E4E] hover:file:bg-[#7A8F79] hover:file:text-white transition"
                    required
                  />
                  <button
                    type="submit"
                    disabled={docUploading || !docFile || !docTitle}
                    className="flex-shrink-0 bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
                  >
                    {docUploading ? 'Uploading…' : 'Upload Document'}
                  </button>
                </div>
              </div>
              {docExpiry && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Email Reminders Before Expiry</label>
                  <div className="flex flex-wrap gap-3">
                    {[90, 60, 30, 14, 7, 1].map(days => (
                      <label key={days} className="flex items-center gap-1.5 text-sm text-[#2F3E4E] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={docReminderDays.includes(days)}
                          onChange={e => setDocReminderDays(prev =>
                            e.target.checked ? [...prev, days] : prev.filter(d => d !== days)
                          )}
                          className="accent-[#7A8F79]"
                        />
                        {days === 1 ? '1 day' : `${days} days`}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={docVisibleToNurse}
                  onChange={e => setDocVisibleToNurse(e.target.checked)}
                  className="accent-[#7A8F79]"
                />
                <span className="text-sm text-[#2F3E4E]">Share with nurse (visible on their profile)</span>
              </label>
              {docMessage && (
                <p className={`text-sm ${docMessageIsError ? 'text-[#9B1C1C]' : 'text-[#7A8F79]'}`}>
                  {docMessage}
                </p>
              )}
            </form>
          </div>

        </div>
      )}{/* end proDocs tab */}

      {/* ── Invoice Preview Modal ── */}
      {previewInvoice && (() => {
        const fmtI = (d: string | Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        const FEE_LABELS: Record<string,string> = { A1: 'Medicaid — Single Payer', A2: 'Commercial — Single Payer', B: 'Dual Payer', C: '3+ Payer' }
        const det = previewDetail
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#D9E1E8]">
                <h3 className="text-lg font-bold text-[#2F3E4E]">{shortInvoiceNumber(previewInvoice.invoiceNumber)}</h3>
                <button onClick={() => { setPreviewInvoice(null); setPreviewDetail(null); setPreviewMessage('') }} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">×</button>
              </div>

              <div className="p-6 space-y-5 text-[#2F3E4E]">
                {previewLoading ? (
                  <p className="text-sm text-[#7A8F79] italic text-center py-8">Loading…</p>
                ) : det ? (
                  <>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xl font-black tracking-tight">Coming Home Care Services, LLC</p>
                        <p className="text-xs text-[#7A8F79] mt-0.5">cominghomecare.com · billing@cominghomecare.com</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#7A8F79] uppercase tracking-widest font-semibold mb-0.5">Invoice</p>
                        <p className="font-semibold text-[#7A8F79] italic">{shortInvoiceNumber(previewInvoice.invoiceNumber)}</p>
                        <p className="text-xs text-[#7A8F79] mt-1">Issued {fmtI(previewInvoice.sentAt)}</p>
                        <p className="text-xs text-[#7A8F79]">Due {fmtI(previewInvoice.dueDate)}</p>
                      </div>
                    </div>

                    <div className="bg-[#f4f6f8] rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Bill To</p>
                      <p className="font-semibold text-[#2F3E4E]">{previewInvoice?.invoiceNumber ? det.nurseName : profile.displayName}</p>
                      <p className="text-xs text-[#7A8F79]">{det.nurseEmail}</p>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-[#D9E1E8]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#f4f6f8]">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Date</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Plan</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide hidden sm:table-cell">Description</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Fee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(det.entries || []).map((e: any, i: number) => (
                            <tr key={i} className="border-t border-[#D9E1E8]">
                              <td className="px-4 py-2.5 font-semibold">{fmtI(e.workDate)}</td>
                              <td className="px-4 py-2.5"><span className="bg-[#2F3E4E] text-white text-xs font-bold px-2 py-0.5 rounded">{e.invoiceFeePlan}</span></td>
                              <td className="px-4 py-2.5 text-[#4a5a6a] hidden sm:table-cell">{FEE_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan}</td>
                              <td className="px-4 py-2.5 text-right font-bold">${(e.invoiceFeeAmt ?? 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                            <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Total Due</td>
                            <td className="px-4 py-3 text-right text-xl font-black">${previewInvoice.totalAmount.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {det.payments && det.payments.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Payments Applied</p>
                        {det.payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-sm px-1">
                            <span className="text-[#7A8F79]">{p.receiptNumber} · {p.method || 'Other'} · {fmtI(p.appliedAt)}</span>
                            <span className="font-semibold text-green-600">−${p.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {previewMessage && (
                      <p className={`text-xs font-semibold text-center ${previewMessage.includes('success') ? 'text-[#7A8F79]' : 'text-red-500'}`}>{previewMessage}</p>
                    )}

                    <div className="flex gap-3 pt-2 border-t border-[#D9E1E8]">
                      <button
                        onClick={() => { setPreviewInvoice(null); setPreviewDetail(null); setPreviewMessage('') }}
                        className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f6f8] transition"
                      >Cancel</button>
                      <button
                        onClick={() => printInvoice(previewInvoice)}
                        className="flex-1 bg-[#F4F6F5] text-[#2F3E4E] py-2 rounded-lg text-sm font-semibold hover:bg-[#D9E1E8] transition"
                      >🖨 Print</button>
                      <button
                        onClick={() => sendInvoiceEmail(previewInvoice)}
                        disabled={previewSending}
                        className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
                      >{previewSending ? 'Sending…' : '✉ Send'}</button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-500 italic">Failed to load invoice details.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Activity Log Modal ── */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#D9E1E8]">
              <h3 className="text-base font-bold text-[#2F3E4E]">Send &amp; Print Log</h3>
              <button onClick={() => setShowActivityLog(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-3">
              {activityLoading ? (
                <p className="text-sm text-[#7A8F79] italic text-center py-6">Loading…</p>
              ) : invoiceActivity.length === 0 ? (
                <p className="text-sm text-[#7A8F79] italic">No activity recorded yet.</p>
              ) : (
                invoiceActivity.map(a => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-[#F4F6F5] last:border-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${a.action === 'Email' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {a.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#2F3E4E]">{a.documentType}{a.reference ? ` — ${a.reference}` : ''}</p>
                      {a.note && <p className="text-xs text-[#7A8F79]">{a.note}</p>}
                      <p className="text-[10px] text-[#7A8F79] mt-0.5">
                        {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Invoice Modal ── */}
      {showInvoiceModal && (() => {
        const dueDate = invoiceDueTerm === 'ASAP' ? null : new Date(Date.now() + Number(invoiceDueTerm) * 86400000)
        const fmtI = (d: string | Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        const FEE_LABELS: Record<string,string> = { A1: 'Medicaid — Single Payer', A2: 'Commercial — Single Payer', B: 'Dual Payer', C: '3+ Payer' }
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#D9E1E8]">
                <h3 className="text-lg font-bold text-[#2F3E4E]">Create Invoice</h3>
                <div className="flex items-center gap-1 bg-[#F4F6F5] rounded-lg p-1">
                  <button onClick={() => setShowInvoicePreview(false)} className={`px-3 py-1 rounded text-xs font-semibold transition ${!showInvoicePreview ? 'bg-white shadow text-[#2F3E4E]' : 'text-[#7A8F79]'}`}>Edit</button>
                  <button onClick={() => setShowInvoicePreview(true)}  className={`px-3 py-1 rounded text-xs font-semibold transition ${showInvoicePreview  ? 'bg-white shadow text-[#2F3E4E]' : 'text-[#7A8F79]'}`}>Preview</button>
                </div>
              </div>

              {!showInvoicePreview ? (
                /* ── Edit form ── */
                <div className="p-6 space-y-4">
                  {/* Per-entry fee plan selectors */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">
                      Fee Plan per Entry
                    </label>
                    <div className="rounded-lg border border-[#D9E1E8] overflow-hidden">
                      {pendingEntries.map((e, i) => (
                        <div
                          key={e.id}
                          className={`flex items-center gap-3 px-3 py-2 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4F6F5]'}`}
                        >
                          <span className="text-xs text-[#2F3E4E] w-28 shrink-0 whitespace-nowrap">
                            {new Date(e.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                          </span>
                          <select
                            value={e.invoiceFeePlan ?? 'A1'}
                            onChange={ev => toggleInvoiceFlag(e, true, ev.target.value)}
                            className="flex-1 border border-[#D9E1E8] rounded px-2 py-1 text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79] bg-white"
                          >
                            {FEE_PLANS.map(p => (
                              <option key={p.value} value={p.value}>
                                {p.value} — {p.label.replace(/^[A-Z\d]+ — /, '')} · ${p.amount.toFixed(2)}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs font-bold text-[#2F3E4E] w-12 text-right shrink-0">
                            ${(e.invoiceFeeAmt ?? 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-right text-xs font-bold text-[#2F3E4E] mt-1.5 pr-1">
                      Total: ${pendingTotal.toFixed(2)}
                    </p>
                  </div>

                  {/* Campaign discount preview */}
                  {(() => {
                    const manualAmt = parseFloat(manualDiscountAmt) || 0
                    const preview = invoicePreview
                    const campDiscount = preview?.discountAmt ?? 0
                    const effectiveDiscount = manualAmt > 0 ? manualAmt : campDiscount
                    const finalTotal = Math.max(0, pendingTotal - effectiveDiscount)

                    return (
                      <div className="rounded-xl border border-[#D9E1E8] overflow-hidden">
                        {/* Subtotal row */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F4F6F5]">
                          <span className="text-xs text-[#7A8F79] font-semibold uppercase tracking-wide">Subtotal</span>
                          <span className="text-sm font-bold text-[#2F3E4E]">${pendingTotal.toFixed(2)}</span>
                        </div>

                        {/* Campaign auto-discount */}
                        {campDiscount > 0 && manualAmt === 0 && (
                          <div className="flex items-center justify-between px-4 py-2 border-t border-[#D9E1E8] bg-green-50">
                            <div>
                              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Campaign Discount</span>
                              {preview?.enrollment && (
                                <p className="text-[10px] text-green-600 mt-0.5">{preview.enrollment.campaignName} · {preview.enrollment.ruleLabel}</p>
                              )}
                            </div>
                            <span className="text-sm font-bold text-green-700">−${campDiscount.toFixed(2)}</span>
                          </div>
                        )}

                        {/* Manual discount fields */}
                        <div className="border-t border-[#D9E1E8] px-4 py-3 space-y-2">
                          <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
                            Manual Discount Override
                            {campDiscount > 0 && <span className="ml-2 normal-case font-normal text-amber-600">(overrides campaign)</span>}
                          </label>
                          <div className="flex gap-2">
                            <div className="relative w-28">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={manualDiscountAmt}
                                onChange={e => setManualDiscountAmt(e.target.value)}
                                placeholder="0.00"
                                className="w-full border border-[#D9E1E8] rounded-lg pl-6 pr-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                              />
                            </div>
                            <input
                              type="text"
                              value={manualDiscountNote}
                              onChange={e => setManualDiscountNote(e.target.value)}
                              placeholder="Reason (optional)"
                              className="flex-1 border border-[#D9E1E8] rounded-lg px-3 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                            />
                          </div>
                        </div>

                        {/* Total due */}
                        <div className="flex items-center justify-between px-4 py-3 border-t-2 border-[#2F3E4E] bg-[#F4F6F5]">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Total Due</span>
                          <span className="text-xl font-black text-[#2F3E4E]">${finalTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })()}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Due Terms</label>
                    <select value={invoiceDueTerm} onChange={e => setInvoiceDueTerm(e.target.value)} className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E]">
                      <option value="30">Net 30 — due in 30 days</option>
                      <option value="60">Net 60 — due in 60 days</option>
                      <option value="90">Net 90 — due in 90 days</option>
                      <option value="ASAP">ASAP — due immediately</option>
                    </select>
                  </div>

                  {/* Late fee policy */}
                  <div className="rounded-xl border border-[#D9E1E8] overflow-hidden">
                    <div className="bg-[#F4F6F5] px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Late Fee Policy</span>
                      <select
                        value={lateFeePlan}
                        onChange={e => setLateFeePlan(e.target.value as 'none' | 'flat' | 'percent')}
                        className="text-xs border border-[#D9E1E8] rounded px-2 py-1 text-[#2F3E4E] bg-white"
                      >
                        <option value="none">None</option>
                        <option value="flat">Flat $ / month</option>
                        <option value="percent">% / month</option>
                      </select>
                    </div>
                    {lateFeePlan === 'flat' && (
                      <div className="px-4 py-3 flex items-center gap-2">
                        <span className="text-xs text-[#7A8F79]">Charge</span>
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={lateFeeAmt}
                            onChange={e => setLateFeeAmt(e.target.value)}
                            placeholder="5.00"
                            className="w-full border border-[#D9E1E8] rounded-lg pl-6 pr-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                          />
                        </div>
                        <span className="text-xs text-[#7A8F79]">per month after due date</span>
                      </div>
                    )}
                    {lateFeePlan === 'percent' && (
                      <div className="px-4 py-3 flex items-center gap-2">
                        <span className="text-xs text-[#7A8F79]">Charge</span>
                        <div className="relative w-24">
                          <input
                            type="number" min="0" step="0.1" max="100"
                            value={lateFeePercent}
                            onChange={e => setLateFeePercent(e.target.value)}
                            placeholder="1.5"
                            className="w-full border border-[#D9E1E8] rounded-lg pl-3 pr-6 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">%</span>
                        </div>
                        <span className="text-xs text-[#7A8F79]">per month after due date</span>
                      </div>
                    )}
                  </div>

                  {/* Prompt pay bonus */}
                  <div className="rounded-xl border border-[#D9E1E8] overflow-hidden">
                    <div className="bg-[#F4F6F5] px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Prompt Pay Bonus</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={promptPayEnabled}
                          onChange={e => setPromptPayEnabled(e.target.checked)}
                          className="accent-[#7A8F79] w-4 h-4"
                        />
                        <span className="text-xs text-[#2F3E4E]">{promptPayEnabled ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    </div>
                    {promptPayEnabled && (
                      <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#7A8F79]">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={promptPayCredit}
                            onChange={e => setPromptPayCredit(e.target.value)}
                            className="w-20 border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                          />
                          <span className="text-xs text-[#7A8F79]">credit if paid within</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="1" step="1"
                            value={promptPayDays}
                            onChange={e => setPromptPayDays(e.target.value)}
                            className="w-16 border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                          />
                          <span className="text-xs text-[#7A8F79]">days</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Notes (optional)</label>
                    <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} rows={3} placeholder="Any additional notes for the nurse…" className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] resize-none" />
                  </div>
                  {invoiceMessage && (
                    <p className={`text-xs font-semibold ${invoiceMessage.includes('sent') ? 'text-[#7A8F79]' : 'text-red-500'}`}>{invoiceMessage}</p>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowInvoiceModal(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f6f8] transition">Cancel</button>
                    <button onClick={createInvoice} disabled={invoiceSending} className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                      {invoiceSending ? 'Sending…' : 'Send Invoice'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Invoice preview ── */
                <div className="p-6 space-y-5 text-[#2F3E4E]">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xl font-black tracking-tight">Coming Home Care Services, LLC</p>
                      <p className="text-xs text-[#7A8F79] mt-0.5">cominghomecare.com · billing@cominghomecare.com</p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">PREVIEW</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-[#F4F6F5] rounded-xl p-4 text-sm">
                    <div>
                      <p className="text-xs text-[#7A8F79] uppercase tracking-widest font-semibold mb-0.5">Bill To</p>
                      <p className="font-semibold">{profile.displayName}</p>
                      <p className="text-[#7A8F79]">{profile.user?.email || ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#7A8F79] uppercase tracking-widest font-semibold mb-0.5">Invoice</p>
                      <p className="font-semibold text-[#7A8F79] italic">CHC-{new Date().getFullYear()}-XXXX</p>
                      <p className="text-xs text-[#7A8F79] mt-1">Issued {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-xs text-[#7A8F79]">Due {dueDate ? fmtI(dueDate.toISOString()) : 'Immediately'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-[#D9E1E8]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#f4f6f8]">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Plan</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide hidden sm:table-cell">Description</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingEntries.map((e, i) => (
                          <tr key={i} className="border-t border-[#D9E1E8]">
                            <td className="px-4 py-2.5 font-semibold">{fmtI(e.workDate)}</td>
                            <td className="px-4 py-2.5"><span className="bg-[#2F3E4E] text-white text-xs font-bold px-2 py-0.5 rounded">{e.invoiceFeePlan}</span></td>
                            <td className="px-4 py-2.5 text-[#4a5a6a] hidden sm:table-cell">{e.invoiceFeePlan ? (FEE_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan) : ''}</td>
                            <td className="px-4 py-2.5 text-right font-bold">${(e.invoiceFeeAmt ?? 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {(() => {
                          const manualAmt = parseFloat(manualDiscountAmt) || 0
                          const campDiscount = invoicePreview?.discountAmt ?? 0
                          const effectiveDiscount = manualAmt > 0 ? manualAmt : campDiscount
                          const finalTotal = Math.max(0, pendingTotal - effectiveDiscount)
                          const discountLabel = manualAmt > 0
                            ? (manualDiscountNote || 'Manual discount')
                            : invoicePreview?.enrollment?.campaignName
                          return effectiveDiscount > 0 ? (<>
                            <tr className="border-t border-[#D9E1E8]">
                              <td colSpan={3} className="px-4 py-2 text-xs text-[#7A8F79]">Subtotal</td>
                              <td className="px-4 py-2 text-right text-sm font-semibold text-[#7A8F79]">${pendingTotal.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="px-4 py-2 text-xs text-green-700 font-semibold">Discount — {discountLabel}</td>
                              <td className="px-4 py-2 text-right text-sm font-bold text-green-700">−${effectiveDiscount.toFixed(2)}</td>
                            </tr>
                            <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                              <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Total Due</td>
                              <td className="px-4 py-3 text-right text-xl font-black">${finalTotal.toFixed(2)}</td>
                            </tr>
                          </>) : (
                            <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                              <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Total Due</td>
                              <td className="px-4 py-3 text-right text-xl font-black">${pendingTotal.toFixed(2)}</td>
                            </tr>
                          )
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  {invoiceNotes && (
                    <div className="bg-[#f4f6f8] border-l-4 border-[#7A8F79] rounded-r-lg px-4 py-3">
                      <p className="text-xs text-[#4a5a6a]"><strong>Note:</strong> {invoiceNotes}</p>
                    </div>
                  )}

                  <div className="bg-[#f4f6f8] rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Payment Methods</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: '💚 Venmo', value: '@AlexMcGann' },
                        { label: '💚 Zelle', value: 'billing@cominghomecare.com' },
                        { label: '💚 CashApp', value: '$myInvoiceCHC' },
                        { label: '🍎 Apple Pay', value: 'billing@cominghomecare.com' },
                      ].map(m => (
                        <div key={m.label} className="bg-white rounded-lg px-3 py-2 border border-[#D9E1E8]">
                          <p className="text-xs font-bold">{m.label}</p>
                          <p className="text-xs text-[#7A8F79] mt-0.5">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowInvoiceModal(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f6f8] transition">Cancel</button>
                    <button onClick={createInvoice} disabled={invoiceSending} className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                      {invoiceSending ? 'Sending…' : 'Send Invoice'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

    </div>
  )
}
