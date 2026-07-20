import NurseSideNav from '../components/NurseSideNav'

export default function CareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-2 items-start min-h-screen"
      style={{ background: 'linear-gradient(160deg, #dce8dc 0%, #e6ecee 55%, #d2dde5 100%)' }}
    >
      <NurseSideNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
