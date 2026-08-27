import Link from 'next/link'
import { NOTIFICATION_CATALOG } from '../../../../lib/notificationCatalog'

const CHANNEL_LABEL: Record<string, string> = { email: '📧 Email', sms: '💬 SMS' }

// Read-only reference, not a settings surface — targeting is inherent to
// which link table or role each notification is queried through, not
// something to make freely reassignable here. See lib/notificationCatalog.ts.
export default function NotificationsCatalogPage() {
  const active = NOTIFICATION_CATALOG.filter(n => !n.unwired)
  const unwired = NOTIFICATION_CATALOG.filter(n => n.unwired)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/comms" className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">💬 Comms</Link>
        <span className="text-[#7A8F79] text-sm">/</span>
        <span className="text-sm text-[#2F3E4E] font-semibold">Notifications</span>
      </div>
      <h1 className="text-3xl font-bold text-[#2F3E4E] mb-1">
        <span className="text-[#7A8F79] italic">ad</span>Notifications
      </h1>
      <p className="text-sm text-[#7A8F79] mb-8 max-w-2xl">
        Every automated email/SMS the site currently sends, and exactly which user type(s) receive it — a reference,
        not a settings page. Targeting comes from role checks and per-patient link tables in the code itself.
      </p>

      <div className="max-w-6xl bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F4F6F5] text-left text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">
                <th className="px-4 py-3">Notification</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Who Gets It</th>
                <th className="px-4 py-3">Opt-in / Toggle</th>
              </tr>
            </thead>
            <tbody>
              {active.map(n => (
                <tr key={n.id} className="border-t border-[#D9E1E8] align-top">
                  <td className="px-4 py-3 font-semibold text-[#2F3E4E]">{n.label}</td>
                  <td className="px-4 py-3 text-[#7A8F79] whitespace-nowrap">{CHANNEL_LABEL[n.channel] || n.channel}</td>
                  <td className="px-4 py-3 text-[#7A8F79]">{n.trigger}</td>
                  <td className="px-4 py-3 text-[#2F3E4E]">{n.targets}</td>
                  <td className="px-4 py-3 text-[#7A8F79] font-mono text-xs">{n.enabledBy || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unwired.length > 0 && (
        <div className="max-w-6xl bg-white rounded-2xl shadow-sm p-6 mt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Configured but not active</p>
          <p className="text-xs text-[#7A8F79] leading-relaxed mb-3">
            These toggles are visible in the nurse profile settings UI but nothing in the codebase currently reads
            them — turning them on or off has no effect yet.
          </p>
          <div className="space-y-1.5">
            {unwired.map(n => (
              <p key={n.id} className="text-xs text-[#7A8F79]">
                <span className="font-semibold text-[#2F3E4E]">{n.label}</span> — <span className="font-mono">{n.enabledBy}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
