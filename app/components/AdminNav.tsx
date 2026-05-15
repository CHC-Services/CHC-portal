'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavLink = {
  prefix: string
  label: string
  href: string
  activePaths: string[]
  exactHome?: boolean
}

const links: NavLink[] = [
  {
    prefix: 'ad', label: 'Providers', href: '/admin',
    activePaths: ['/admin/nurse/', '/admin/enrollment'],
    exactHome: true,
  },
  {
    prefix: 'ad', label: 'Claims',   href: '/admin/claims',
    activePaths: ['/admin/claims'],
  },
  {
    prefix: 'ad', label: 'Billing',  href: '/admin/billing',
    activePaths: ['/admin/billing', '/admin/hours', '/admin/invoicing', '/admin/campaigns'],
  },
  {
    prefix: 'ad', label: 'Patients', href: '/admin/patients',
    activePaths: ['/admin/patients'],
  },
  {
    prefix: 'ad', label: 'Documents', href: '/admin/documents',
    activePaths: ['/admin/documents'],
  },
  {
    prefix: 'ad', label: 'Comms',    href: '/admin/comms',
    activePaths: ['/admin/comms', '/admin/email', '/admin/calendar', '/admin/faq', '/admin/messages'],
  },
  {
    prefix: '', label: '⚙',           href: '/admin/system',
    activePaths: ['/admin/system', '/admin/ideas', '/admin/backups', '/admin/medicaid'],
  },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {links.map(link => {
        const active = link.exactHome
          ? pathname === '/admin' || link.activePaths.some(p => pathname.startsWith(p))
          : link.activePaths.some(p => pathname.startsWith(p))
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
            {link.prefix && <span className="italic text-[#7A8F79]">{link.prefix}</span>}
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}
