/** Formatter khusus Indonesia (Rupiah, tanggal dd/mm/yyyy, angka ribuan). */

const NBSP = ' '

export function formatRupiah(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  if (opts?.compact) return `Rp${NBSP}${compactNumber(value)}`
  return `Rp${NBSP}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
}

/** 12500000 -> "12,5 jt" ; 1284 -> "1.284" ; 4200000000 -> "4,2 M" */
export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const trim = (n: number) => n.toFixed(n % 1 === 0 ? 0 : 1).replace('.', ',')
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)}${NBSP}M`
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}${NBSP}jt`
  if (abs >= 10_000) return `${sign}${trim(abs / 1_000)}${NBSP}rb`
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
}

/** "2026-08-01" -> "01/08/2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return '-'
  return `${d}/${m}/${y}`
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** "2026-08-01" -> "1 Agustus 2026" */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '-'
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "2026-08-01" -> "1 Agu" */
export function formatDateShort(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

/** Tanggal + jam untuk footer "Dicetak pada" */
export function formatPrintedAt(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Input currency: "12.500.000" -> 12500000 */
export function parseCurrencyInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

/** 12500000 -> "12.500.000" (untuk ditampilkan di dalam input) */
export function currencyInputValue(value: number | ''): string {
  if (value === '' || value === null || value === undefined) return ''
  return new Intl.NumberFormat('id-ID').format(value)
}

export function toISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayISO = (): string => toISO(new Date())

export function startOfMonthISO(ref = new Date()): string {
  return toISO(new Date(ref.getFullYear(), ref.getMonth(), 1))
}

export function endOfMonthISO(ref = new Date()): string {
  return toISO(new Date(ref.getFullYear(), ref.getMonth() + 1, 0))
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function daysBetween(fromISO: string, toISOStr: string): string[] {
  const out: string[] = []
  let cur = fromISO
  let guard = 0
  while (cur <= toISOStr && guard++ < 400) {
    out.push(cur)
    cur = addDaysISO(cur, 1)
  }
  return out
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}
