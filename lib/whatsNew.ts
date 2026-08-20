// Dashboard "what's new" content, shown via app/components/WhatsNewCard.tsx.
// Bump `version` whenever the copy changes — that's what re-surfaces the card
// for everyone who already dismissed an older version (see the component's
// localStorage key, which is namespaced by role + this version string).
export const WHATS_NEW: Record<string, { version: string; heading: string; items: string[] }> = {
  nurse: {
    version: '2026-08-19',
    heading: 'New for Nurses',
    items: [
      'Digital Progress Notes — chart from any device and sign electronically',
      'Rx reminders — never miss a refill window',
      'License & credential renewal reminders',
      'Secure document storage',
    ],
  },
  guardian: {
    version: '2026-08-19',
    heading: 'New for Families',
    items: [
      'Rx reminders — never miss a refill window',
      'Care team scheduling — coordinate shifts and appointments directly',
    ],
  },
}
