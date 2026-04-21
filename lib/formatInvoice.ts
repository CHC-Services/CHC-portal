// CHC-2026-0042 → 26-0042  (strips the "CHC-YY" prefix for display)
export function shortInvoiceNumber(n: string): string {
  return n.replace(/^CHC-\d{2}/, '')
}
