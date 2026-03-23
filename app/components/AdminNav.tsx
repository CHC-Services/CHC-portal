'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { label: 'Roster',          href: '/admin' },
  { label: 'Claims',          href: '/admin/claims' },
  { label: 'Billing Summary', href: '/admin/billing' },
  { label: 'Calendar',        href: '/admin/calendar' },
  { label: 'Add Provider',    href: '/admin#add-provider' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {links.map(link => {
        const active = link.href === '/admin'
          ? pathname === '/admin'
          : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              active
                ? 'bg-[#2F3E4E] text-white'
                : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}
