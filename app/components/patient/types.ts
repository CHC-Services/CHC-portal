// Canonical patient field shape shared by admin/nurse/family detail views.
// Nurse's version is a merge of canonical Patient fields + that nurse's JSON
// overrides — same key names either way, so all three roles can hand this
// exact shape to the shared components regardless of source.
export type PatientFields = {
  firstName: string
  lastName: string
  accountNumber: string
  dob: string
  gender: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  isMinor?: boolean
  guardianFirstName: string | null
  guardianLastName: string | null
  guardianEmail: string | null
  guardianPhone: string | null
  guardianRelationship: string | null
  linkedSpecialties?: string[]
  highTech: boolean
  insuranceType: string
  insuranceId: string
  insuranceName: string | null
  insuranceGroup: string | null
  insurancePlan: string | null
  subscriberName: string | null
  subscriberRelation: string | null
  networkStatus: string | null
  hasCaseRate: boolean
  caseRateAmount: string | null
  policyNotes: string | null
  ins2Type: string | null
  ins2Id: string | null
  ins2Name: string | null
  ins2Group: string | null
  ins2Plan: string | null
  ins2SubscriberName: string | null
  ins2SubscriberRelation: string | null
  ins2NetworkStatus: string | null
  ins2HasCaseRate: boolean
  ins2CaseRateAmount: string | null
  ins2PolicyNotes: string | null
  dxCode1: string | null
  dxCode2: string | null
  dxCode3: string | null
  dxCode4: string | null
  paNumber: string | null
  paStartDate: string | null
  paEndDate: string | null
  isLocked?: boolean
  lockedAt?: string | null
  lockedBy?: string | null
  documentRemindersEnabled?: boolean
  paRemindersEnabled?: boolean
  // Not a canonical Patient field — lives on the current viewer's own
  // NursePatient/GuardianPatient link, mixed into this shape for convenience.
  medicationRemindersOptIn?: boolean
}

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

export const SUBSCRIBER_RELATIONS = ['Self', 'Spouse', 'Child', 'Parent', 'Other']

export const GUARDIAN_RELATIONSHIPS = [
  'Parent', 'Grandparent', 'Sibling', 'Child', 'Other Family', 'Friend',
  'Legal Guardian', 'Volunteer Caregiver', 'Power of Attorney',
]

export const MEDICAL_SPECIALTIES = [
  'Allergy & Immunology', 'Anesthesiology', 'Cardiology', 'Cardiothoracic Surgery',
  'Dermatology', 'Emergency Medicine', 'Endocrinology', 'Family Medicine',
  'Gastroenterology', 'General Surgery', 'Geriatrics', 'Hematology',
  'Hospice & Palliative Care', 'Infectious Disease', 'Internal Medicine',
  'Nephrology', 'Neurology', 'Neurosurgery', 'Obstetrics & Gynecology',
  'Occupational Therapy', 'Oncology', 'Ophthalmology', 'Orthopedics',
  'Otolaryngology (ENT)', 'Pain Management', 'Pediatrics',
  'Physical Medicine & Rehabilitation', 'Physical Therapy', 'Podiatry',
  'Psychiatry', 'Pulmonology', 'Radiology', 'Rheumatology',
  'Speech-Language Pathology', 'Urology', 'Wound Care',
]

export const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
export const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'
