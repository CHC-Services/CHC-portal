'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '../../../components/AdminNav'

type LogEntry = {
  id: string
  sentAt: string
  recipientName: string | null
  recipientEmail: string
  category: string
  subject: string
  status: string
}

const CATEGORY_COLORS: Record<string, string> = {
  invoice:   'bg-blue-50 text-blue-700 border-blue-200',
  receipt:   'bg-green-50 text-green-700 border-green-200',
  reminder:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  alert:     'bg-orange-50 text-orange-700 border-orange-200',
  broadcast: 'bg-purple-50 text-purple-700 border-purple-200',
  misc:      'bg-gray-100 text-gray-600 border-gray-200',
}

export default function EmailLogPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)

  const [modalUrl, setModalUrl] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const load = useCallback(async (p: number, cat: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (cat) params.set('category', cat)
    const res = await fetch(`/api/admin/email/log?${params}`, { credentials: 'include' })
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    setLogs(data.logs ?? [])
    setTotal(data.total ?? 0)
    setPage(data.page ?? 1)
    setPages(data.pages ?? 1)
    setLoading(false)
  }, [router])

  useEffect(() => { load(1, category) }, [load, category])

  async function openBody(id: string) {
    setModalLoading(true); setModalUrl(null)
    const res = await fetch(`/api/admin/email/log/${id}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setModalUrl(data.url)
    }
    setModalLoading(false)
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="mb-2">
          <AdminNav />
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-3xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">ad</span>Email — Sent Log
            </h1>
            <button
              onClick={() => router.push('/admin/email')}
              className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition"
            >
              ← Back to adEmail
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm px-5 py-4 flex items-center gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Filter</p>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1) }}
            className="border border-[#D9E1E8] rounded-lg px-3 py-1.5 text-sm text-[#2F3E4E] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          >
            <option value="">All Categories</option>
            <option value="invoice">Invoice</option>
            <option value="receipt">Receipt</option>
            <option value="reminder">Reminder</option>
            <option value="alert">Alert</option>
            <option value="broadcast">Broadcast</option>
            <option value="misc">Misc</option>
          </select>
          {!loading && <p className="text-xs text-[#7A8F79] ml-auto">{total.toLocaleString()} total</p>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#7A8F79]">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#7A8F79]">No emails logged yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f4f6f5] border-b border-[#D9E1E8]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Date / Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Recipient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E1E8]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[#fafbfa] transition">
                    <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap">{fmt(log.sentAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#2F3E4E] leading-tight">{log.recipientName || '—'}</p>
                      <p className="text-xs text-[#7A8F79]">{log.recipientEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${CATEGORY_COLORS[log.category] ?? CATEGORY_COLORS.misc}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#2F3E4E] max-w-xs truncate">{log.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${log.status === 'sent' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.status === 'sent' ? (
                        <button
                          onClick={() => openBody(log.id)}
                          title="View message body"
                          className="text-lg hover:scale-110 transition"
                        >
                          📑
                        </button>
                      ) : (
                        <span className="text-[#D9E1E8]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => load(page - 1, category)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-[#D9E1E8] text-sm text-[#7A8F79] hover:border-[#7A8F79] disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-[#7A8F79]">Page {page} of {pages}</span>
            <button
              onClick={() => load(page + 1, category)}
              disabled={page >= pages}
              className="px-3 py-1.5 rounded-lg border border-[#D9E1E8] text-sm text-[#7A8F79] hover:border-[#7A8F79] disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        )}

      </div>

      {/* Body modal */}
      {(modalLoading || modalUrl) && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => { setModalUrl(null); setModalLoading(false) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#2F3E4E] px-5 py-3 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Message Body</p>
              <button
                onClick={() => { setModalUrl(null); setModalLoading(false) }}
                className="text-[#D9E1E8] hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            {modalLoading ? (
              <div className="flex-1 flex items-center justify-center p-10 text-sm text-[#7A8F79]">Loading…</div>
            ) : (
              <iframe src={modalUrl!} className="flex-1 w-full border-none" title="Email body" style={{ minHeight: '420px' }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
