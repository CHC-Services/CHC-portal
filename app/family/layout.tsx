import type { Metadata } from 'next'
import FamilySideNav from '../components/FamilySideNav'

export const metadata: Metadata = {
  title: 'myCare Portal | Coming Home Care',
}

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start min-h-screen bg-[#D9E1E8]">
      <FamilySideNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
