import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserFromCookie } from '@/lib/getUserFromCookie'
import { canAccessPatient } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import NurseSideNav from '../../components/NurseSideNav'
import FamilySideNav from '../../components/FamilySideNav'

// Shared role-agnostic shell for /patient/[id]/schedule|appointment|calendar —
// one URL family every authorized role (nurse/guardian/admin) navigates into
// from their own "myCalendar" or patient-detail page, modeled on
// app/care/layout.tsx's "one URL, role-aware side nav" precedent. Authorization
// is the same isLinkedToPatient check every other patient-scoped route already
// uses (aliased here as canAccessPatient) — unauthorized or unknown patient
// IDs both 404 rather than leaking which is which.
export default async function PatientLayout({
  children, params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const authorized = await canAccessPatient(user, id)
  if (!authorized) notFound()

  const patient = await (prisma.patient.findUnique as any)({
    where: { id },
    select: { firstName: true, lastName: true, accountNumber: true },
  })
  if (!patient) notFound()

  const backHref = user.role === 'guardian' ? `/family/patients/${id}`
    : user.role === 'admin' ? `/admin/patients/${id}`
    : `/nurse/patients/${id}`

  return (
    <div
      className="flex gap-4 items-start min-h-screen"
      style={{ background: 'linear-gradient(160deg, #dce8dc 0%, #e6ecee 55%, #d2dde5 100%)' }}
    >
      {user.role === 'guardian' ? <FamilySideNav /> : (user.role === 'nurse' || user.role === 'provider') ? <NurseSideNav /> : null}
      <div className="flex-1 min-w-0 p-4 md:p-6 pl-0 md:pl-0">
        <div className="max-w-5xl">
          <Link href={backHref} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            ← Back to Patient
          </Link>
          <h1 className="text-2xl font-bold text-[#2F3E4E] uppercase mt-2 mb-0.5">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-5">
            Account # {patient.accountNumber}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
