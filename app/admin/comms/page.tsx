'use client'

import Link from 'next/link'
import AdminNav from '../../components/AdminNav'

const CARDS = [
  {
    href: '/admin/email',
    title: 'Broadcast / Email',
    description: 'Send bulk emails and announcements to providers.',
    icon: '📧',
  },
  {
    href: '/admin/calendar',
    title: 'Calendar',
    description: 'Manage scheduling and appointments.',
    icon: '📅',
  },
  {
    href: '/admin/faq',
    title: 'FAQ',
    description: 'Manage frequently asked questions shown to providers.',
    icon: '❓',
  },
  {
    href: '/admin/messages',
    title: 'Messages',
    description: 'Direct messaging with providers.',
    icon: '💬',
  },
]

export default function CommsPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">ad</span>Comms
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Communication tools for managing provider outreach.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl">
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-3 border border-transparent hover:border-[#7A8F79] transition group"
          >
            <div className="text-3xl">{card.icon}</div>
            <div>
              <p className="font-bold text-[#2F3E4E] text-sm group-hover:text-[#7A8F79] transition">{card.title}</p>
              <p className="text-xs text-[#7A8F79] mt-1 leading-relaxed">{card.description}</p>
            </div>
            <span className="text-xs font-semibold text-[#7A8F79] mt-auto">Open →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
