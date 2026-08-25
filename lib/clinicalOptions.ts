// Shared dropdown option lists for the Vitals/Intake-Output flowsheet fields
// — single source of truth for app/components/QuickNoteForm.tsx,
// app/components/patient/ProgressNoteForm.tsx, and lib/bedrockClient.ts
// (which constrains the AI compile step's extraction to these exact values).
// Update here once; all three stay in sync automatically.
export const O2_ROUTES = ['AirVo', 'HME', 'O2 Tank', 'Passy Muir', 'POC', 'Vent', 'Room Air', 'Manual/Bag', 'Other']
export const TX_NEEDED = ['Yes', 'No']
export const INTAKE_ROUTES = ['Oral', 'G-Tube', 'J-Tube', 'GJ-Split', 'NG-Tube', 'IV']
// Standard CMS Place of Service codes relevant to home health/private duty
// visits, stored as the full "<code> - <description>" string (matches
// billing convention — e.g. "12 - Home"). Flag to Alex: this is a curated
// subset of the official CMS POS list, not the full ~50-code set — add more
// here if a visit type comes up that isn't covered.
export const PLACES_OF_SERVICE = ['03 - School', '04 - Homeless Shelter', '09 - Prison Facility', '11 - Office', '12 - Home', '13 - Assisted Living', '14 - Group Home', '99 - Other POS']

