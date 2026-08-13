// CARC codes are stored as text ("1".."308", but also alphanumeric ones like
// "A1"-"A8", "P1"-"P32") since some aren't pure numbers — a plain string sort
// puts "10" before "2", which reads badly in a scanned reference list. Sorts
// by letter-prefix first, then the numeric part, so "2" < "10" and "A2" < "A10".
export function compareCarcCodes(a: string, b: string): number {
  const parse = (s: string) => {
    const m = s.match(/^([A-Za-z]*)(\d+)/)
    return m ? { prefix: m[1], num: parseInt(m[2], 10) } : { prefix: s, num: 0 }
  }
  const pa = parse(a)
  const pb = parse(b)
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
  return pa.num - pb.num
}

export function sortByCarcCode<T extends { code: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareCarcCodes(a.code, b.code))
}
