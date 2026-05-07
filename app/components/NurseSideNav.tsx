'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/nurse',           label: 'Dashboard' },
  { href: '/nurse/patients',  label: 'Patients'  },
  { href: '/nurse/hours',     label: 'Hours'     },
  { href: '/nurse/claims',    label: 'Claims'    },
  { href: '/nurse/invoices',  label: 'Invoices'  },
  { href: '/nurse/documents', label: 'Documents' },
  { href: '/nurse/profile',   label: 'Profile'   },
  { href: '/care',            label: 'Care'      },
]

export default function NurseSideNav() {
  const pathname = usePathname()

  return (
    <div
      className="hidden lg:flex fixed z-40 flex-col"
      style={{
        left: '1rem',
        top: 'calc(100px + 20vh)',
        height: '60vh',
        width: '10vw',
        background: '#C5D4C3',
        border: '2px solid #2F3E4E',
        boxShadow:
          'inset 0 0 0 1px #4A5E49, ' +
          '6px 10px 28px rgba(0,0,0,0.18), ' +
          '3px 4px 0 rgba(47,62,78,0.12)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header label */}
      <div className="px-3 pt-3 pb-2 border-b border-[#2F3E4E]/20 shrink-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#2F3E4E]/50 select-none">
          <span style={{ color: '#4A5E49', fontStyle: 'italic' }}>my</span>Provider
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">
        {links.map(link => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-baseline px-2.5 py-2 rounded-lg text-xs font-semibold transition-all leading-tight ${
                active
                  ? 'bg-[#2F3E4E] text-white'
                  : 'text-[#2F3E4E] hover:bg-[#2F3E4E]/10'
              }`}
            >
              <span
                style={{
                  color: active ? '#C5D4C3' : '#4A5E49',
                  fontStyle: 'italic',
                  fontSize: '0.72em',
                  marginRight: '1px',
                }}
              >
                my
              </span>
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
