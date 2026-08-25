import Link from 'next/link'
import { getUserFromCookie } from '@/lib/getUserFromCookie'
import { canCreateAppointment } from '@/lib/permissions'
import PatientSchedule from '../../../components/patient/PatientSchedule'

// Appointment scheduling/editing for one patient. Unlike shifts, every
// linked role (nurse included) has equal create/edit/cancel authority here —
// see canCreateAppointment in lib/permissions.ts.
export default async function PatientAppointmentPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id: patientId } = await params
  const { from } = await searchParams
  const user = (await getUserFromCookie())!

  const canManage = await canCreateAppointment(user, patientId)

  return (
    <div>
      {from && (
        <Link href={decodeURIComponent(from)} className="inline-block text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition mb-3">
          ← Back to Calendar
        </Link>
      )}
      <p className="text-sm text-[#7A8F79] mb-4">Create and manage this patient’s appointments.</p>
      <PatientSchedule
        patientId={patientId}
        basePath={`/api/patient/${patientId}`}
        availableNurses={[]}
        section="appointments"
        canManage={canManage}
      />
    </div>
  )
}
