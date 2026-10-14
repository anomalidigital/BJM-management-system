/**
 * Kode area pick up & destinasi (CIB, DURI, ...): perapian, pembanding, deteksi salah ketik,
 * dan hitungan pemakaian di master Rute & Alamat. Dipakai menu Rute, Alamat, dan form trip.
 */
import { kodeAreaRute, normalKodeArea } from './trip'
import type { Alamat, Route } from '../types'

/* ── Kode area ─────────────────────────────────────────────────────────────
 * Kode area pick up & destinasi (CIB, DURI, ...) dipakai memilih rute dan alamat di
 * form trip. Bawaannya diturunkan dari nama rute "ASAL - TUJUAN" (lib/trip.ts
 * kodeAreaRute). Isian di form rute hanya disimpan bila BERBEDA dari turunan nama;
 * kosong = ikut nama, jadi rute lama (yang belum punya isian) dan rute baru diperlakukan
 * sama, dan nama rute yang dibetulkan langsung membetulkan kode areanya juga.
 */

/** Rapikan ketikan kode area: huruf besar, spasi ganda jadi satu. */
export const rapikanKodeArea = (v: string) => v.toUpperCase().replace(/\s+/g, ' ').replace(/^ /, '')

/** Kunci pembanding kode area: tanpa spasi & tanda baca; penanda backload di ujung dibuang (CIB BKLD = CIB). */
export function kunciKodeArea(kode: string): string {
  return kode.trim().toUpperCase().replace(/\s+(BCKLD|BKLD|BACKLOAD)$/, '').replace(/[^A-Z0-9]/g, '')
}

/** Jarak Levenshtein: jumlah huruf yang perlu ditambah, dibuang, atau diganti. */
function jarakEdit(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

/**
 * Dua kode area mirip, mungkin salah ketik: sama setelah spasi dibuang (REBON JARO = REBONJARO),
 * atau hanya beda sedikit huruf. Batasnya mengikuti panjang kode supaya kode pendek yang memang
 * berbeda (CIB, CLU, SLB) tidak dianggap mirip: di bawah 4 huruf harus sama persis, 4–7 huruf
 * boleh beda 1 (PUNINAR / PUNIAR, JONGGOL / JONNGOL), 8 huruf ke atas boleh beda 2
 * (SECANGGANG / SECANGNGGANG, REBONJARO / REBENOJARO).
 */
export function kodeAreaMirip(a: string, b: string): boolean {
  const x = a.trim().toUpperCase()
  const y = b.trim().toUpperCase()
  if (!x || !y || x === y) return false
  const ka = kunciKodeArea(x)
  const kb = kunciKodeArea(y)
  if (!ka || !kb) return false
  if (ka === kb) return true
  const pendek = Math.min(ka.length, kb.length)
  const batas = pendek >= 8 ? 2 : pendek >= 4 ? 1 : 0
  return batas > 0 && Math.abs(ka.length - kb.length) <= batas && jarakEdit(ka, kb) <= batas
}

/** Pemakaian satu kode area: jumlah rute (sebagai pick up atau destinasi) dan alamat. */
export interface PakaiKode {
  rute: number
  alamat: number
}

const totalPakai = (p?: PakaiKode) => (p?.rute ?? 0) + (p?.alamat ?? 0)

/** "2 rute, 1 alamat" */
export const teksPakai = (p: PakaiKode) => [p.rute ? `${p.rute} rute` : '', p.alamat ? `${p.alamat} alamat` : ''].filter(Boolean).join(', ')

/**
 * Pemakaian tiap kode area di master Rute dan (bila diberikan) Master Alamat.
 * `kecualiRute` = rute yang sedang diubah, supaya tidak dihitung sebagai pembanding dirinya sendiri.
 */
export function pemakaianKodeArea(routes: Route[], alamat: Pick<Alamat, 'kode_area'>[] = [], kecualiRute?: string): Map<string, PakaiKode> {
  const m = new Map<string, PakaiKode>()
  const tambah = (kode: string, jenis: keyof PakaiKode) => {
    const k = kode.trim().toUpperCase()
    if (!k) return
    const p = m.get(k) ?? { rute: 0, alamat: 0 }
    p[jenis] += 1
    m.set(k, p)
  }
  for (const r of routes) {
    if (r.id === kecualiRute) continue
    const k = kodeAreaRute(r)
    tambah(k.asal, 'rute')
    if (k.tujuan !== k.asal) tambah(k.tujuan, 'rute')
  }
  for (const a of alamat) tambah(a.kode_area ?? '', 'alamat')
  return m
}

/**
 * Kelompok kode area yang mirip satu sama lain, mis. SECANGGANG / SECANGNGGANG / SICANGGANG.
 * Kode yang paling banyak dipakai (kemungkinan besar yang benar) ada di depan.
 */
export function kelompokKodeMirip(pakai: Map<string, PakaiKode>): string[][] {
  const kode = [...pakai.keys()]
  const induk = new Map(kode.map((k) => [k, k]))
  const akar = (k: string) => {
    let x = k
    while (induk.get(x) !== x) x = induk.get(x)!
    return x
  }
  for (let i = 0; i < kode.length; i++) {
    for (let j = i + 1; j < kode.length; j++) if (kodeAreaMirip(kode[i], kode[j])) induk.set(akar(kode[i]), akar(kode[j]))
  }
  const grup = new Map<string, string[]>()
  for (const k of kode) grup.set(akar(k), [...(grup.get(akar(k)) ?? []), k])
  return [...grup.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => totalPakai(pakai.get(b)) - totalPakai(pakai.get(a)) || a.localeCompare(b)))
    .sort((a, b) => a[0].localeCompare(b[0]))
}

/**
 * Kelompok yang ditandai "bukan salah ketik" (mis. SUBAN dan SUBANG memang dua tempat).
 * Disimpan di browser ini saja; di produksi sebaiknya disimpan backend supaya berlaku untuk semua pengguna.
 */
const KUNCI_BUKAN_SALAH_KETIK = 'sikotis.kodeAreaMirip.v1'

export function bacaBukanSalahKetik(): string[][] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KUNCI_BUKAN_SALAH_KETIK) ?? '[]')
    return Array.isArray(v) ? v.filter((g): g is string[] => Array.isArray(g) && g.every((k) => typeof k === 'string')) : []
  } catch {
    return []
  }
}

export function simpanBukanSalahKetik(v: string[][]): void {
  try {
    localStorage.setItem(KUNCI_BUKAN_SALAH_KETIK, JSON.stringify(v))
  } catch {
    // Penyimpanan browser tidak tersedia: tandanya berlaku sampai halaman dimuat ulang.
  }
}

/** Seluruh kode kelompok ini sudah tercakup satu tanda "bukan salah ketik"? Kode baru yang ikut mirip memunculkannya lagi. */
export const sudahDitandai = (kelompok: string[], tanda: string[][]) => tanda.some((t) => kelompok.every((k) => t.includes(k)))

/** Saran pengganti `kode` bila mirip kode lain yang lebih banyak dipakai (mungkin salah ketik). */
export function saranKodeArea(kode: string, pakai: Map<string, PakaiKode>, tanda: string[][] = []): { kode: string; pakai: PakaiKode } | null {
  const v = kode.trim().toUpperCase()
  if (!v) return null
  const sendiri = totalPakai(pakai.get(v))
  let hasil: { kode: string; pakai: PakaiKode } | null = null
  for (const [k, p] of pakai) {
    if (totalPakai(p) <= sendiri || !kodeAreaMirip(v, k)) continue
    if (tanda.some((t) => t.includes(v) && t.includes(k))) continue
    if (!hasil || totalPakai(p) > totalPakai(hasil.pakai)) hasil = { kode: k, pakai: p }
  }
  return hasil
}

/* ── Alamat baru: kode area otomatis & alamat kembar ──────────────────────── */

/** Kata di nama kota yang bukan nama tempatnya ("Kab. Lamongan, Jawa Timur 62264" -> LAMONGAN). */
const BUKAN_NAMA_KOTA = /^(KAB|KABUPATEN|KOTA|KEC|KECAMATAN|KEL|KELURAHAN|DESA|PROV|PROVINSI)\.?$/

/** Kata umum di nama lokasi yang tidak membedakan tempat (PT, CV, Wellsite, ...). */
const BUKAN_NAMA_LOKASI = /^(PT|CV|UD|TBK|PERSERO|WELLSITE|SITE|GUDANG|DEPO|BASE)\.?$/

/**
 * Kode area alamat baru, dibuat otomatis dari kota (revisi 13 Okt 2026: "kode dibuat otomatis
 * ketika sudah isi nama lokasi atau kota"): nama tempat sebelum koma, tanpa Kab./Kota dan kode pos
 * ("Bandung" -> BANDUNG, "Duri, Riau 28884" -> DURI). Kota kosong = dua kata pertama nama lokasi.
 */
export function kodeAreaDariLokasi(kota: string, nama: string): string {
  const dariKota = (kota.split(',')[0] ?? '').toUpperCase().replace(/\d+/g, ' ').split(/[^A-Z]+/)
    .filter((k) => k && !BUKAN_NAMA_KOTA.test(k))
  if (dariKota.length) return dariKota.join(' ')
  const dariNama = nama.toUpperCase().replace(/\(.*?\)/g, ' ').split(/[^A-Z0-9]+/).filter((k) => k && !BUKAN_NAMA_LOKASI.test(k))
  return dariNama.slice(0, 2).join(' ')
}

/** Kunci pembanding nama lokasi: tanpa PT/CV, tanda baca, dan beda huruf besar. */
export function kunciNamaLokasi(nama: string): string {
  return nama.toUpperCase().split(/[^A-Z0-9]+/).filter((k) => k && !/^(PT|CV|UD|TBK|PERSERO)$/.test(k)).join(' ')
}

/**
 * Alamat yang mungkin sama dengan nama lokasi yang sedang diketik: namanya sama, atau salah satunya
 * memuat yang lain (minimal 4 huruf). Dipakai supaya lokasi yang sudah ada tidak ditambahkan lagi.
 */
export function alamatMirip<T extends Pick<Alamat, 'id' | 'nama'>>(nama: string, daftar: T[], batas = 3): T[] {
  const k = kunciNamaLokasi(nama)
  if (k.length < 4) return []
  const sama = daftar.filter((a) => kunciNamaLokasi(a.nama) === k)
  const memuat = daftar.filter((a) => {
    const x = kunciNamaLokasi(a.nama)
    return x !== k && x.length >= 4 && (x.includes(k) || k.includes(x))
  })
  return [...sama, ...memuat].slice(0, batas)
}

/* ── Rapikan kode area salah ketik (Baldy 14 Okt 2026: "masalah kode yang sama di rute") ───────── */

/** Kunci pembanding nama rute: tanpa spasi & tanda baca ("CIB-DURI" = "CIB - DURI", "REBON JARO" = "REBONJARO"). */
export const kunciNamaRute = (nama: string) => nama.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Satu rute yang akan dirapikan, atau tidak bisa dirapikan karena jadi kembar dengan rute lain. */
export interface UbahRute {
  rute: Route
  namaBaru: string
  patch: Partial<Route>
  /** Rute lain yang namanya akan sama persis bila rute ini dirapikan. */
  kembarDengan?: Route
}

export interface RencanaRapikan {
  rute: UbahRute[]
  kembar: UbahRute[]
  alamat: Array<{ alamat: Alamat; kodeLama: string }>
}

const PENANDA_BALIK = /\s+(BCKLD|BKLD|BACKLOAD)$/i

/**
 * Rencana menyatukan penulisan satu kelompok kode area ke `benar`: nama rute ("LOKS - SICANGGANG" ->
 * "LOKS - SECANGGANG", nomor site & BCKLD tetap), isian area rute, dan kode area Master Alamat.
 * No. Rute tidak berubah. Rute yang namanya jadi sama dengan rute lain (bisa saja harganya berbeda)
 * tidak dirapikan otomatis: dikembalikan di `kembar` untuk dicek manual.
 */
export function rencanaRapikanKode(kelompok: string[], benar: string, routes: Route[], alamat: Alamat[]): RencanaRapikan {
  const salah = new Set(kelompok.map((k) => k.trim().toUpperCase()).filter((k) => k !== benar))
  /** Ganti kode area di awal satu bagian nama ("PUNIAR 2" -> "PUNINAR 2"). */
  const gantiBagian = (bagian: string) => {
    const teks = bagian.trim().toUpperCase()
    const area = normalKodeArea(teks)
    return salah.has(area) && teks.startsWith(area) ? benar + teks.slice(area.length) : teks
  }
  const gantiNama = (nama: string) => {
    const bagian = nama.split(' - ')
    if (bagian.length < 2) return gantiBagian(nama)
    const akhir = bagian[bagian.length - 1]
    const penanda = akhir.match(PENANDA_BALIK)?.[0] ?? ''
    bagian[0] = gantiBagian(bagian[0])
    bagian[bagian.length - 1] = gantiBagian(penanda ? akhir.slice(0, -penanda.length) : akhir) + penanda.toUpperCase()
    return bagian.join(' - ')
  }
  const gantiIsian = (v?: string) => (v && salah.has(v.trim().toUpperCase()) ? benar : v)

  const akhirNama = new Map(routes.map((r) => [kunciNamaRute(r.route_name), r]))
  const ubah: UbahRute[] = []
  const kembar: UbahRute[] = []
  for (const r of routes) {
    const namaBaru = gantiNama(r.route_name)
    const asal = gantiIsian(r.kode_area_asal)
    const tujuan = gantiIsian(r.kode_area_tujuan)
    if (namaBaru === r.route_name.trim().toUpperCase() && asal === r.kode_area_asal && tujuan === r.kode_area_tujuan) continue
    // Isian area yang sama dengan turunan nama barunya tidak perlu disimpan (ikut nama).
    const turunan = kodeAreaRute({ route_name: namaBaru })
    const patch: Partial<Route> = {
      route_name: namaBaru,
      kode_area_asal: asal && normalKodeArea(asal) !== normalKodeArea(turunan.asal) ? asal : undefined,
      kode_area_tujuan: tujuan && normalKodeArea(tujuan) !== normalKodeArea(turunan.tujuan) ? tujuan : undefined,
    }
    const kunci = kunciNamaRute(namaBaru)
    const lain = akhirNama.get(kunci)
    if (lain && lain.id !== r.id) {
      kembar.push({ rute: r, namaBaru, patch, kembarDengan: lain })
      continue
    }
    akhirNama.delete(kunciNamaRute(r.route_name))
    akhirNama.set(kunci, r)
    ubah.push({ rute: r, namaBaru, patch })
  }
  const alamatUbah = alamat
    .filter((a) => salah.has((a.kode_area ?? '').trim().toUpperCase()))
    .map((a) => ({ alamat: a, kodeLama: a.kode_area }))
  return { rute: ubah, kembar, alamat: alamatUbah }
}
