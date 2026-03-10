import React from 'react'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  return verifyToken(token)
}

async function getNurseStats(nurseProfileId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [monthData, allData] = await Promise.all([
    (prisma.timeEntry as any).aggregate({
      where: { nurseId: nurseProfileId, workDate: { gte: startOfMonth } },
      _sum: { hours: true },
      _count: true,
    }),
    (prisma.timeEntry as any).aggregate({
      where: { nurseId: nurseProfileId },
      _sum: { hours: true },
    }),
  ])

  return {
    hoursThisMonth: (monthData._sum.hours ?? 0) as number,
    submissionsThisMonth: (monthData._count ?? 0) as number,
    totalHours: (allData._sum.hours ?? 0) as number,
  }
}

function MyLabel({ word, accent }: { word: string; accent?: boolean }) {
  return (
    <>
      <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>
      <span style={{ color: accent ? 'white' : '#2F3E4E' }}>{word}</span>
    </>
  )
}

function QuickCard({
  href,
  icon,
  title,
  description,
  accent = false,
}: {
  href: string
  icon: React.ReactNode
  title: React.ReactNode
  description: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-xl shadow-sm p-5 border-t-4 transition hover:shadow-md hover:-translate-y-0.5 ${
        accent
          ? 'bg-[#2F3E4E] border-[#7A8F79] text-white'
          : 'bg-white border-[#7A8F79] text-[#2F3E4E]'
      }`}
    >
      <div className={`text-2xl mb-2`}>{icon}</div>
      <p className={`text-base font-bold mb-1 ${accent ? 'text-white' : 'text-[#2F3E4E]'}`}>
        {title}
      </p>
      <p className={`text-sm ${accent ? 'text-[#D9E1E8]' : 'text-[#7A8F79]'}`}>{description}</p>
    </Link>
  )
}

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border-b-4 border-[#7A8F79]">
      <p className="text-3xl font-bold text-[#2F3E4E]">{value}</p>
      <p className="text-sm font-semibold text-[#2F3E4E] mt-1">{label}</p>
      {sub && <p className="text-xs text-[#7A8F79] mt-0.5">{sub}</p>}
    </div>
  )
}

function FeatureTile({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border-t-4 border-[#7A8F79]">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="text-base font-bold text-[#2F3E4E] mb-1">{title}</p>
      <p className="text-sm text-[#7A8F79]">{description}</p>
    </div>
  )
}

export default async function Home() {
  const user = await getUser()

  const monthName = new Date().toLocaleString('en-US', { month: 'long' })

  let nurseStats = null
  if (user?.role === 'nurse' && user.nurseProfileId) {
    nurseStats = await getNurseStats(user.nurseProfileId)
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* ── Hero banner ── */}
      <div className="bg-[#2F3E4E] px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-3xl">
          {user ? (
            <>
              <p className="text-[#7A8F79] text-sm font-semibold uppercase tracking-widest mb-2">
                {user.role === 'nurse' ? 'Nurse Portal' : 'Admin Portal'}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                Welcome back,{' '}
                <span className="italic text-[#7A8F79]">{user.displayName ?? user.name}</span>
              </h1>
              <p className="mt-2 text-[#D9E1E8] text-sm">
                {user.role === 'nurse'
                  ? "Here's a snapshot of your account. Use the links below to manage your time and profile."
                  : 'Manage your team, review submissions, and keep everything running smoothly.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-[#7A8F79] text-sm font-semibold uppercase tracking-widest mb-2">
                Nurse &amp; Admin Portal
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                Welcome to{' '}
                <span className="italic">Coming Home</span>
                <span className="text-[#7A8F79]">care</span>
              </h1>
              <p className="mt-3 text-[#D9E1E8] text-sm max-w-xl">
                Your secure portal for time tracking, claim management, and billing enrollment — all
                in one place.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block bg-[#7A8F79] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#657a64] transition text-sm"
              >
                Sign In to Your Portal →
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 space-y-10">

        {/* ── Nurse stats ── */}
        {user?.role === 'nurse' && nurseStats && (
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">
              Your Activity
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
              <StatCard
                value={`${nurseStats.hoursThisMonth % 1 === 0 ? nurseStats.hoursThisMonth : nurseStats.hoursThisMonth.toFixed(1)} hrs`}
                label={`Hours in ${monthName}`}
                sub="Hours submitted this month"
              />
              <StatCard
                value={String(nurseStats.submissionsThisMonth)}
                label={`Entries in ${monthName}`}
                sub="Time entries logged this month"
              />
              <StatCard
                value={`${nurseStats.totalHours % 1 === 0 ? nurseStats.totalHours : nurseStats.totalHours.toFixed(1)} hrs`}
                label="Total Hours Logged"
                sub="All time, all submissions"
              />
            </div>
          </div>
        )}

        {/* ── Nurse quick links ── */}
        {user?.role === 'nurse' && (
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">
              Quick Access
            </p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
              <QuickCard
                href="/nurse"
                icon="⏱"
                title={<MyLabel word="Dashboard" accent />}
                description="Submit hours and view your history."
                accent
              />
              <QuickCard
                href="/nurse/claims"
                icon="📋"
                title={<MyLabel word="Claims" />}
                description="View the status of your submitted claims."
              />
              <QuickCard
                href="/nurse/profile"
                icon="👤"
                title={<MyLabel word="Profile" />}
                description="Update your contact and billing info."
              />
            </div>
          </div>
        )}

        {/* ── Admin quick links ── */}
        {user?.role === 'admin' && (
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">
              Quick Access
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
              <QuickCard
                href="/admin"
                icon="🗂"
                title="Admin Dashboard"
                description="View nurse roster, hours, and add new nurses."
                accent
              />
            </div>
          </div>
        )}

        {/* ── Logged-out feature highlights ── */}
        {!user && (
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">
              What You Can Do
            </p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
              <FeatureTile
                icon="⏱"
                title="Track Your Time"
                description="Log work dates and hours with ease. Your history is always just a click away."
              />
              <FeatureTile
                icon="📋"
                title="Monitor Claims"
                description="Check the status of your BCBS claims and see payment details as they update."
              />
              <FeatureTile
                icon="💳"
                title="Manage Billing"
                description="Enroll in billing services, review your plan, and keep your profile up to date."
              />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
