import Link from 'next/link'

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { success?: string }
}) {
  const success = searchParams.success === '1'

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md w-full text-center">
        {success ? (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#2F3E4E] mb-2">You&apos;ve been unsubscribed</h1>
            <p className="text-sm text-[#7A8F79] mb-6">
              You will no longer receive weekly hour submission reminders. You can re-enable notifications anytime from your profile page.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[#2F3E4E] mb-2">Invalid Link</h1>
            <p className="text-sm text-[#7A8F79] mb-6">
              This unsubscribe link is invalid or has already been used.
            </p>
          </>
        )}
        <Link
          href="/login"
          className="inline-block bg-[#2F3E4E] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
        >
          Go to Portal
        </Link>
      </div>
    </div>
  )
}
