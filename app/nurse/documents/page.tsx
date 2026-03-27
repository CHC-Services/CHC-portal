'use client'

import { useState, useEffect } from 'react'

type NurseDocument = {
  id: string
  title: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  expiresAt: string | null
  createdAt: string
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function expiryStatus(expiresAt: string | null): { label: string; color: string } | null {
  if (!expiresAt) return null
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0)  return { label: 'Expired',              color: 'bg-red-100 text-red-700' }
  if (days <= 14) return { label: `Expires in ${days}d`, color: 'bg-red-50 text-red-600' }
  if (days <= 30) return { label: `Expires in ${days}d`, color: 'bg-orange-50 text-orange-600' }
  if (days <= 90) return { label: `Expires in ${days}d`, color: 'bg-yellow-50 text-yellow-700' }
  return { label: `Expires ${fmtDate(expiresAt)}`,        color: 'bg-green-50 text-green-700' }
}

export default function NurseDocumentsPage() {
  const [documents, setDocuments] = useState<NurseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/nurse/documents', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setDocuments(data.documents || [])
        setLoading(false)
      })
  }, [])

  async function handleDownload(docId: string, fileName: string) {
    setDownloading(docId)
    try {
      const res = await fetch(`/api/nurse/documents/${docId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.url) {
        // Open the presigned URL — it expires in 15 minutes automatically
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Documents
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Documents on file with Coming Home Care.</p>
        </div>

        {loading ? (
          <div className="text-center text-[#7A8F79] py-16">Loading…</div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[#2F3E4E] font-semibold">No documents on file</p>
            <p className="text-[#7A8F79] text-sm mt-1">Documents shared by your coordinator will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map(doc => {
              const expiry = expiryStatus(doc.expiresAt)
              return (
                <div key={doc.id} className="bg-white rounded-xl shadow-sm px-5 py-4 flex items-center gap-4">
                  {/* File icon */}
                  <div className="w-10 h-10 rounded-lg bg-[#D9E1E8] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#2F3E4E] text-sm truncate">{doc.title}</p>
                    <p className="text-[11px] text-[#7A8F79] truncate mt-0.5">
                      {doc.fileName}{doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''} · Uploaded {fmtDate(doc.createdAt)}
                    </p>
                    {expiry && (
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${expiry.color}`}>
                        {expiry.label}
                      </span>
                    )}
                  </div>

                  {/* Download — fetches a fresh presigned URL each time */}
                  <button
                    onClick={() => handleDownload(doc.id, doc.fileName)}
                    disabled={downloading === doc.id}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    {downloading === doc.id ? (
                      <span>Opening…</span>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
