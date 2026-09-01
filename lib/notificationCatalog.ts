// Single source of truth for "who gets what" across every automated
// email/SMS notification the site sends. Purely a reference — targeting
// itself lives in each cron/route (link tables, role checks, opt-in toggles),
// not here. Exists so the next role added to the portal doesn't silently
// inherit a notification meant for a different one, and so this doesn't have
// to be re-derived from cron code every time someone asks "who gets this."
// Audited/built 2026-08-26 after the weekly-reminder role-leak fix
// (app/api/cron/weekly-reminder/route.ts) — keep this in sync when a
// notification's targeting changes.

export type NotificationChannel = 'email' | 'sms'

export type NotificationCatalogEntry = {
  id: string
  label: string
  channel: NotificationChannel
  trigger: string
  targets: string
  enabledBy: string | null
  sourceFiles: string[]
  // Toggles that exist but have no code path that actually sends anything —
  // flagged rather than hidden, so they don't read as a mystery in the UI.
  unwired?: boolean
}

export const NOTIFICATION_CATALOG: NotificationCatalogEntry[] = [
  {
    id: 'weekly-hours-reminder',
    label: 'Weekly Hours Reminder',
    channel: 'email',
    trigger: 'Cron — weekly (configurable day, default Friday)',
    targets: 'Nurse only',
    enabledBy: 'NurseProfile.receiveNotifications',
    sourceFiles: ['app/api/cron/weekly-reminder/route.ts'],
  },
  {
    id: 'nurse-document-expiration',
    label: 'Nurse License / Certification Expiration',
    channel: 'email',
    trigger: 'Cron — daily',
    targets: 'Nurse only',
    enabledBy: 'NurseDocument.reminderDays thresholds',
    sourceFiles: ['app/api/cron/document-reminders/route.ts'],
  },
  {
    id: 'patient-document-expiration',
    label: 'Patient Document Expiration',
    channel: 'email',
    trigger: 'Cron — daily',
    targets: 'Nurse + Guardian linked to that patient',
    enabledBy: 'Patient.documentRemindersEnabled',
    sourceFiles: ['app/api/cron/document-reminders/route.ts', 'lib/runPatientDocumentReminders.ts'],
  },
  {
    id: 'medication-refill-due',
    label: 'Medication Refill Due',
    channel: 'sms',
    trigger: 'Cron — daily',
    targets: 'Nurse + Guardian linked to that patient',
    enabledBy: 'NursePatient/GuardianPatient.medicationRemindersOptIn',
    sourceFiles: ['app/api/cron/medication-reminders/route.ts'],
  },
  {
    id: 'prior-auth-expiration',
    label: 'Prior Authorization Expiration',
    channel: 'sms',
    trigger: 'Cron — daily',
    targets: 'Nurse + Guardian linked to that patient',
    enabledBy: 'Patient.paRemindersEnabled',
    sourceFiles: ['app/api/cron/medication-reminders/route.ts'],
  },
  {
    id: 'weekly-unbilled-hours-digest',
    label: 'Weekly Unbilled Hours Digest',
    channel: 'sms',
    trigger: 'Cron — weekly (Wednesday)',
    targets: 'Admin only',
    enabledBy: null,
    sourceFiles: ['app/api/cron/hours-summary/route.ts', 'lib/runHoursAlerts.ts'],
  },
  {
    id: 'new-claim-alert',
    label: 'New Claim Status Alert',
    channel: 'email',
    trigger: 'Queued on claim activity, flushed ~30 min later or by daily cron backstop',
    targets: 'Nurse only',
    enabledBy: 'NurseProfile.notifyNewClaim',
    sourceFiles: ['lib/flushNurseNotifications.ts', 'app/api/cron/notification-flush/route.ts'],
  },
  {
    id: 'new-document-alert',
    label: 'New Document Alert',
    channel: 'email',
    trigger: 'Queued on document upload, flushed ~30 min later or by daily cron backstop',
    targets: 'Nurse only',
    enabledBy: 'NurseProfile.notifyNewDocument',
    sourceFiles: ['lib/flushNurseNotifications.ts', 'app/api/admin/documents/route.ts', 'app/api/admin/documents/confirm/route.ts'],
  },
  {
    id: 'new-message',
    label: 'New Message',
    channel: 'email',
    trigger: 'Inline, on message send',
    targets: 'Whoever the message is addressed to — any role',
    enabledBy: 'User.notifyNewMessage',
    sourceFiles: ['lib/messaging.ts'],
  },
  {
    id: 'partial-shift-claimed',
    label: 'Partial Shift Claimed (email + SMS)',
    channel: 'email',
    trigger: 'Inline, on a partial open-shift claim finalizing (immediate claim, or an approved request)',
    targets: 'Claiming nurse + Guardians (approved) linked to that patient + Admins (interim testing cc)',
    enabledBy: 'User.notifyPartialShiftClaim (admin cc only — interim, see code comment)',
    sourceFiles: ['lib/shiftClaimNotify.ts', 'lib/shiftSplit.ts', 'app/api/nurse/shifts/[id]/claim-portion/route.ts'],
  },
  {
    id: 'partial-shift-request',
    label: 'Partial Shift Request — needs approval (email + SMS)',
    channel: 'email',
    trigger: 'Inline, on a partial claim request when Patient.partialShiftClaimsRequireApproval is on',
    targets: 'Guardians (approved) linked to that patient + Admins (interim testing cc)',
    enabledBy: 'Patient.partialShiftClaimsRequireApproval; User.notifyPartialShiftClaim for the admin cc',
    sourceFiles: ['lib/shiftClaimNotify.ts', 'app/api/nurse/shifts/[id]/claim-portion/route.ts'],
  },
  {
    id: 'partial-shift-rejected',
    label: 'Partial Shift Request Rejected (email + SMS)',
    channel: 'email',
    trigger: 'Inline, on a guardian/admin rejecting a pending request, or an approval auto-rejecting because the time is no longer available',
    targets: 'Requesting nurse only',
    enabledBy: null,
    sourceFiles: ['lib/shiftClaimNotify.ts', 'app/api/patient/[id]/shift-claim-requests/[requestId]/route.ts'],
  },
  {
    id: 'billing-reminder-unwired',
    label: 'Billing Reminder',
    channel: 'email',
    trigger: '— not currently sent —',
    targets: 'Nobody — toggle exists in nurse profile settings but has no consumer',
    enabledBy: 'NurseProfile.notifyBillingReminder',
    sourceFiles: ['app/api/nurse/profile/route.ts'],
    unwired: true,
  },
  {
    id: 'doc-expiring-unwired',
    label: 'Doc Expiring',
    channel: 'email',
    trigger: '— not currently sent —',
    targets: 'Nobody — toggle exists in nurse profile settings but has no consumer',
    enabledBy: 'NurseProfile.notifyDocExpiring',
    sourceFiles: ['app/api/nurse/profile/route.ts'],
    unwired: true,
  },
]
