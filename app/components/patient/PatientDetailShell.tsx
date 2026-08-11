'use client'

import { useState } from 'react'
import Link from 'next/link'
import PatientTabs, { DetailTab } from './PatientTabs'

export default function PatientDetailShell({
  backHref, backLabel, headerName, headerAccountNumber, banners, tabs, initialTab = 'demographics',
}: {
  backHref: string
  backLabel: string
  headerName: string
  headerAccountNumber: string
  banners?: React.ReactNode
  tabs: { key: DetailTab; label: string; content: React.ReactNode }[]
  initialTab?: DetailTab
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)
  const active = tabs.find(t => t.key === activeTab) ?? tabs[0]

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-2xl mx-auto">
        <Link href={backHref} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
          {backLabel}
        </Link>

        <div className="flex items-center justify-between mt-2 mb-1">
          <h1 className="text-2xl font-bold text-[#2F3E4E] uppercase">{headerName}</h1>
          <span className="text-right shrink-0 ml-3">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Account #</span>
            <span className="text-xl font-bold text-[#7A8F79] font-mono">{headerAccountNumber}</span>
          </span>
        </div>

        {banners}

        <div className="mb-4 mt-5">
          <PatientTabs tabs={tabs.map(({ key, label }) => ({ key, label }))} active={activeTab} onChange={setActiveTab} />
        </div>

        {active?.content}
      </div>
    </div>
  )
}
