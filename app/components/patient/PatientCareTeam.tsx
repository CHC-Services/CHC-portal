'use client'

import { useState } from 'react'
import GuardianInviteModal, { GuardianInviteData } from '../GuardianInviteModal'
import { formalName } from '../../../lib/formatName'

export type NurseLink = { id: string; isActive: boolean; nurse: { id: string; displayName: string; firstName?: string; lastName?: string; accountNumber: string | null } }
export type GuardianLink = { id: string; relationship: string | null; user: { id: string; name: string; email: string } }
type NurseOption = { id: string; displayName: string; firstName?: string; lastName?: string; accountNumber: string | null }

export default function PatientCareTeam({
  patientName,
  nurseLinks,
  guardianLinks,
  canManageAssignment,
  availableNurses,
  onAssign,
  onUnlink,
  onUnlinkGuardian,
  onInviteGuardian,
}: {
  patientName: string
  nurseLinks: NurseLink[]
  guardianLinks: GuardianLink[]
  canManageAssignment: boolean
  availableNurses?: NurseOption[]
  onAssign?: (nurseId: string) => Promise<void>
  onUnlink?: (nurseId: string) => Promise<void>
  onUnlinkGuardian?: (userId: string) => Promise<void>
  onInviteGuardian: (data: GuardianInviteData) => Promise<{ ok: boolean; error?: string }>
}) {
  const [assignNurseId, setAssignNurseId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [invitingGuardian, setInvitingGuardian] = useState(false)

  const activeLinks = nurseLinks.filter(l => l.isActive)

  async function handleAssignClick() {
    if (!assignNurseId || !onAssign) return
    setAssigning(true)
    await onAssign(assignNurseId)
    setAssigning(false)
    setAssignNurseId('')
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Care Team</p>
        <button onClick={() => setInvitingGuardian(true)} className="text-xs font-semibold text-[#7A8F79]">
          + Invite Guardian
        </button>
      </div>
      {invitingGuardian && (
        <GuardianInviteModal
          patientName={patientName}
          onClose={() => setInvitingGuardian(false)}
          onInvite={onInviteGuardian}
        />
      )}

      {/* Everyone with access to this record, by role — site admins are excluded, they have blanket access regardless */}
      <div className="pt-2 border-t border-[#D9E1E8]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Family</p>
        {guardianLinks.length === 0 ? (
          <p className="text-xs text-[#7A8F79] italic">No family members with access yet.</p>
        ) : (
          <div className="space-y-1.5">
            {guardianLinks.map(g => (
              <div key={g.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
                <span className="text-sm text-[#2F3E4E] font-semibold">{g.user.name}</span>
                <div className="flex items-center gap-2">
                  {g.relationship && <span className="text-[10px] font-semibold uppercase text-[#7A8F79]">{g.relationship}</span>}
                  {canManageAssignment && (
                    <button onClick={() => onUnlinkGuardian?.(g.user.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold transition">
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-[#D9E1E8]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Provider</p>
        {activeLinks.length === 0 ? (
          <p className="text-xs text-[#7A8F79] italic mb-2">No providers linked.</p>
        ) : (
          <div className="space-y-1.5 mb-2">
            {activeLinks.map(l => (
              <div key={l.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
                <span className="text-sm text-[#2F3E4E] font-semibold">{l.nurse.lastName || l.nurse.displayName}</span>
                {canManageAssignment && (
                  <button onClick={() => onUnlink?.(l.nurse.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold transition">
                    Unlink
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canManageAssignment && (
          <div className="flex gap-2">
            <select
              value={assignNurseId}
              onChange={e => setAssignNurseId(e.target.value)}
              className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            >
              <option value="">Assign a provider…</option>
              {(availableNurses || [])
                .filter(n => !activeLinks.some(l => l.nurse.id === n.id))
                .map(n => (
                  <option key={n.id} value={n.id}>{formalName(n) || n.displayName}{n.accountNumber ? ` (${n.accountNumber})` : ''}</option>
                ))}
            </select>
            <button
              onClick={handleAssignClick}
              disabled={!assignNurseId || assigning}
              className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-40"
            >
              {assigning ? '…' : 'Link'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
