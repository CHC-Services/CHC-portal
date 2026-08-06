// Patient.dob is stored as a plain "YYYY-MM-DD" string, not a Date column.
export function calculateAge(dob: string): number | null {
  const [y, m, d] = dob.split('-').map(Number)
  if (!y || !m || !d) return null

  const today = new Date()
  let age = today.getFullYear() - y
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d)
  if (!hasHadBirthdayThisYear) age--
  return age
}
