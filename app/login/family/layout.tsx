import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'myCare Login | Coming Home Care',
}

export default function FamilyLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
