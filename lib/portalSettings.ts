export type DashboardSection = 'account' | 'reimbursement' | 'claims' | 'hours' | 'documents'

export const DASHBOARD_SECTION_LABELS: Record<DashboardSection, string> = {
  account:       'Account Summary',
  reimbursement: 'Reimbursement Summary',
  claims:        'Count Summary',
  hours:         'Hours Summary',
  documents:     'Documents Summary',
}

export type PortalSettings = {
  fontSize: 'xs' | 'sm' | 'md' | 'lg'
  gutterColor: string
  density: 'compact' | 'default' | 'relaxed'
  radius: 'sharp' | 'default' | 'rounded'
  elevation: 'flat' | 'default' | 'raised'
  dashboardOrder: DashboardSection[]
}

export const DEFAULTS: PortalSettings = {
  fontSize: 'md',
  gutterColor: '#2F3E4E',
  density: 'default',
  radius: 'default',
  elevation: 'default',
  dashboardOrder: ['account', 'reimbursement', 'claims', 'hours', 'documents'],
}

export const FONT_SIZE_MAP: Record<PortalSettings['fontSize'], string> = {
  xs: '12px',
  sm: '13px',
  md: '14px',
  lg: '15px',
}

export const GUTTER_COLORS = [
  { label: 'Navy',      value: '#2F3E4E' },
  { label: 'Deep Sage', value: '#4A5B47' },
  { label: 'Slate',     value: '#3D4D5C' },
  { label: 'Charcoal',  value: '#2A2E35' },
  { label: 'Espresso',  value: '#3C3028' },
  { label: 'Maroon',    value: '#6B2737' },
]

export const RADIUS_MAP: Record<PortalSettings['radius'], string> = {
  sharp:   '6px',
  default: '12px',
  rounded: '20px',
}

export const ELEVATION_MAP: Record<PortalSettings['elevation'], string> = {
  flat:    'none',
  default: '0 2px 14px rgba(47,62,78,0.07), 0 1px 4px rgba(47,62,78,0.04)',
  raised:  '0 8px 30px rgba(47,62,78,0.14), 0 2px 8px rgba(47,62,78,0.08)',
}

const STORAGE_KEY = 'chc_portal_settings'

export function loadSettings(): PortalSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(s: PortalSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function applySettings(s: PortalSettings) {
  const root = document.documentElement
  root.style.fontSize = FONT_SIZE_MAP[s.fontSize]
  root.style.setProperty('--portal-gutter', s.gutterColor)
  root.style.setProperty('--portal-radius', RADIUS_MAP[s.radius])
  root.style.setProperty('--portal-elevation', ELEVATION_MAP[s.elevation])
  root.dataset.density = s.density
}
