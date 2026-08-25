import { prisma } from './prisma'

// Rolling window a template stays materialized into real Shift rows —
// "roughly a month visible/claimable ahead," refreshed daily by the
// materialize-shift-templates cron so day 31 doesn't fall off a cliff.
export const MATERIALIZATION_HORIZON_DAYS = 30

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function materializationHorizon(): Date {
  return addDays(startOfDay(new Date()), MATERIALIZATION_HORIZON_DAYS)
}

export type MaterializableTemplate = {
  id: string
  patientId: string
  nurseId: string | null
  startTimeOfDay: string
  durationHours: number
  recurrence: string
  daysOfWeek: number[]
  activeFrom: Date
  activeUntil: Date | null
  notes: string | null
  createdByUserId: string
  createdByRole: string
}

// Expands one ShiftTemplate into real Shift rows out to `horizonEnd`,
// idempotently — skips any date that already has a generated Shift for this
// template, so it's safe to call repeatedly (inline on create/edit, and
// daily from the cron). Never touches shifts outside its own templateId, and
// never deletes/cancels anything — shrinking a template's date range doesn't
// retroactively cancel already-generated future shifts (that's a deliberate
// choice: only explicit template deletion does that, see the DELETE route).
export async function materializeShiftTemplate(template: MaterializableTemplate, horizonEnd: Date): Promise<number> {
  const today = startOfDay(new Date())
  const rangeStart = template.activeFrom > today ? startOfDay(template.activeFrom) : today
  const cappedEnd = template.activeUntil && template.activeUntil < horizonEnd ? template.activeUntil : horizonEnd
  const rangeEnd = startOfDay(cappedEnd)
  if (rangeStart > rangeEnd) return 0

  const [hh, mm] = template.startTimeOfDay.split(':').map(Number)

  let created = 0
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
    const matches = template.recurrence === 'daily'
      || (template.recurrence === 'weekly' && template.daysOfWeek.includes(d.getDay()))
    if (!matches) continue

    const startTime = new Date(d)
    startTime.setHours(hh, mm, 0, 0)
    const endTime = new Date(startTime.getTime() + template.durationHours * 60 * 60 * 1000)

    const existing = await (prisma.shift.findFirst as any)({ where: { templateId: template.id, startTime } })
    if (existing) continue

    await (prisma.shift.create as any)({
      data: {
        id: crypto.randomUUID(),
        patientId: template.patientId,
        nurseId: template.nurseId,
        templateId: template.id,
        startTime,
        endTime,
        status: template.nurseId ? 'assigned' : 'open',
        notes: template.notes,
        createdByUserId: template.createdByUserId,
        createdByRole: template.createdByRole,
      },
    })
    created++
  }
  return created
}
