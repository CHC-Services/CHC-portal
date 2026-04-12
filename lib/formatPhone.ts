/**
 * Formats any phone string as (XXX) XXX-XXXX.
 * Strips all non-digits first, so "123-456-7890", "1234567890",
 * "+11234567890", etc. all produce "(123) 456-7890".
 * Returns an empty string for null/undefined/empty input.
 */
export function fmtPhone(val: string | null | undefined): string {
  if (!val) return ''
  const d = val.replace(/\D/g, '')
  // Strip leading country code "1" if 11 digits
  const digits = d.length === 11 && d[0] === '1' ? d.slice(1) : d
  if (digits.length === 0) return ''
  if (digits.length <= 3)  return `(${digits}`
  if (digits.length <= 6)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`
}

/**
 * Auto-formats a phone input value as the user types.
 * Use in onChange handlers: setPhone(fmtPhoneInput(e.target.value))
 */
export function fmtPhoneInput(val: string): string {
  return fmtPhone(val)
}
