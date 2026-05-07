'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MyPatients() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.profile?.portalAgreementSignedAt) {
          router.replace('/nurse/agreement')
          return
        }
        if (!data.onboardingComplete) {
          router.replace('/nurse/onboarding')
          return
        }
      })
  }, [router])

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Patients
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Manage your patient information</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="text-4xl">🏥</div>
        <h2 className="text-lg font-semibold text-[#2F3E4E]">Patient records coming soon</h2>
        <p className="text-sm text-[#7A8F79] max-w-sm">
          This section will let you add and manage your own patient information — keeping records current without relying on admin.
        </p>
      </div>
    </div>
  )
}
