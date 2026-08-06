import { getUserFromCookie } from '@/lib/getUserFromCookie'
import NurseSideNav from '../components/NurseSideNav'
import FamilySideNav from '../components/FamilySideNav'

export default async function CareLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromCookie()

  return (
    <div
      className="flex gap-2 items-start min-h-screen"
      style={{ background: 'linear-gradient(160deg, #dce8dc 0%, #e6ecee 55%, #d2dde5 100%)' }}
    >
      {user?.role === 'guardian' ? <FamilySideNav /> : (user?.role === 'nurse' || user?.role === 'provider') ? <NurseSideNav /> : null}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
