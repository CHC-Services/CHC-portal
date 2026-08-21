import type { Metadata } from 'next'

// A nurse who already has the main portal saved to her home screen would
// otherwise get an identical-looking second icon for this shortcut (icons
// are inherited from the root layout by default) — no way to tell "logs me
// in normally" apart from "skips straight to Micro-Charting, no login."
// This overrides both the icon and the home-screen label for just this
// route so the two are visually distinct, and enables standalone/full-screen
// mode so launching from the home screen icon doesn't show browser chrome.
export const metadata: Metadata = {
  title: 'Micro-Charting',
  appleWebApp: {
    title: 'Micro-Charting',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/quick-notes-touch-icon.png',
    apple: '/quick-notes-touch-icon.png',
  },
}

export default function QuickNotesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
