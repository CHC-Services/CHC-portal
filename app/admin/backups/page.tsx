'use client'

import { useState, useEffect } from 'react'
import AdminNav from '../../components/AdminNav'

type Backup = {
  id: string
  label: string
  claimCount: number
  createdAt: string
}

type RestoreResult = {
  restored: number
  deleted: number
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<Backup | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function loadBackups() {
    setLoading(true)
    fetch('/api/admin/backup/claims', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBackups(data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadBackups() }, [])

  async function createManualBackup() {
    setCreating(true)
    setMessage('')
    setRestoreResult(null)
    const res = await fetch('/api/admin/backup/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ label: 'manual' }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setMessageIsError(false)
      setMessage(`Manual backup created — ${data.claimCount} claims saved.`)
      loadBackups()
    } else {
      setMessageIsError(true)
      setMessage(data.error || 'Failed to create backup.')
    }
  }

  async function restoreBackup(backup: Backup) {
    setRestoring(true)
    setMessage('')
    setRestoreResult(null)
    const res = await fetch(`/api/admin/backup/claims/${backup.id}`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    setRestoring(false)
    setConfirmRestore(null)
    if (res.ok) {
      setMessageIsError(false)
      setRestoreResult({ restored: data.restored, deleted: data.deleted })
    } else {
      setMessageIsError(true)
      setMessage(data.error || 'Restore failed.')
    }
  }

  async function deleteBackup(id: string) {
    await fetch(`/api/admin/backup/claims/${id}`, { method: 'DELETE', credentials: 'include' })
    setConfirmDelete(null)
    loadBackups()
  }

  const autoCount = backups.filter(b => b.label === 'auto').length
  const manualCount = backups.filter(b => b.label === 'manual').length

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      <div className="max-w-3xl">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">ad</span>Backups
            </h1>
            <p className="text-sm text-[#7A8F79] mt-1">
              Daily claim snapshots — auto-runs at 3 AM, keeps last 10. Manual backups kept until you delete them.
            </p>
          </div>
          <button
            onClick={createManualBackup}
            disabled={creating}
            className="shrink-0 bg-[#2F3E4E] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-50"
          >
            {creating ? 'Saving…' : '+ Create Manual Backup'}
          </button>
        </div>

        {/* Status message */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border ${messageIsError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-[#f0f4f0] border-[#7A8F79] text-[#2F3E4E]'}`}>
            {message}
          </div>
        )}

        {/* Restore success */}
        {restoreResult && (
          <div className="mb-6 px-5 py-4 rounded-xl bg-green-50 border border-green-300 text-sm text-green-800">
            <p className="font-semibold text-green-900 mb-1">Restore complete</p>
            <p>{restoreResult.restored} claims restored from snapshot.</p>
            {restoreResult.deleted > 0 && (
              <p className="mt-0.5 text-xs text-green-700">{restoreResult.deleted} claim{restoreResult.deleted !== 1 ? 's' : ''} that were added after this snapshot have been removed.</p>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-[#7A8F79]">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Backups</p>
            <p className="text-3xl font-bold text-[#2F3E4E] mt-1">{backups.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-[#7A8F79]">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Auto (Daily)</p>
            <p className="text-3xl font-bold text-[#2F3E4E] mt-1">{autoCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-[#7A8F79]">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Manual</p>
            <p className="text-3xl font-bold text-[#2F3E4E] mt-1">{manualCount}</p>
          </div>
        </div>

        {/* Restore confirmation modal */}
        {confirmRestore && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
              <p className="text-base font-bold text-[#2F3E4E] mb-2">Restore claim data?</p>
              <p className="text-sm text-[#7A8F79] leading-relaxed mb-1">
                This will revert all claims to the snapshot from:
              </p>
              <p className="text-sm font-semibold text-[#2F3E4E] mb-1">
                {new Date(confirmRestore.createdAt).toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
              <p className="text-sm text-[#7A8F79] mb-4">
                {confirmRestore.claimCount} claims · Any claims added after this snapshot will be deleted.
              </p>
              <p className="text-xs text-orange-600 font-semibold mb-4">
                This cannot be undone. Consider creating a manual backup first if you want to preserve the current state.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmRestore(null)}
                  className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm font-semibold hover:bg-[#F4F6F5] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => restoreBackup(confirmRestore)}
                  disabled={restoring}
                  className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
                >
                  {restoring ? 'Restoring…' : 'Yes, Restore'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backup list */}
        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading backups…</p>
        ) : backups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm px-6 py-8 text-center">
            <p className="text-sm text-[#7A8F79] italic">No backups yet. The first auto-backup will run tonight at 3 AM, or create one manually now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup, i) => {
              const date = new Date(backup.createdAt)
              const isAuto = backup.label === 'auto'
              const isNewest = i === 0
              return (
                <div
                  key={backup.id}
                  className={`bg-white rounded-xl shadow-sm px-5 py-4 flex items-center gap-4 ${isNewest ? 'border-l-4 border-[#7A8F79]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isAuto ? 'bg-blue-100 text-blue-700' : 'bg-[#F4F6F5] text-[#2F3E4E] border border-[#D9E1E8]'}`}>
                        {isAuto ? 'Auto' : 'Manual'}
                      </span>
                      {isNewest && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Most Recent
                        </span>
                      )}
                      <span className="text-sm font-semibold text-[#2F3E4E]">
                        {date.toLocaleString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A8F79] mt-0.5">{backup.claimCount} claims</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {confirmDelete === backup.id ? (
                      <>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs border border-[#D9E1E8] text-[#7A8F79] px-3 py-1.5 rounded-lg hover:bg-[#F4F6F5] transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteBackup(backup.id)}
                          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-red-700 transition"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmRestore(backup)}
                          className="text-xs bg-[#7A8F79] text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-[#2F3E4E] transition"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => setConfirmDelete(backup.id)}
                          title="Delete backup"
                          className="text-[#D9E1E8] hover:text-red-400 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
