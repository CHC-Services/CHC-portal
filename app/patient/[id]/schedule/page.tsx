import Link from 'next/link'
import { getUserFromCookie } from '@/lib/getUserFromCookie'
import { canCreateShift } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import PatientSchedule from '../../../components/patient/PatientSchedule'
import PatientShiftTemplates from '../../../components/patient/PatientShiftTemplates'

// Shift scheduling/editing for one patient — reached from that patient's
// myCalendar entry or their role's patient-detail page. Authorization to
// even land here is already enforced by the parent layout (canAccessPatient);
// canCreateShift narrows further to whether this session can actually
// create/reassign/cancel shifts (admin/guardian) vs. just view them (nurse —
// use myCalendar's Claim/Release for their own shift actions instead).
export default async function PatientSchedulePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id: patientId } = await params
  const { from } = await searchParams
  const user = (await getUserFromCookie())!

  const canManage = await canCreateShift(user, patientId)

  const links = await (prisma.nursePatient.findMany as any)({
    where: { patientId, isActive: true },
    select: { nurse: { select: { id: true, displayName: true, firstName: true, lastName: true } } },
  })
  const availableNurses = links.map((l: any) => l.nurse)

  return (
    <div>
      {from && (
        <Link href={decodeURIComponent(from)} className="inline-block text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition mb-3">
          ← Back to Calendar
        </Link>
      )}
      <p className="text-sm text-[#7A8F79] mb-4">
        {canManage
          ? 'Create and manage this patient’s shifts.'
          : 'This patient’s shift schedule. Use your myCalendar to claim or release your own shifts.'}
      </p>
      <div className="space-y-6">
        <PatientShiftTemplates patientId={patientId} availableNurses={availableNurses} canManage={canManage} />
        <PatientSchedule
          patientId={patientId}
          basePath={`/api/patient/${patientId}`}
          availableNurses={availableNurses}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
