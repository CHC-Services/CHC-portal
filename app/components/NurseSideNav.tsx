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
        left: 'max(1rem, calc(50vw - 650px + 1rem))',
        top: 'calc(80px + 20vh)',
        height: 'clamp(220px, 35vw, 460px)',
        width: '10vw',
        maxWidth: '150px',
        minWidth: '120px',
        background: '#f0fff0',
        border: '2.5px solid #2F3E4E',
        boxShadow:
          'inset 0 0 0 1px #4A5E49, ' +
          '16px 10px 28px rgba(0,0,0,0.18), ' +
          '3px 4px 0 rgba(45, 54, 64, 0.12)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header label */}
      <div className="px-3 pt-3 pb-2 border-b border-[#2F3E4E]/30 shrink-0">
        <p className="text-[12px] text-center font-bold uppercase tracking-widest text-[#2F3E4E]/80 select-none">
         Provider Pages
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
