'use client'

export type MessageListItem = {
  id: string
  subject: string | null
  preview: string
  senderName: string
  sentAt: string | null
  updatedAt: string
  isDraft: boolean
  read: boolean
  recipientCount: number
  patientId: string | null
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MessageList({ messages, onRowClick }: { messages: MessageListItem[]; onRowClick: (id: string) => void }) {
  if (messages.length === 0) {
    return <p className="text-sm text-[#7A8F79] italic p-6 text-center">No messages here.</p>
  }

  return (
    <div className="divide-y divide-[#D9E1E8]">
      {messages.map(m => (
        <div
          key={m.id}
          onClick={() => onRowClick(m.id)}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F4F6F5] transition"
        >
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${!m.read ? 'bg-[#7A8F79]' : 'bg-transparent'}`} />
          <span className={`w-36 shrink-0 truncate text-sm ${!m.read ? 'font-bold text-[#2F3E4E]' : 'text-[#2F3E4E]'}`}>
            {m.isDraft ? '(Draft)' : m.senderName}
          </span>
          <span className={`flex-1 min-w-0 truncate text-sm ${!m.read ? 'font-semibold text-[#2F3E4E]' : 'text-[#4a5568]'}`}>
            {m.subject && <span className="mr-2">{m.subject}</span>}
            <span className="text-[#7A8F79] font-normal">{m.preview}</span>
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-[#7A8F79]">
            {fmtDate(m.sentAt || m.updatedAt)}
          </span>
        </div>
      ))}
    </div>
  )
}
