import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyToken } from "@/lib/auth"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_token")?.value

  if (!token) {
    redirect("/login")
  }

  const decoded = verifyToken(token)

  if (!decoded) {
    redirect("/login")
  }

  const display = decoded.displayName || decoded.name
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">
        Welcome {display}
      </h1>
      <p className="mt-4 text-gray-600">
        This is your reimbursement dashboard.
      </p>
    </div>
  )
}