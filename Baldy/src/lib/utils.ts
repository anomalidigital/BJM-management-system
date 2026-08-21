/** Penggabung className ringan (tanpa dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** Normalisasi teks untuk pencarian bebas huruf besar/kecil dan spasi. */
export function norm(v: unknown): string {
  return String(v ?? '').toLowerCase().trim()
}

/** Cari kata kunci di beberapa field sekaligus (semua token harus cocok). */
export function matchesQuery(query: string, ...fields: unknown[]): boolean {
  const q = norm(query)
  if (!q) return true
  const haystack = fields.map(norm).join(' ')
  return q.split(/\s+/).every((token) => haystack.includes(token))
}

export type SortDir = 'asc' | 'desc'

export function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a ?? '').localeCompare(String(b ?? ''), 'id', { numeric: true, sensitivity: 'base' })
}

export function sortRows<T>(rows: T[], key: keyof T | null, dir: SortDir): T[] {
  if (!key) return rows
  const sorted = [...rows].sort((a, b) => compareValues(a[key], b[key]))
  return dir === 'asc' ? sorted : sorted.reverse()
}

export function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + (pick(row) || 0), 0)
}

export function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const row of rows) {
    const k = key(row)
    if (!out[k]) out[k] = []
    out[k].push(row)
  }
  return out
}

/** Unduh string sebagai file (dipakai di halaman Tools). */
export function downloadFile(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
