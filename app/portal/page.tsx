'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type UserInfo = {
  displayName: string
  email: string
  role: string
}

export default function PortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.push('/login'); return }
        router.push(data.role === 'admin' ? '/admin' : '/nurse')
      })
  }, [router])

  if (!user) return null

  const steps = [
    {
      num: '1',
      title: 'Complete your profile',
      desc: 'Add your personal information, NPI number, and contact details.',
      href: '/nurse/profile',
      cta: 'Go to myProfile →',
      done: false,
    },
    {
      num: '2',
      title: 'Enroll in billing services',
      desc: 'Set up your billing preferences and sign the service agreement.',
      href: '/nurse/onboarding',
      cta: 'Start billing enrollment →',
      done: false,
    },
    {
      num: '3',
      title: 'Explore resources',
      desc: 'Review NY provider enrollment guides, NPI info, and credentialing docs.',
      href: '/resources',
      cta: 'View resources →',
      done: false,
    },
  ]

  return (
    <div className="min-h-screen bg-[#D9E1E8] pt-[220px] md:pt-[220px] pb-24 md:pb-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Welcome card */}
        <div className="bg-[#2F3E4E] text-white rounded-2xl px-8 py-8">
          <h1 className="text-2xl font-bold mb-2">
            <span className="italic text-[#7A8F79]">my</span>Provider Portal
          </h1>
          <p className="text-[#D9E1E8] text-medium leading-relaxed pt-1">
            Hi <strong>{user.displayName}</strong> — <span className="text-medium tracking-widest text-[#7A8F79] font-semibold mb-1">WELCOME HOME,</span></p>
            <p className="text-[#D9E1E8] text-sm font-semibold leading-relaxed ">
              and thank you for registering for a portal account! </p>
          
          <p className="text-[#7A8F79] font-semibold text-medium mt-3 pl-10 leading-relaxed">
            Your account is pending approval. </p> 
            <p className="text-sm tracking-narrow text-[#D9E1E8] pt-4 mb-1">While you you wait, complete the steps below & click the links above to look around the site to see all of the tools & resources available. After your account is approved & the Billing Service enrollment is completed, you'll have full access to the portal features.</p>
          
          <p className="mt-3 text-xs text-[#7A8F79]">
           If you have any questions, reach us at: <a href="mailto:support@cominghomecare.com" className="font-semibold text-[#D9E1E8] hover:text-[#7A8F79] transition"><u>
              support@cominghomecare.com</u>
            </a>
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map(step => (
            <div key={step.num} className="bg-white rounded-xl shadow-sm px-6 py-5 flex items-start gap-5">
              <div className="w-9 h-9 rounded-full bg-[#2F3E4E] text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#2F3E4E] text-sm">{step.title}</p>
                <p className="text-xs text-[#7A8F79] mt-1 leading-relaxed">{step.desc}</p>
                <Link
                  href={step.href}
                  className="inline-block mt-3 text-xs font-semibold text-[#2F3E4E] underline underline-offset-2 hover:text-[#7A8F79] transition"
                >
                  {step.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Help */}
        <div className="bg-white rounded-xl shadow-sm px-6 py-5 text-center">
          <p className="text-sm text-[#7A8F79]">
            Questions? Email us at{' '}
            <a href="mailto:support@cominghomecare.com" className="font-semibold text-[#2F3E4E] hover:text-[#7A8F79] transition">
              support@cominghomecare.com
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}
