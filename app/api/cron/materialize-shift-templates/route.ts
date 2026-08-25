import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { materializeShiftTemplate, materializationHorizon } from '../../../../lib/shiftTemplates'

// Keeps every active ShiftTemplate's rolling MATERIALIZATION_HORIZON_DAYS
// window topped up daily, even when nobody edits the template (the inline
// materialize call in the shift-templates routes only fires on create/edit).
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const templates = await ((prisma as any).shiftTemplate.findMany)({ where: { isActive: true } })
  const horizon = materializationHorizon()

  let created = 0
  for (const template of templates) {
    created += await materializeShiftTemplate(template, horizon)
  }

  return NextResponse.json({ ok: true, templates: templates.length, created })
}
