/**
 * Aturan kecil seputar trip Karawang yang dipakai banyak halaman: TR, lokasi
 * muat & bongkar, backload, ATA, dan nomor PI.
 */
import type { CommissionTransaction, ItemMuatan, OperationalExpense, Route, TripEvent, UjPayment } from '../types'
import { BIAYA_DITAGIHKAN } from '../types'
import { kodeUnikDari } from './kode'

/** ID Perjalanan pertama trip (item muatan pertama yang ber-ID, atau trip_ids data lama). */
export const idPerjalanan = (t: Pick<CommissionTransaction, 'trip_ids'> & Partial<Pick<CommissionTransaction, 'muatan'>>): string =>
  (t.muatan ?? []).map((m) => m.id_perjalanan.trim()).find(Boolean) ?? (t.trip_ids ?? []).find(Boolean) ?? ''

/**
 * Penanda trip yang dibaca orang = Kode Trip (permintaan atasan 13 Okt 2026: "pakai kode trip"),
 * mis. 2026100001; backload 2026100001-BL. ID Perjalanan pindah ke Add Items Details.
 */
export const idTampil = (t: Pick<CommissionTransaction, 'transaction_no'>): string => t.transaction_no

/**
 * Add Items Details trip: isian `muatan`, atau untuk trip lama disusun dari ID Perjalanan
 * (trip_ids) dengan keterangan dari Jenis Barang.
 */
export function muatanTrip(t: Pick<CommissionTransaction, 'trip_ids' | 'goods_type'> & Partial<Pick<CommissionTransaction, 'muatan'>>): ItemMuatan[] {
  if (Array.isArray(t.muatan)) return t.muatan
  const ids = (t.trip_ids ?? []).filter(Boolean)
  const barang = (t.goods_type ?? '').trim()
  if (!ids.length) return barang ? [{ id_perjalanan: '', keterangan: barang }] : []
  return ids.map((id, i) => ({ id_perjalanan: id, keterangan: i === 0 ? barang : '' }))
}

/**
 * ID Perjalanan buatan sistem untuk trip lama (12 Okt 2026, saat ID Perjalanan masih penanda trip):
 * waktu = tanggal berangkat 08.00 WIB + urutan; huruf dari id trip. Kini penanda trip = Kode Trip,
 * jadi ID buatan ini dibuang saat migrasi (lihat buangIdPerjalananBuatan).
 */
function idPerjalananLama(t: Pick<CommissionTransaction, 'id' | 'transaction_date' | 'transaction_no'>): string {
  const dasar = Date.parse(`${t.transaction_date || '2026-01-01'}T08:00:00+07:00`)
  const urut = Number(String(t.transaction_no ?? '').slice(-4)) || 0
  return kodeUnikDari((Number.isFinite(dasar) ? dasar : 0) + urut * 1000, t.id)
}

/**
 * Buang ID Perjalanan yang dulu dibuatkan sistem untuk trip lama (persis idPerjalananLama).
 * ID yang diketik / dibuat pengguna tetap.
 */
export function buangIdPerjalananBuatan<T extends Pick<CommissionTransaction, 'id' | 'transaction_date' | 'transaction_no' | 'trip_ids' | 'workspace'>>(trips: T[]): T[] {
  return trips.map((t) => {
    if (t.workspace !== 'karawang' || (t.trip_ids ?? []).length !== 1) return t
    return t.trip_ids[0] === idPerjalananLama(t) ? { ...t, trip_ids: [] } : t
  })
}

/** TR trip: daftar baru, atau satu TR data lama. */
export function trTrip(t: Pick<CommissionTransaction, 'tr_numbers' | 'tr_reference'>): string[] {
  if (Array.isArray(t.tr_numbers)) return t.tr_numbers.filter(Boolean)
  const lama = (t.tr_reference ?? '').trim()
  return lama ? [lama] : []
}

/** Rapikan satu nomor TR: tanpa spasi, huruf besar ("tr2600512595 " -> "TR2600512595"). */
export const rapikanTr = (v: string) => v.trim().toUpperCase().replace(/\s+/g, '')

/**
 * Kunci pembanding TR: dokumen SLB menulis "TR2600512595", rekap BJM dan Berita Acara
 * tulisan tangan menulis "2600512595". Keduanya nomor yang sama.
 */
export const kunciTr = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TR(?=\d)/, '')

/**
 * Uang dorong & uang pulang adalah uang untuk sopir, bukan nota pemakaian: catatan
 * lama yang tersimpan sebagai biaya operasional dipindahkan menjadi termin uang jalan
 * (jenis uang_dorong / uang_pulang) pada trip yang sama, tanpa potong kasbon.
 */
export function pindahkanUangKeTermin(
  expenses: OperationalExpense[],
  ujPayments: UjPayment[],
  transactions: Array<Pick<CommissionTransaction, 'id' | 'driver_id' | 'driver_ids'>>,
  stamp: string,
): { expenses: OperationalExpense[]; ujPayments: UjPayment[] } {
  const pindah = expenses.filter((e) => e.expense_type === 'Uang Dorong' || e.expense_type === 'Uang Pulang')
  if (pindah.length === 0) return { expenses, ujPayments }
  const sopir = new Map(transactions.map((t) => [t.id, t.driver_ids?.[0] || t.driver_id || '']))
  const urut = new Map<string, number>()
  for (const p of ujPayments) urut.set(p.trip_id, Math.max(urut.get(p.trip_id) ?? 0, p.sequence))
  const baru: UjPayment[] = pindah.map((e) => {
    const n = (urut.get(e.trip_id) ?? 0) + 1
    urut.set(e.trip_id, n)
    return {
      id: `uj-dari-${e.id}`, trip_id: e.trip_id, sequence: n, payment_date: e.expense_date,
      driver_id: sopir.get(e.trip_id) ?? '', jenis: e.expense_type === 'Uang Dorong' ? 'uang_dorong' : 'uang_pulang',
      uj_amount: e.amount, kasbon_deduction: 0, notes: e.notes, attachments: e.attachments ?? [],
      created_at: e.created_at ?? stamp, updated_at: stamp,
    }
  })
  return { expenses: expenses.filter((e) => !pindah.includes(e)), ujPayments: [...ujPayments, ...baru] }
}

/**
 * Nama rute di data asli selalu "ASAL - TUJUAN" (CIB - DURI, KRG - INF 1 - CIB BCKLD).
 * Asal = sebelum " - " pertama, tujuan = sisanya. Penanda rute backload ("BCKLD", juga
 * salah ketik "BKLD" di data asli) di ujung nama bukan bagian lokasi, jadi dibuang:
 * DURI - CIB BCKLD -> bongkar di CIB.
 */
export function lokasiRute(namaRute: string): { asal: string; tujuan: string } {
  const nama = namaRute.trim()
  const i = nama.indexOf(' - ')
  const tanpaPenanda = (v: string) => v.replace(/\s+(BCKLD|BKLD|BACKLOAD)$/i, '').trim()
  if (i < 0) return { asal: '', tujuan: tanpaPenanda(nama) }
  return { asal: nama.slice(0, i).trim(), tujuan: tanpaPenanda(nama.slice(i + 3)) }
}

/** Lokasi muat & bongkar trip: isian sendiri, atau turunan nama rute. */
export function lokasiTrip(t: Pick<CommissionTransaction, 'lokasi_muat' | 'lokasi_bongkar'>, namaRute: string) {
  const r = lokasiRute(namaRute)
  return { muat: (t.lokasi_muat ?? '').trim() || r.asal, bongkar: (t.lokasi_bongkar ?? '').trim() || r.tujuan }
}

/**
 * Kode area dari satu sisi nama rute: nomor site di ujung dibuang supaya site satu area
 * terkumpul ("RAWA 52" -> RAWA, "KB 575 1" -> KB 575, "BLSE (2)" -> BLSE, "AMJ 05" -> AMJ).
 */
export function normalKodeArea(v: string): string {
  return v.trim().toUpperCase().replace(/\s*\(\d+\)$/, '').replace(/\s+\d{1,2}$/, '').trim()
}

/** Kode area pick up & destinasi rute: isian di master Rute, atau turunan namanya. */
export function kodeAreaRute(r: Pick<Route, 'route_name' | 'kode_area_asal' | 'kode_area_tujuan'>): { asal: string; tujuan: string } {
  const l = lokasiRute(r.route_name ?? '')
  return {
    asal: (r.kode_area_asal ?? '').trim().toUpperCase() || normalKodeArea(l.asal),
    tujuan: (r.kode_area_tujuan ?? '').trim().toUpperCase() || normalKodeArea(l.tujuan),
  }
}

/**
 * Apakah trip ini masih menahan kendaraannya (aturan Baldy 12 Okt 2026): mobil yang sedang
 * dalam satu perjalanan tidak bisa dipilih trip lain sampai perjalanannya selesai dan mobil
 * kembali ke pool. Trip melepas kendaraannya bila batal, tercatat kembali di pool (pool_at
 * atau kejadian "Tiba di pool"), dilanjutkan backload / rute lanjutan (kendaraan pindah ke
 * trip lanjutan), atau trip lama dari rekap (selesai tanpa catatan Tutup Trip).
 */
export function menahanKendaraan(
  t: Pick<CommissionTransaction, 'vehicle_id' | 'status' | 'pool_at' | 'closed_at'>,
  sudahDiPool: boolean,
  adaLanjutan: boolean,
): boolean {
  if (!t.vehicle_id || t.status === 'batal') return false
  if (t.pool_at || sudahDiPool || adaLanjutan) return false
  if (t.status === 'selesai' && !t.closed_at) return false
  return true
}

/**
 * Nilai PI dibekukan saat PI dibuat (12 Okt 2026). Trip yang sudah ber-PI sebelum aturan ini
 * diberi nilai sekarang, sekali saat migrasi: harga trip (atau Harga rute) + biaya ditagihkan.
 */
export function bekukanNilaiPiLama<T extends CommissionTransaction>(trips: T[], routes: Pick<Route, 'id' | 'price'>[], expenses: OperationalExpense[]): T[] {
  if (!trips.some((t) => t.pi_tahap && !t.pi_nilai)) return trips
  const harga = new Map(routes.map((r) => [r.id, r.price ?? 0]))
  const tagih = new Map<string, number>()
  for (const e of expenses) if (biayaDitagihkan(e)) tagih.set(e.trip_id, (tagih.get(e.trip_id) ?? 0) + e.amount)
  return trips.map((t) => {
    if (!t.pi_tahap || t.pi_nilai) return t
    const pokok = t.status === 'batal' ? t.cancel_fee ?? 0 : (t.cost_value ?? 0) > 0 ? t.cost_value : harga.get(t.route_id) ?? 0
    const tambahan = t.status === 'batal' ? 0 : tagih.get(t.id) ?? 0
    return { ...t, pi_nilai: { pokok, tambahan, total: pokok + tambahan } }
  })
}

/** Sama tanpa beda huruf besar / spasi, untuk mencocokkan lokasi bongkar dengan asal rute. */
export const samaLokasi = (a: string, b: string) => !!a && a.trim().toUpperCase() === b.trim().toUpperCase()

/**
 * Kode trip backload = kode trip asal + "-BL" (alur atasan: "[ID TRIP] - BL"), jadi tetap unik
 * dan langsung terbaca asalnya. Backload kedua dari trip yang sama: -BL2.
 */
export function idBackload(idAsal: string, terpakai: Iterable<string>): string {
  const ada = new Set([...terpakai].map((x) => x.toUpperCase()))
  const dasar = `${idAsal || 'TRIP'}-BL`
  if (!ada.has(dasar.toUpperCase())) return dasar
  for (let i = 2; ; i++) if (!ada.has(`${dasar}${i}`.toUpperCase())) return `${dasar}${i}`
}

/** Kejadian perjalanan satu trip, urut waktu. */
export function kejadianTrip(events: TripEvent[], tripId: string): TripEvent[] {
  return events.filter((e) => e.trip_id === tripId).sort((a, b) => a.waktu.localeCompare(b.waktu) || a.created_at.localeCompare(b.created_at))
}

/** ATA = kejadian "Tiba di tujuan" pertama. */
export const ataDari = (urut: TripEvent[]) => urut.find((e) => e.jenis === 'tiba')?.waktu ?? ''

/** Biaya ini dibayar perusahaan langsung (bukan dari uang jalan sopir)? */
export const dibayarPerusahaan = (e: Pick<OperationalExpense, 'dibayar'>) => e.dibayar === 'perusahaan'

/**
 * Data lama tidak mencatat siapa yang membayar. Bila biaya satu trip melebihi seluruh
 * uang jalannya, biaya itu mustahil dari uang jalan: ditandai dibayar perusahaan.
 */
export function tandaiPembayarLama(expenses: OperationalExpense[], ujPayments: Array<Pick<UjPayment, 'trip_id' | 'uj_amount'>>): OperationalExpense[] {
  const uj = new Map<string, number>()
  for (const p of ujPayments) uj.set(p.trip_id, (uj.get(p.trip_id) ?? 0) + p.uj_amount)
  const biaya = new Map<string, number>()
  for (const e of expenses) biaya.set(e.trip_id, (biaya.get(e.trip_id) ?? 0) + e.amount)
  return expenses.map((e) => (e.dibayar || (biaya.get(e.trip_id) ?? 0) <= (uj.get(e.trip_id) ?? 0) ? e : { ...e, dibayar: 'perusahaan' as const }))
}

/** Biaya ini ikut ditagihkan ke klien? Isian per biaya, atau mengikuti jenisnya. */
export const biayaDitagihkan = (e: Pick<OperationalExpense, 'expense_type' | 'ditagihkan'>) =>
  e.ditagihkan ?? BIAYA_DITAGIHKAN.includes(e.expense_type)

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/**
 * Nomor PI berikutnya, mengikuti format Summary Submission PI: 0661/SLB/BJM/VIII/2026.
 * Urutan empat digit berlanjut terus (tidak mulai dari 1 tiap bulan), diambil dari
 * nomor PI yang sudah ada, termasuk data lama yang hanya berisi urutannya ("0473").
 */
export function nomorPiBerikut(nomorAda: Iterable<string>, kodeKlien: string, tanggalIso: string, tambahan = 0): string {
  let maks = 0
  for (const n of nomorAda) {
    const m = /^\s*(\d+)/.exec(n)
    if (m) maks = Math.max(maks, Number(m[1]))
  }
  const bulan = ROMAWI[Number(tanggalIso.slice(5, 7)) - 1] ?? 'I'
  const kode = (kodeKlien || 'KLIEN').toUpperCase()
  return `${String(maks + 1 + tambahan).padStart(4, '0')}/${kode}/BJM/${bulan}/${tanggalIso.slice(0, 4)}`
}

/** "2026-09-12T08:00" -> "12/09/2026 08:00". */
export function formatWaktu(waktu: string): string {
  if (!waktu) return '—'
  const [tgl, jam] = waktu.split('T')
  const [y, m, d] = tgl.split('-')
  return `${d}/${m}/${y}${jam ? ` ${jam.slice(0, 5)}` : ''}`
}

/** Waktu sekarang dalam format input: yyyy-mm-ddThh:mm (jam lokal). */
export function sekarangLokal(): string {
  const d = new Date()
  const dua = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}T${dua(d.getHours())}:${dua(d.getMinutes())}`
}
