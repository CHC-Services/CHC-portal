import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import Link from 'next/link'

async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  return verifyToken(token)
}

function QuickCard({
  href,
  title,
  description,
  accent = false,
}: {
  href: string
  title: string
  description: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl shadow-sm p-6 border-t-4 transition hover:shadow-md hover:-translate-y-0.5 ${
        accent
          ? 'bg-[#2F3E4E] border-[#7A8F79] text-white'
          : 'bg-white border-[#7A8F79] text-[#2F3E4E]'
      }`}
    >
      <p className={`text-lg font-bold mb-1 ${accent ? 'text-white' : 'text-[#2F3E4E]'}`}>{title}</p>
      <p className={`text-sm ${accent ? 'text-[#D9E1E8]' : 'text-[#7A8F79]'}`}>{description}</p>
    </Link>
  )
}

export default async function Home() {
  const user = await getUser()

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-10">

      {/* Hero */}
      <div className="max-w-2xl mb-10">
        <h1 className="text-4xl font-bold text-[#2F3E4E] leading-tight">
          Welcome to{' '}
          <span className="italic">Coming Home</span>
          <span className="text-[#7A8F79]">care</span>
        </h1>
        <p className="mt-3 text-[#7A8F79] text-base">
          Your secure portal for time tracking, billing, and profile management.
        </p>
      </div>

      {/* Nurse quick links */}
      {user?.role === 'nurse' && (
        <div>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">Quick Access</p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
            <QuickCard
              href="/nurse"
              title="myDashboard"
              description="Submit hours and view your history."
              accent
            />
            <QuickCard
              href="/nurse/claims"
              title="myClaims"
              description="View the status of your submitted claims."
            />
            <QuickCard
              href="/nurse/profile"
              title="myProfile"
              description="Update your contact and billing info."
            />
          </div>
        </div>
      )}

      {/* Admin quick links */}
      {user?.role === 'admin' && (
        <div>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-3">Quick Access</p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
            <QuickCard
              href="/admin"
              title="Admin Dashboard"
              description="View nurse roster, hours, and add new nurses."
              accent
            />
          </div>
        </div>
      )}

      {/* Logged-out CTA */}
      {!user && (
        <div className="max-w-sm">
          <Link
            href="/login"
            className="inline-block bg-[#2F3E4E] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#7A8F79] transition"
          >
            Sign In to Your Portal
          </Link>
        </div>
      )}

    </div>
  )
}
