/** Pembuat nomor & kode otomatis. */
import type { Driver, EmployeeRole } from '../types'

const hurufSaja = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * No. Route dari nama route, mengikuti pola kode lama: 4 huruf pertama asal +
 * 4 huruf pertama tujuan. "CIB - DURI" -> CIBDURI, "REBONJARO - DEPO MITRA" ->
 * REBODEPO. Bila sudah dipakai, diberi angka di belakang: CIBDURI2, CIBDURI3.
 * Keunikan route tetap dijamin id internalnya; kode ini untuk dibaca orang.
 */
export function kodeRouteDariNama(nama: string, terpakai: Iterable<string> = []): string {
  const ada = new Set([...terpakai].map((k) => k.toUpperCase()))
  const bagian = nama.split(/\s[-–]\s|-/).map((b) => hurufSaja(b)).filter(Boolean)
  const dasar = bagian.length >= 2 ? bagian[0].slice(0, 4) + bagian[1].slice(0, 4) : hurufSaja(nama).slice(0, 8)
  if (!dasar) return ''
  if (!ada.has(dasar)) return dasar
  for (let i = 2; ; i++) if (!ada.has(`${dasar}${i}`)) return `${dasar}${i}`
}

/** Awalan kode karyawan per peran: SPR001, MGR001. */
export const AWALAN_KARYAWAN: Record<EmployeeRole, string> = { sopir: 'SPR', manager: 'MGR' }

export function kodeKaryawanBerikut(karyawan: Pick<Driver, 'driver_code'>[], role: EmployeeRole): string {
  const awalan = AWALAN_KARYAWAN[role]
  const maks = karyawan
    .filter((d) => d.driver_code.toUpperCase().startsWith(awalan))
    .reduce((acc, d) => Math.max(acc, Number(d.driver_code.replace(/\D/g, '')) || 0), 0)
  return `${awalan}${String(maks + 1).padStart(3, '0')}`
}

/** Nomor trip berikutnya untuk bulan tanggal itu: YYYYMM + 4 digit urut. */
export function nomorTripBerikut(nomorAda: Iterable<string>, tanggalIso: string): string {
  const ym = tanggalIso.slice(0, 4) + tanggalIso.slice(5, 7)
  let maks = 0
  for (const n of nomorAda) if (n.startsWith(ym)) maks = Math.max(maks, Number(n.slice(6)) || 0)
  return `${ym}${String(maks + 1).padStart(4, '0')}`
}

/** Nomor Surat Jalan berikutnya: SJ-000001 berurutan. */
export function nomorSuratJalanBerikut(nomorAda: Iterable<string>): string {
  let maks = 0
  for (const n of nomorAda) {
    const v = Number(n.replace(/\D/g, ''))
    if (Number.isFinite(v)) maks = Math.max(maks, v)
  }
  return `SJ-${String(maks + 1).padStart(6, '0')}`
}

/** Nomor kontrak berikutnya per tahun: KTR-2026-001. */
export function nomorKontrakBerikut(nomorAda: Iterable<string>, tahun: string): string {
  const awalan = `KTR-${tahun}-`
  let maks = 0
  for (const n of nomorAda) if (n.startsWith(awalan)) maks = Math.max(maks, Number(n.slice(awalan.length)) || 0)
  return `${awalan}${String(maks + 1).padStart(3, '0')}`
}
