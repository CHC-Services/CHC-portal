'use client'

import Link from 'next/link'
import AdminNav from '../../components/AdminNav'

const CARDS = [
  {
    href: '/admin/system/appearance',
    title: 'Appearance',
    description: 'Text size, gutter color, density, corner style, and card elevation.',
    icon: '🎨',
  },
  {
    href: '/admin/system/security',
    title: 'Security',
    description: 'Two-step verification controls and authentication settings.',
    icon: '🔐',
  },
  {
    href: '/admin/system/login-log',
    title: 'Login Log',
    description: 'Every login attempt with timestamp, account type, result, and IP address.',
    icon: '🗒️',
  },
  {
    href: '/admin/ideas',
    title: 'Ideas',
    description: 'Feature requests and improvement ideas.',
    icon: '💡',
  },
  {
    href: '/admin/backups',
    title: 'Backups',
    description: 'Data backup status and export tools.',
    icon: '🗄️',
  },
]

export default function SystemPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">⚙ System</h1>
        <p className="text-sm text-[#7A8F79] mt-1">Admin tools and configuration.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
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
