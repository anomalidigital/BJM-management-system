/**
 * Komisi otomatis.
 *
 * Satu-satunya sumber aturan adalah master Komisi. Tiap trip mencari aturan
 * yang paling cocok (peran, layanan, konfigurasi kendaraan), mengambil nilai
 * dasarnya, lalu memilih tingkat yang sesuai.
 *
 * Penulisan tingkat mengikuti catatan meeting: "1 jt – 10 jt", "11 jt – 20 jt".
 * Nilai di antara dua tingkat (mis. 10,5 jt) ikut tingkat berikutnya, dan nilai
 * di bawah tingkat pertama tidak mendapat komisi.
 */
import type { CommissionScheme, CommissionTier, EmployeeRole, ServiceType } from '../types'
import { formatRupiah } from './format'

/** "6X6 DL" -> ["6X6", "DL"]: satu kendaraan bisa punya beberapa konfigurasi. */
export const tokenKonfigurasi = (konfigurasi: string) =>
  konfigurasi.toUpperCase().split(/[\s,/+]+/).filter(Boolean)

export function cariTingkat(tiers: CommissionTier[], nilai: number): CommissionTier | null {
  const urut = [...tiers].sort((a, b) => a.target_awal - b.target_awal)
  if (urut.length === 0 || nilai <= 0 || nilai < urut[0].target_awal) return null
  return urut.find((t) => t.target_akhir === 0 || nilai <= t.target_akhir) ?? null
}

export const nilaiTingkat = (t: CommissionTier, dasar: number) =>
  t.commission_unit === 'persen' ? Math.round((dasar * t.commission) / 100) : t.commission

export const tulisRentang = (t: CommissionTier) =>
  t.target_akhir > 0 ? `${formatRupiah(t.target_awal)} – ${formatRupiah(t.target_akhir)}` : `≥ ${formatRupiah(t.target_awal)}`

/**
 * Aturan yang berlaku untuk satu trip. Yang menyebut jenis kendaraan lebih
 * diutamakan daripada yang berlaku umum, begitu juga layanan yang spesifik.
 * Aturan berdasar nilai kontrak dihitung per kontrak, jadi tidak ikut di sini.
 */
export function pilihAturan(
  aturan: CommissionScheme[],
  p: { role: EmployeeRole; layanan: ServiceType; konfigurasi: string },
): CommissionScheme | null {
  const token = new Set(tokenKonfigurasi(p.konfigurasi))
  let terbaik: CommissionScheme | null = null
  let skor = -1
  for (const s of aturan) {
    if (s.is_active === false || (s.role ?? 'sopir') !== p.role || s.basis === 'kontrak') continue
    const layanan = s.service_type ?? 'callout'
    if (layanan !== 'semua' && layanan !== p.layanan) continue
    const kendaraan = s.configurations ?? []
    if (kendaraan.length > 0 && !kendaraan.some((k) => token.has(k.toUpperCase()))) continue
    const nilai = (kendaraan.length > 0 ? 2 : 0) + (layanan !== 'semua' ? 1 : 0)
    if (nilai > skor) { terbaik = s; skor = nilai }
  }
  return terbaik
}

export interface HasilKomisi {
  nilai: number
  dasar: number
  aturan: CommissionScheme | null
  tingkat: CommissionTier | null
  keterangan: string
}

export interface DataTripKomisi {
  cost_value: number
  route_price: number
  ujroute: number
  uj_total: number
}

/** Nilai dasar sebelum potongan, sesuai dasar hitung aturan. */
export function dasarTrip(basis: CommissionScheme['basis'], t: DataTripKomisi): number {
  if (basis === 'uj') return t.ujroute || t.uj_total
  if (basis === 'nilai') return t.cost_value || t.route_price
  return 0
}

/** Terapkan satu aturan ke satu nilai dasar (dipakai trip, kontrak, dan simulasi). */
export function terapkan(aturan: CommissionScheme, dasarKotor: number): HasilKomisi {
  const potong = aturan.base_deduction_pct ?? 0
  const dasar = Math.round(dasarKotor * (1 - potong / 100))
  const tingkat = cariTingkat(aturan.tiers ?? [], dasar)
  if (!dasarKotor) return { nilai: 0, dasar: 0, aturan, tingkat: null, keterangan: `${aturan.name}: nilai dasar belum ada` }
  if (!tingkat) return { nilai: 0, dasar, aturan, tingkat: null, keterangan: `${aturan.name}: di bawah tingkat pertama` }
  const potongTeks = potong ? ` setelah potong ${String(potong).replace('.', ',')}%` : ''
  return {
    nilai: nilaiTingkat(tingkat, dasar),
    dasar,
    aturan,
    tingkat,
    keterangan: `${aturan.name} · dasar ${formatRupiah(dasar)}${potongTeks} · tingkat ${tulisRentang(tingkat)}`,
  }
}

export function hitungKomisiTrip(
  aturan: CommissionScheme[],
  p: { role: EmployeeRole; layanan: ServiceType; konfigurasi: string } & DataTripKomisi,
): HasilKomisi {
  const s = pilihAturan(aturan, p)
  if (!s) {
    const keterangan = p.konfigurasi.trim()
      ? `Belum ada aturan komisi untuk kendaraan ${p.konfigurasi.trim()}`
      : 'Konfigurasi kendaraan belum diisi di Data Mobil, jadi aturan komisi belum bisa dipilih'
    return { nilai: 0, dasar: 0, aturan: null, tingkat: null, keterangan }
  }
  return terapkan(s, dasarTrip(s.basis, p))
}

/** Komisi kontrak Dedicated, mis. (nilai kontrak − 5%) × 2,5%. */
export function hitungKomisiKontrak(aturan: CommissionScheme[], nilaiKontrak: number): HasilKomisi | null {
  const s = aturan.find((a) => a.is_active !== false && a.basis === 'kontrak' && (a.service_type ?? 'dedicated') !== 'callout')
  return s ? terapkan(s, nilaiKontrak) : null
}
