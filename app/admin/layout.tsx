import AdminSideNav from '../components/AdminSideNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start min-h-screen bg-[#D9E1E8]">
      <AdminSideNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
