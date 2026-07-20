'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/nurse',           label: 'Dashboard' },
  { href: '/nurse/hours',     label: 'Hours'     },
  { href: '/nurse/claims',    label: 'Claims'    },
  { href: '/nurse/patients',  label: 'Patients'  },
  { href: '/nurse/invoices',  label: 'Invoices'  },
  { href: '/nurse/documents', label: 'Documents' },
  { href: '/nurse/profile',    label: 'Profile'    },
  { href: '/care',             label: 'SelfCare'       },
  { href: '/nurse/appearance', label: 'Settings' },
]

const DIVIDERS_BEFORE = new Set(['Hours', 'Invoices', 'Profile', 'Settings'])

export default function NurseSideNav() {
  const pathname = usePathname()

  return (
    <div
      className="hidden lg:flex flex-col shrink-0 self-start sticky"
      style={{
        top: '220px',
        marginTop: '190px',
        width: '168px',
        background: '#F4F6F5',
        border: '1px solid rgba(47,62,78,0.13)',
        boxShadow: '0 4px 24px rgba(47,62,78,0.09), 0 1px 6px rgba(47,62,78,0.05)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="px-3 pt-3 pb-2.5 shrink-0"
        style={{
          background: 'linear-gradient(135deg, #2F3E4E 0%, #3d5260 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <p className="text-[11px] text-center font-bold uppercase tracking-[0.18em] text-[#D9E1E8] select-none opacity-80">
          Provider Pages
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 p-1.5">
        {links.map((link) => {
          const active = pathname === link.href
          return (
            <div key={link.href}>
              {DIVIDERS_BEFORE.has(link.label) && (
                <div className="my-3 px-2">
                  <div style={{
                    height: '1px',
                    background: 'linear-gradient(to right, transparent, rgba(47,62,78,0.15), transparent)',
                  }} />
                </div>
              )}
              <Link
                href={link.href}
                className={`relative flex items-baseline px-3 py-[7px] rounded-lg text-sm font-semibold transition-all duration-150 leading-tight overflow-hidden ${
                  active
                    ? 'bg-[#2F3E4E] text-white shadow-sm'
                    : 'text-[#2F3E4E] hover:bg-[#2F3E4E]/[0.07] hover:text-[#2F3E4E]'
                }`}
              >
                {active && (
                  <span
                    className="absolute left-0 inset-y-[5px] w-[3px] rounded-r-full"
                    style={{ background: '#7A8F79' }}
                  />
                )}
                <span
                  style={{
                    color: active ? '#9fbf9d' : '#7A8F79',
                    fontStyle: 'italic',
                    fontSize: '0.72em',
                    marginRight: '1px',
                    transition: 'color 150ms',
                  }}
                >
                  my
                </span>
                {link.label}
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Footer accent line */}
      <div className="mx-3 mb-2 mt-0.5" style={{
        height: '1px',
        background: 'linear-gradient(to right, transparent, rgba(47,62,78,0.10), transparent)',
      }} />
    </div>
  )
}
