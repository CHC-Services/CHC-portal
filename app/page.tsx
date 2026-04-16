import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
// import HomeDefinition from './components/HomeDefinition'

async function getFaqs() {
  try {
    return await (prisma.faqItem as any).findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  } catch {
    return []
  }
}

async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  return verifyToken(token)
}

async function getNurseStats(nurseProfileId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  try {
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

    // Query reminders separately — table may not exist yet if migration is pending
    let upcomingReminders: { id: string; title: string; dueDate: Date; category: string }[] = []
    try {
      upcomingReminders = await (prisma.nurseReminder as any).findMany({
        where: { nurseId: nurseProfileId, completed: false, dueDate: { gte: now } },
        orderBy: { dueDate: 'asc' },
        take: 3,
      })
    } catch {
      // NurseReminder table not yet migrated — silently skip
    }

    return {
      hoursThisMonth: (monthData._sum.hours ?? 0) as number,
      submissionsThisMonth: (monthData._count ?? 0) as number,
      totalHours: (allData._sum.hours ?? 0) as number,
      upcomingReminders,
    }
  } catch {
    return { hoursThisMonth: 0, submissionsThisMonth: 0, totalHours: 0, upcomingReminders: [] }
  }
}

const QUOTES = [
  { text: "Every hour you log is a step toward the care that matters most.", author: "Coming Home Care" },
  { text: "Small consistent actions create extraordinary outcomes.", author: "Coming Home Care" },
  { text: "Your work changes lives. We're here to handle the rest.", author: "Coming Home Care" },
  { text: "Compliance today means freedom tomorrow.", author: "Coming Home Care" },
  { text: "The best caregivers take care of their paperwork too.", author: "Coming Home Care" },
]

function getQuote() {
  const day = new Date().getDay()
  return QUOTES[day % QUOTES.length]
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

function FeatureCard({
  href,
  icon,
  title,
  description,
  accent = false,
}: {
  href: string
  icon: string
  title: string
  description: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-xl shadow-sm p-5 border-t-4 transition hover:shadow-md hover:-translate-y-0.5 ${
        accent ? 'bg-[#2F3E4E] border-[#7A8F79] text-white' : 'bg-white border-[#7A8F79] text-[#2F3E4E]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl leading-none">{icon}</span>
        <p className={`text-base font-bold ${accent ? 'text-white' : 'text-[#2F3E4E]'}`}>{title}</p>
      </div>
      <p className={`text-sm ${accent ? 'text-[#D9E1E8]' : 'text-[#7A8F79]'}`}>{description}</p>
    </Link>
  )
}

function ReminderPill({ title, dueDate, category }: { title: string; dueDate: Date; category: string }) {
  const due = new Date(dueDate)
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const urgent = daysLeft <= 14
  return (
    <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${urgent ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-[#D9E1E8]'}`}>
      <span className="text-lg">{category === 'license' ? '📄' : category === 'medicaid' ? '🏥' : category === 'bcbs' ? '💳' : '📅'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2F3E4E] truncate">{title}</p>
        <p className={`text-xs ${urgent ? 'text-amber-600 font-semibold' : 'text-[#7A8F79]'}`}>
          {urgent ? `${daysLeft} days left` : due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

export default async function Home() {
  const user = await getUser()
  const monthName = new Date().toLocaleString('en-US', { month: 'long' })
  const quote = getQuote()

  let nurseStats = null
  if (user?.role === 'nurse' && user.nurseProfileId) {
    nurseStats = await getNurseStats(user.nurseProfileId)
  }

  const faqs: { id: string; question: string; answer: string; category: string; subcategory: string }[] = await getFaqs()

  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* ── Hero ── */}
      <div className="bg-[#2F3E4E] px-6 md:px-10 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {user ? (
            <>
              {/* <HomeDefinition /> */}
              <p className="text-[#7A8F79] text-xs font-semibold uppercase tracking-widest mb-2">
                {user.role === 'nurse' ? 'Nurse Portal' : user.role === 'admin' ? 'Admin Portal' : 'Provider Portal'}
              </p>
              <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                Welcome back,{' '}
                <span className="italic text-[#7A8F79]">{user.displayName ?? user.name}</span>
              </h1>
              <p className="mt-4 text-[#D9E1E8] text-sm max-w-xl">
                {user.role === 'nurse'
                  ? 'Everything you need to stay compliant, get paid, and focus on what matters — caring for your patients.'
                  : 'Your team is counting on you. Manage the roster, review submissions, and keep the operation running smoothly.'}
              </p>
            </>
          ) : (
            <>
              {/* <HomeDefinition /> */}
              <p className="text-[#7A8F79] text-xs font-semibold uppercase tracking-widest mb-2">
                Provider &amp; Admin Portal
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Your practice,{' '}
                <span className="italic text-[#7A8F79]">streamlined.</span>
              </h1>
              <p className="mt-4 text-[#D9E1E8] text-sm max-w-xl">
                Coming Home Care's secure portal puts time tracking, claims management, billing enrollment, and yearly renewal reminders all in one place — so you can focus on your patients.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="px-6 md:px-10 py-10 space-y-12 max-w-5xl mx-auto">

        {/* ── Nurse: stats ── */}
        {user?.role === 'nurse' && nurseStats && (
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">Your Activity</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard
                value={`${nurseStats.hoursThisMonth % 1 === 0 ? nurseStats.hoursThisMonth : nurseStats.hoursThisMonth.toFixed(1)} hrs`}
                label={`Hours in ${monthName}`}
                sub="Submitted this month"
              />
              <StatCard
                value={String(nurseStats.submissionsThisMonth)}
                label={`Entries in ${monthName}`}
                sub="Time entries logged"
              />
              <StatCard
                value={`${nurseStats.totalHours % 1 === 0 ? nurseStats.totalHours : nurseStats.totalHours.toFixed(1)} hrs`}
                label="Total Hours"
                sub="All time"
              />
            </div>
          </div>
        )}

        {/* ── Nurse: upcoming reminders ── */}
        {user?.role === 'nurse' && nurseStats && nurseStats.upcomingReminders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Upcoming Renewals</p>
              <Link href="/nurse/profile" className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] underline">Manage reminders →</Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {nurseStats.upcomingReminders.map(r => (
                <ReminderPill key={r.id} title={r.title} dueDate={r.dueDate} category={r.category} />
              ))}
            </div>
          </div>
        )}

        {/* ── Nurse: quick links ── */}
        {user?.role === 'nurse' && (
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">Quick Access</p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <FeatureCard href="/nurse"          icon="⏱"  title="Log Hours"         description="Submit your daily hours and view your full time history." accent />
              <FeatureCard href="/nurse/claims"   icon="📋"  title="My Claims"         description="Track your BCBS claim statuses and payment details." />
              <FeatureCard href="/nurse/profile"  icon="👤"  title="My Profile"        description="Keep your contact info, billing details, and renewals up to date." />
              <FeatureCard href="/resources"      icon="📚"  title="Provider Resources" description="Step-by-step NY enrollment guides for NPI, Medicaid, and BCBS." />
            </div>
          </div>
        )}

        {/* ── Admin: quick links ── */}
        {user?.role === 'admin' && (
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">Quick Access</p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <FeatureCard href="/admin"     icon="🗂"  title="Admin Area"   description="View providers, add/delete accounts, enter hours, manage profiles, and more." accent />
              <FeatureCard href="/admin/claims"   icon="🧾"  title="Claims" description="Track & update claim, upload EOBs, assign Claim IDs to invoice." />
              <FeatureCard href="/admin/invoices"  icon="💵"  title="Invoices" description="Create, send, track, and cashout invoices to apply to sites income ledger." />
              <FeatureCard href="/admin/faq" icon="❓"  title="FAQ Add/Edit"    description="Add and Edit site FAQ topics." />
              <FeatureCard href="/admin/ideas" icon="🧠"  title="Idea Board" description="Place to store all reminders & ideas about site improvements." />
              <FeatureCard href="/resources" icon="📚"  title="Provider Resources" description="NY enrollment guides to share with your providers." />
            </div>
          </div>
        )}

        {/* ── Logged-out: what the portal does ── */}
        {!user && (
          <>
            <div>
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">Everything in One Place</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <FeatureCard href="/login" icon="⏱"  title="Time Tracking"       description="Log hours by date in seconds. Your full history is always accessible." />
                <FeatureCard href="/login" icon="📋"  title="Claims Management"   description="Real-time BCBS claim status, payment breakdowns, and EOB tracking." />
                <FeatureCard href="/login" icon="💳"  title="Billing Enrollment"  description="Enroll in billing services and manage your provider payment plan." />
                <FeatureCard href="/login" icon="📅"  title="Renewal Reminders"   description="Never miss a license, Medicaid, or BCBS renewal with built-in calendar reminders." />
                <FeatureCard href="/resources" icon="📚"  title="NY Provider Guides" description="Deconstructed step-by-step guides for NPI, Medicaid, and BCBS enrollment." />
                <FeatureCard href="/login" icon="🔒"  title="Secure &amp; Private"    description="Sensitive data encrypted at rest. HIPAA-conscious from the ground up." />
              </div>
            </div>

            {/* Quote for logged-out visitors */}
            <div className="bg-[#2F3E4E] rounded-xl p-8 text-center">
              <p className="text-[#D9E1E8] text-lg italic max-w-xl mx-auto">&ldquo;{quote.text}&rdquo;</p>
              <p className="text-[#7A8F79] text-xs mt-3 uppercase tracking-widest">{quote.author}</p>
              <Link
                href="/login"
                className="mt-6 inline-block bg-[#7A8F79] text-white font-semibold px-7 py-3 rounded-lg hover:bg-[#657a64] transition text-sm"
              >
                Access Your Portal →
              </Link>
            </div>
          </>
        )}

        {/* ── Motivational footer strip (all logged-in users) ── */}
        {user && (
          <div className="bg-[#2F3E4E] rounded-xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[#D9E1E8] text-sm italic max-w-lg">&ldquo;{quote.text}&rdquo;</p>
            <Link href="/resources" className="shrink-0 text-xs font-semibold text-[#7A8F79] hover:text-white transition uppercase tracking-widest">
              Provider Resources →
            </Link>
          </div>
        )}

        {/* ── FAQ ── */}
        {faqs.length > 0 && (() => {
          // Group by category → subcategory, preserving sortOrder
          const catOrder: string[] = []
          const catMap = new Map<string, { subOrder: string[]; subMap: Map<string, typeof faqs> }>()
          for (const faq of faqs) {
            if (!catMap.has(faq.category)) {
              catMap.set(faq.category, { subOrder: [], subMap: new Map() })
              catOrder.push(faq.category)
            }
            const entry = catMap.get(faq.category)!
            const subKey = faq.subcategory || ''
            if (!entry.subMap.has(subKey)) {
              entry.subMap.set(subKey, [])
              entry.subOrder.push(subKey)
            }
            entry.subMap.get(subKey)!.push(faq)
          }
          return (
            <div>
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-4">Frequently Asked Questions</p>
              <div className="space-y-6">
                {catOrder.map(cat => {
                  const entry = catMap.get(cat)!
                  return (
                    <div key={cat}>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">{cat}</p>
                      <div className="space-y-4">
                        {entry.subOrder.map(sub => (
                          <div key={sub || '__root__'}>
                            {sub && (
                              <p className="text-xs font-semibold text-[#7A8F79] italic mb-1.5 pl-1">{sub}</p>
                            )}
                            <div className="space-y-2">
                              {entry.subMap.get(sub)!.map(faq => (
                                <details key={faq.id} className="group bg-white rounded-xl shadow-sm border border-[#D9E1E8] overflow-hidden">
                                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none font-semibold text-sm text-[#2F3E4E] hover:bg-[#F4F6F5] transition">
                                    {faq.question}
                                    <span className="text-[#7A8F79] text-lg ml-4 shrink-0 group-open:rotate-45 transition-transform">+</span>
                                  </summary>
                                  <div
                                    className="px-5 pb-5 pt-2 text-sm text-[#2F3E4E] border-t border-[#D9E1E8] prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: faq.answer }}
                                  />
                                </details>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
