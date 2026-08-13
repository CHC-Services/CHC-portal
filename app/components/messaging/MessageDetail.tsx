'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MessageComposeModal from './MessageComposeModal'

type Recipient = { id: string; name: string; read: boolean }
type MessageDetailData = {
  id: string
  subject: string | null
  body: string
  isDraft: boolean
  sentAt: string | null
  createdAt: string
  senderId: string | null
  senderName: string
  isSender: boolean
  saved: boolean
  trashed: boolean
  recipients: Recipient[]
  patient: { id: string; firstName: string; lastName: string } | null
  inReplyTo: { id: string; subject: string | null; senderName: string } | null
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MessageDetail({
  messageId, backHref, backLabel, currentUserId, patients,
}: {
  messageId: string
  backHref: string
  backLabel: string
  currentUserId: string
  patients?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [message, setMessage] = useState<MessageDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [replyMode, setReplyMode] = useState<'reply' | 'replyAll' | null>(null)
  const [editingDraft, setEditingDraft] = useState(false)

  function load() {
    fetch(`/api/messages/${messageId}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setMessage(body.message)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [messageId])

  async function toggleSaved() {
    if (!message) return
    await fetch(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: message.saved ? 'unsave' : 'save' }),
    })
    load()
  }

  async function toggleTrashed() {
    if (!message) return
    await fetch(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: message.trashed ? 'restore' : 'trash' }),
    })
    if (!message.trashed) router.push(backHref)
    else load()
  }

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (notFound || !message) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto">
          <p className="text-[#2F3E4E] font-semibold">Message not found</p>
          <Link href={backHref} className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">{backLabel}</Link>
        </div>
      </div>
    )
  }

  if (message.isDraft) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
        <div className="max-w-2xl mx-auto">
          <Link href={backHref} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">{backLabel}</Link>
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-3">
            <p className="text-sm text-[#7A8F79] mb-4">This is a draft.</p>
            <button
              onClick={() => setEditingDraft(true)}
              className="bg-[#2F3E4E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition"
            >
              Continue Editing
            </button>
          </div>
        </div>
        {editingDraft && (
          <MessageComposeModal
            draftId={message.id}
            initialSubject={message.subject || ''}
            initialBody={message.body}
            patients={patients}
            onClose={() => setEditingDraft(false)}
            onSent={() => router.push(backHref)}
          />
        )}
      </div>
    )
  }

  const otherRecipients = message.recipients.filter(r => r.id !== currentUserId)
  const replyAllIds = [
    ...(message.senderId && message.senderId !== currentUserId ? [message.senderId] : []),
    ...otherRecipients.map(r => r.id),
  ]
  const replySingleIds = message.senderId && message.senderId !== currentUserId ? [message.senderId] : otherRecipients.slice(0, 1).map(r => r.id)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-2xl mx-auto">
        <Link href={backHref} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">{backLabel}</Link>

        <div className="bg-white rounded-2xl shadow-sm p-6 mt-3">
          {message.inReplyTo && (
            <p className="text-xs text-[#7A8F79] mb-2">
              In reply to <span className="font-semibold">{message.inReplyTo.senderName}</span>
              {message.inReplyTo.subject ? ` — ${message.inReplyTo.subject}` : ''}
            </p>
          )}
          {message.patient && (
            <p className="text-xs text-[#7A8F79] mb-2">
              Re: Care Team — {message.patient.firstName} {message.patient.lastName}
            </p>
          )}

          <h1 className="text-xl font-bold text-[#2F3E4E]">{message.subject || '(No subject)'}</h1>
          <div className="flex items-center justify-between mt-1 mb-4">
            <p className="text-sm text-[#7A8F79]">
              From <span className="font-semibold text-[#2F3E4E]">{message.senderName}</span>
              {' · '}
              To {message.recipients.map(r => r.name).join(', ')}
            </p>
            <p className="text-xs text-[#7A8F79] shrink-0 ml-3">{fmtDateTime(message.sentAt || message.createdAt)}</p>
          </div>

          <p className="text-sm text-[#2F3E4E] whitespace-pre-wrap leading-relaxed border-t border-[#D9E1E8] pt-4">{message.body}</p>

          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#D9E1E8]">
            <button onClick={() => setReplyMode('reply')} className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition">
              Reply
            </button>
            {replyAllIds.length > 1 && (
              <button onClick={() => setReplyMode('replyAll')} className="border border-[#D9E1E8] text-[#2F3E4E] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">
                Reply All
              </button>
            )}
            <button onClick={toggleSaved} className="border border-[#D9E1E8] text-[#7A8F79] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">
              {message.saved ? 'Unsave' : 'Save'}
            </button>
            <button onClick={toggleTrashed} className="border border-[#D9E1E8] text-red-500 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition">
              {message.trashed ? 'Restore' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {replyMode && (
        <MessageComposeModal
          initialRecipientIds={replyMode === 'replyAll' ? replyAllIds : replySingleIds}
          initialSubject={message.subject ? (message.subject.startsWith('Re: ') ? message.subject : `Re: ${message.subject}`) : ''}
          initialInReplyToId={message.id}
          patients={patients}
          onClose={() => setReplyMode(null)}
          onSent={load}
        />
      )}
    </div>
  )
}
