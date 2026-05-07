import NurseSideNav from '../components/NurseSideNav'

export default function NurseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NurseSideNav />
      {/* Push content right to clear the fixed side nav (10vw wide + 1rem left + 0.5rem gap) */}
      <div className="lg:pl-[calc(10vw+1.5rem)]">
        {children}
      </div>
    </>
  )
}
