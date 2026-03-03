// temporary debug page to inspect auth token
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export default async function DebugPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  let decoded = null
  if (token) decoded = verifyToken(token)

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Debug</h1>
      <p>auth_token cookie: {token || '(none)'}</p>
      <p>decoded: {decoded ? JSON.stringify(decoded) : '(invalid)'}</p>
      <pre>all cookies: {JSON.stringify(cookieStore.getAll())}</pre>
    </div>
  )
}
