'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Tabs from '../Tabs'
import MessageList, { MessageListItem } from './MessageList'
import MessageComposeModal from './MessageComposeModal'

type Folder = 'inbox' | 'drafts' | 'sent' | 'saved' | 'trash'
const FOLDERS: { key: Folder; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'sent', label: 'Sent' },
  { key: 'saved', label: 'Saved' },
  { key: 'trash', label: 'Trash' },
]

export default function MessagingPage({
  basePath, patients, prefix = 'my', title = 'Messaging', nav,
}: {
  basePath: string
  patients?: { id: string; name: string }[]
  prefix?: string
  title?: string
  nav?: React.ReactNode
}) {
  const router = useRouter()
  const [folder, setFolder] = useState<Folder>('inbox')
  const [messages, setMessages] = useState<MessageListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/messages?folder=${folder}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .finally(() => setLoading(false))
  }, [folder])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      {nav}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">{prefix}</span>{title}
          </h1>
          <button
            onClick={() => setComposing(true)}
            className="bg-[#2F3E4E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            + New Message
          </button>
        </div>

        <div className="mb-4">
          <Tabs tabs={FOLDERS} active={folder} onChange={k => setFolder(k as Folder)} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <p className="text-sm text-[#7A8F79] p-6 text-center">Loading…</p>
          ) : (
            <MessageList
              messages={messages}
              onRowClick={id => router.push(`${basePath}/${id}`)}
            />
          )}
        </div>
      </div>

      {composing && (
        <MessageComposeModal
          onClose={() => setComposing(false)}
          onSent={load}
          patients={patients}
        />
      )}
    </div>
  )
}
