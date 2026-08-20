'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RotatingQuote from '../components/RotatingQuote'
import WhatsNewCard from '../components/WhatsNewCard'
import { CARE_QUOTES } from '../../lib/careQuotes'
import { calculateAge } from '../../lib/patientAge'
import { medicationReminderDate } from '../../lib/medicationReminders'

type FamilyMedication = {
  id: string
  medicationName: string
  lastFillDate: string
  daySupply: number
  refillsRemaining: number | null
  active: boolean
}

type FamilyPatient = {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  dob: string
  address: string | null
  insuranceType: string
  insuranceId: string
  insuranceName: string | null
  paEndDate: string | null
  medications: FamilyMedication[]
}

// How far ahead of a due date the renewal indicator lights up.
const URGENCY_WINDOW_DAYS = 14

// Everything a guardian would need to act on soon — refills and PA renewals —
// collapsed into a single "is anything coming due" signal for the dashboard card.
function urgentReasons(p: FamilyPatient, today: Date): string[] {
  const horizon = today.getTime() + URGENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const reasons: string[] = []

  for (const m of p.medications) {
    if (!m.active) continue
    const reminderDate = medicationReminderDate(new Date(m.lastFillDate), m.daySupply, m.refillsRemaining)
    if (reminderDate.getTime() <= horizon) reasons.push(`${m.medicationName} refill due`)
  }

  if (p.paEndDate && new Date(p.paEndDate).getTime() <= horizon) {
    reasons.push('Prior authorization renewal due')
  }

  return reasons
}

type ReminderRow = {
  medId: string
  medicationName: string
  reminderDate: Date
  patient: FamilyPatient
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function PatientCard({ p }: { p: FamilyPatient }) {
  const age = calculateAge(p.dob)
  const reasons = urgentReasons(p, new Date())

  return (
    <Link
      href={`/family/patients/${p.id}`}
      className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-[#7A8F79] transition"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_auto] gap-2 sm:gap-4 sm:items-start">

        {/* Name / age / account number */}
        <div>
          <p className="font-bold text-base text-[#2F3E4E] whitespace-nowrap">
            {p.firstName} {p.lastName[0]}.
            {age != null && <span className="ml-2 text-sm font-normal text-[#7A8F79]">Age {age}</span>}
          </p>
          <p className="text-xs text-[#7A8F79] font-mono mt-0.5">{p.accountNumber}</p>
        </div>

        {/* Member ID / insurance */}
        <div>
          <p className="text-sm text-[#2F3E4E] font-semibold">{p.insuranceId}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${p.insuranceType === 'Medicaid' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
              {p.insuranceType}
            </span>
            {p.insuranceName && <span className="text-xs text-[#7A8F79]">{p.insuranceName}</span>}
          </div>
        </div>

        {/* Renewal urgency — only ever shows when something is coming due */}
        <div className="flex sm:justify-end">
          {reasons.length > 0 && (
            <span
              title={reasons.join(' · ')}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 uppercase tracking-wide whitespace-nowrap"
            >
              ⚠ {reasons.length} Due
            </span>
          )}
        </div>

      </div>
    </Link>
  )
}

function ReminderLine({ r }: { r: ReminderRow }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-t border-[#D9E1E8] first:border-0">
      <span className="text-[#2F3E4E]">{r.medicationName}</span>
      <span className="text-xs text-[#7A8F79]">{fmtDate(r.reminderDate)}</span>
    </div>
  )
}

function PatientReminderGroup({ patient, reminders }: { patient: FamilyPatient; reminders: ReminderRow[] }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-[#D9E1E8] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#F4F6F5] text-left"
      >
        <span className="text-sm font-semibold text-[#2F3E4E]">
          {patient.accountNumber} {patient.firstName} {patient.lastName[0]}.
        </span>
        <span className="text-sm font-bold text-[#7A8F79]">{reminders.length}</span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          {reminders.map(r => <ReminderLine key={r.medId} r={r} />)}
        </div>
      )}
    </div>
  )
}

export default function FamilyDashboardPage() {
  const [patients, setPatients] = useState<FamilyPatient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/family/medications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setPatients(data.patients || [])
        setLoading(false)
      })
  }, [])

  const reminders: ReminderRow[] = patients
    .flatMap(p => p.medications
      .filter(m => m.active)
      .map(m => ({
        medId: m.id,
        medicationName: m.medicationName,
        reminderDate: medicationReminderDate(new Date(m.lastFillDate), m.daySupply, m.refillsRemaining),
        patient: p,
      })))
    .sort((a, b) => a.reminderDate.getTime() - b.reminderDate.getTime())

  const remindersByPatient = new Map<string, ReminderRow[]>()
  for (const r of reminders) {
    const list = remindersByPatient.get(r.patient.id) || []
    list.push(r)
    remindersByPatient.set(r.patient.id, list)
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
              <span className="text-[#7A8F79] italic">my</span>Dashboard
            </h1>
            <p className="text-sm text-[#7A8F79]">Your linked patients and upcoming reminders.</p>
          </div>
          <RotatingQuote quotes={CARE_QUOTES} variant="header" className="flex-1 max-w-md hidden sm:flex" />
        </div>

        <WhatsNewCard roleKey="guardian" />

        {loading ? (
          <p className="text-sm text-[#7A8F79] text-center py-12">Loading…</p>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-[#2F3E4E] font-semibold">No linked patients yet</p>
            <p className="text-[#7A8F79] text-sm mt-1">Contact the care team if this doesn&apos;t look right.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Column 1 — Active Patients */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Active Patients</p>
              <div className="space-y-3">
                {patients.map(p => <PatientCard key={p.id} p={p} />)}
              </div>
            </div>

            {/* Column 2 — Upcoming Reminders */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Upcoming Reminders</p>
              {reminders.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-sm text-[#7A8F79] italic">No upcoming reminders.</p>
                </div>
              ) : patients.length === 1 ? (
                <div className="bg-white rounded-xl shadow-sm p-4">
                  {reminders.map(r => <ReminderLine key={r.medId} r={r} />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {patients
                    .filter(p => remindersByPatient.has(p.id))
                    .map(p => (
                      <PatientReminderGroup key={p.id} patient={p} reminders={remindersByPatient.get(p.id)!} />
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
