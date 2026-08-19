'use client'

import { ProgressNoteDTO } from './ProgressNoteForm'

const th = 'px-1.5 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] whitespace-nowrap'
const td = 'px-1.5 py-1 text-xs text-[#2F3E4E] whitespace-nowrap'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Read-only renderer — same layout as ProgressNoteForm, no inputs. Used by
// admin's view page, family's view page, and the nurse's own view of an
// already-signed note.
export default function ProgressNoteView({
  note, signatureUrl, voidAction, addendumAction,
}: {
  note: ProgressNoteDTO
  signatureUrl?: string | null
  voidAction?: React.ReactNode
  addendumAction?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      {note.voidedAt && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-bold text-red-700">Voided</p>
          <p className="text-xs text-red-600 mt-0.5">
            Voided {fmtDateTime(note.voidedAt)}{note.voidReason ? ` — ${note.voidReason}` : ''}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Shift Details</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Service Date</p>
            <p className="text-sm text-[#2F3E4E]">{fmtDate(note.serviceDate)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Shift Start</p>
            <p className="text-sm text-[#2F3E4E]">{note.shiftStartTime || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Shift End</p>
            <p className="text-sm text-[#2F3E4E]">{note.shiftEndTime || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Total Hours</p>
            <p className="text-sm text-[#2F3E4E]">{note.totalHours ?? '—'}</p>
          </div>
        </div>
        {note.authorDisplayName && (
          <p className="text-xs text-[#7A8F79]">Authored by {note.authorDisplayName}{note.authorRole === 'admin' ? ' (admin)' : ''}</p>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Vitals</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#D9E1E8]">
                <th className={th}>Time</th>
                <th className={th}>Temp</th>
                <th className={th}>HR</th>
                <th className={th}>RR</th>
                <th className={th}>Skin</th>
                <th className={th}>O2 Flow</th>
                <th className={th}>O2 Route</th>
                <th className={th}>O2 %</th>
                <th className={th}>Lung Sounds</th>
                <th className={th}>Tx Needed</th>
                <th className={th}>Suction</th>
              </tr>
            </thead>
            <tbody>
              {note.vitals.map((v, i) => (
                <tr key={i} className="border-b border-[#F4F6F5]">
                  <td className={td}>{v.time || '—'}</td>
                  <td className={td}>{v.temp || '—'}</td>
                  <td className={td}>{v.hr || '—'}</td>
                  <td className={td}>{v.rr || '—'}</td>
                  <td className={td}>{v.skin || '—'}</td>
                  <td className={td}>{v.o2Flow || '—'}</td>
                  <td className={td}>{v.o2Route || '—'}</td>
                  <td className={td}>{v.o2Percent || '—'}</td>
                  <td className={td}>{v.lungSounds || '—'}</td>
                  <td className={td}>{v.txNeeded || '—'}</td>
                  <td className={td}>{v.suction || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Intake / Output</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#D9E1E8]">
                <th className={th}>Time</th>
                <th className={th}>Intake Type</th>
                <th className={th}>Intake Amt</th>
                <th className={th}>Intake Route</th>
                <th className={th}>Output Urine</th>
                <th className={th}>Output BM</th>
                <th className={th}>Output Emesis</th>
              </tr>
            </thead>
            <tbody>
              {note.intakeOutput.map((r, i) => (
                <tr key={i} className="border-b border-[#F4F6F5]">
                  <td className={td}>{r.time || '—'}</td>
                  <td className={td}>{r.intakeType || '—'}</td>
                  <td className={td}>{r.intakeAmt || '—'}</td>
                  <td className={td}>{r.intakeRoute || '—'}</td>
                  <td className={td}>{r.outputUrine || '—'}</td>
                  <td className={td}>{r.outputBM || '—'}</td>
                  <td className={td}>{r.outputEmesis || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Arrival Findings</p>
          <p className="text-sm text-[#2F3E4E] whitespace-pre-wrap">{note.arrivalFindings || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Shift Notes</p>
          <p className="text-sm text-[#2F3E4E] whitespace-pre-wrap">{note.shiftNotes || '—'}</p>
        </div>
      </div>

      {note.signedAt && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Signature</p>
          {signatureUrl && (
            <div className="border border-[#D9E1E8] rounded-lg bg-[#F4F6F5] p-4 flex items-center justify-center max-w-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signatureUrl} alt="Signature" className="max-h-24" />
            </div>
          )}
          <p className="text-xs text-[#7A8F79]">Signed {fmtDateTime(note.signedAt)}</p>
        </div>
      )}

      {note.addenda.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Addenda</p>
          {note.addenda.map(a => (
            <div key={a.id} className="bg-[#F4F6F5] border border-[#D9E1E8] rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold text-[#7A8F79]">
                {a.authorDisplayName}{a.authorRole === 'admin' ? ' (admin)' : ''} — {fmtDateTime(a.signedAt)}
              </p>
              <p className="text-sm text-[#2F3E4E] whitespace-pre-wrap">{a.text}</p>
              <div className="border border-[#D9E1E8] rounded-lg bg-white p-3 flex items-center justify-center max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.signatureUrl} alt="Addendum signature" className="max-h-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {addendumAction}
      {voidAction}
    </div>
  )
}
