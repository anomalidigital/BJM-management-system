/** Pembuat nomor & kode otomatis. */
import type { Driver, EmployeeRole } from '../types'

/** Huruf mati saja, supaya kode acak tidak membentuk kata. */
const KONSONAN = 'BCDFGHJKLMNPQRSTVWXYZ'

/**
 * Kode unik: 13 digit timestamp (Date.now) + 7 huruf mati acak, mis.
 * 1779754321123KDFRZMP. Timestamp menjaga urutan waktu, huruf acak menambah
 * keunikan; bila (sangat jarang) sudah dipakai, dibuat ulang.
 * Dipakai tombol Generate pada No. Route dan ID Perjalanan/Trip.
 */
export function buatKodeUnik(terpakai: Iterable<string> = []): string {
  const ada = new Set([...terpakai].map((k) => k.toUpperCase()))
  for (;;) {
    const text = Array.from({ length: 7 }, () => KONSONAN[Math.floor(Math.random() * KONSONAN.length)]).join('')
    const kode = Date.now() + text
    if (!ada.has(kode)) return kode
  }
}

/** Nomor berurut berawalan tetap: INV-001, FK-0001, KLN001. */
export function nomorBerurut(awalan: string, nomorAda: Iterable<string>, digit: number): string {
  let maks = 0
  for (const n of nomorAda) {
    if (n.toUpperCase().startsWith(awalan)) maks = Math.max(maks, Number(n.slice(awalan.length).replace(/\D/g, '')) || 0)
  }
  return `${awalan}${String(maks + 1).padStart(digit, '0')}`
}

/**
 * Kode klien: singkatan nama (PT Sumber Pangan Dingin -> SPD, Atlas -> ATLAS),
 * dijamin unik; KLN001 dan seterusnya bila nama belum diisi.
 */
export function kodeKlienBerikut(nama: string, terpakai: Iterable<string>): string {
  const daftar = [...terpakai]
  const ada = new Set(daftar.map((k) => k.toUpperCase()))
  const kata = nama.toUpperCase().split(/[^A-Z0-9]+/).filter((k) => k && !['PT', 'CV', 'UD', 'TBK'].includes(k))
  const dasar = (kata.length > 1 ? kata.map((k) => k[0]).join('') : kata[0] ?? '').slice(0, 5)
  if (!dasar) return nomorBerurut('KLN', daftar, 3)
  let kode = dasar
  for (let i = 2; ada.has(kode); i++) kode = `${dasar}${i}`
  return kode
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
