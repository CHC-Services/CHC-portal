import NurseSideNav from '../components/NurseSideNav'

export default function NurseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-5 items-start min-h-screen bg-[#D9E1E8]">
      <NurseSideNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
