/** Pembuat nomor & kode otomatis. */
import type { Driver, EmployeeRole, Route } from '../types'

/** Huruf mati saja, supaya kode acak tidak membentuk kata. */
const KONSONAN = 'BCDFGHJKLMNPQRSTVWXYZ'

/**
 * Kode unik: 13 digit timestamp (Date.now) + 7 huruf mati acak, mis.
 * 1779754321123KDFRZMP. Timestamp menjaga urutan waktu, huruf acak menambah
 * keunikan; bila (sangat jarang) sudah dipakai, dibuat ulang.
 * Dipakai tombol Generate ID Perjalanan/Trip (Priok).
 */
export function buatKodeUnik(terpakai: Iterable<string> = []): string {
  const ada = new Set([...terpakai].map((k) => k.toUpperCase()))
  for (;;) {
    const text = Array.from({ length: 7 }, () => KONSONAN[Math.floor(Math.random() * KONSONAN.length)]).join('')
    const kode = Date.now() + text
    if (!ada.has(kode)) return kode
  }
}

/**
 * Kode berformat sama dengan buatKodeUnik (13 digit waktu + 7 huruf mati) tetapi tetap dari
 * sebuah benih. Dipakai memberi ID Perjalanan trip lama yang belum punya (12 Okt 2026),
 * supaya hasilnya sama setiap kali data contoh dibangun ulang.
 */
export function kodeUnikDari(waktuMs: number, benih: string): string {
  let h = 2166136261
  for (let i = 0; i < benih.length; i++) {
    h ^= benih.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  let huruf = ''
  for (let i = 0; i < 7; i++) {
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0
    huruf += KONSONAN[h % KONSONAN.length]
  }
  return String(Math.max(0, Math.floor(waktuMs))).padStart(13, '0') + huruf
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

/** Penanda rute backload di akhir nama (data lama): "DURI - CIB BCKLD". */
const PENANDA_BACKLOAD = /\s+(BCKLD|BKLD|BACKLOAD)$/i
const empat = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)

/** "ASAL - TUJUAN": asal = sebelum " - " pertama, tujuan = setelah " - " terakhir. */
function bagianRute(namaRute: string): { asal: string; tujuan: string } | null {
  const i = namaRute.indexOf(' - ')
  if (i < 0) return null
  return { asal: namaRute.slice(0, i), tujuan: namaRute.slice(namaRute.lastIndexOf(' - ') + 3) }
}

/**
 * No. Rute pola aplikasi lama: 4 huruf / angka pertama asal + 4 pertama tujuan terakhir
 * ("AKP 01 - JTB 174" -> AKP0JTB1, "BETUNG - INDRAMAYU" -> BETUINDR, "KRG - INF 1 - CIB BCKLD" -> KRGCIBB).
 */
export function kodeRuteDasar(namaRute: string): string {
  const b = bagianRute(namaRute)
  return b ? empat(b.asal) + empat(b.tujuan) : empat(namaRute)
}

/**
 * No. Rute lengkap untuk rute yang pola dasarnya bentrok: asal 4 huruf, lalu tujuan dengan
 * pembedanya. Tiap kata 4 huruf (`kataPertamaUtuh`: kata pertama utuh, sampai 10 huruf), angka utuh
 * (dua angka berurutan dipisah "-"), penanda backload jadi BL: "CIB - SAMBAR 4" -> CIBSAMB4,
 * "CIB - SAMBAR MOVING 1" -> CIBSAMBMOVI1, "DURI - KB 575 2" -> DURIKB575-2, "DURI - CIB BCKLD" -> DURICIBBL,
 * "SUBAN - RAWA (2)" -> SUBARAWA2.
 */
export function kodeRuteLengkap(namaRute: string, kataPertamaUtuh = false): string {
  const b = bagianRute(namaRute)
  const tujuanMentah = b ? b.tujuan : namaRute
  const balik = PENANDA_BACKLOAD.test(tujuanMentah)
  const kata = tujuanMentah.replace(PENANDA_BACKLOAD, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  let tujuan = ''
  let angkaSebelumnya = false
  kata.forEach((k, i) => {
    const angka = /^\d+$/.test(k)
    tujuan += angka ? `${angkaSebelumnya ? '-' : ''}${k}` : k.slice(0, i === 0 && kataPertamaUtuh ? 10 : 4)
    angkaSebelumnya = angka
  })
  return (b ? empat(b.asal) : '') + tujuan + (balik ? 'BL' : '')
}

/**
 * No. Rute dari nama rute, dibuat sekali saat rute baru disimpan lalu tetap (revisi 13 Okt 2026:
 * tidak bisa diubah, tanpa Generate). Tidak ada rute lain berpola dasar sama: pola aplikasi lama
 * (CIB - DURI -> CIBDURI). Ada: kode lengkap yang memuat pembeda dari namanya sendiri (CIB - SAMBAR 5 ->
 * CIBSAMB5), bukan nomor urut seperti aplikasi lama (Baldy 14 Okt 2026: "masalah kode yang sama di rute").
 * Masih terpakai: kata pertama tujuan ditulis utuh, lalu -2, -3 (nama kembar beda penulisan).
 */
export function kodeRuteDari(namaRute: string, rute: Array<Pick<Route, 'route_code' | 'route_name'>>): string {
  const ada = new Set(rute.map((r) => r.route_code.toUpperCase()))
  const dasar = kodeRuteDasar(namaRute) || 'RUTE'
  const sePola = rute.some((r) => kodeRuteDasar(r.route_name) === dasar)
  const calon = [...(sePola ? [] : [dasar]), kodeRuteLengkap(namaRute) || dasar, kodeRuteLengkap(namaRute, true) || dasar]
  const bebas = calon.find((k) => !ada.has(k))
  if (bebas) return bebas
  for (let n = 2; ; n++) if (!ada.has(`${calon[1]}-${n}`)) return `${calon[1]}-${n}`
}

/**
 * Rapikan No. Rute warisan aplikasi lama. Rute yang pola dasarnya bentrok dulu diberi nomor urut yang
 * tidak ada hubungannya dengan nama (CIB - SAMBAR 4 = CIBSAMB3, EXXON - EXXON 10 = EXXOEXX2). Rute
 * sekelompok diberi kode lengkap berisi pembedanya; rute tanpa pembeda (CIB - SAMBAR) memegang kode
 * dasarnya. Kode lama disimpan di route_code_lama supaya tetap bisa dicari. Rute yang tidak bentrok tidak diubah.
 */
export function rapikanNoRuteLama<T extends { id: string; route_code: string; route_name: string; route_code_lama?: string }>(routes: T[]): T[] {
  const kelompok = new Map<string, T[]>()
  for (const r of routes) {
    const d = kodeRuteDasar(r.route_name)
    if (d) kelompok.set(d, [...(kelompok.get(d) ?? []), r])
  }
  const sasaran = new Map<string, string>()
  for (const [dasar, rs] of kelompok) {
    if (rs.length < 2) continue
    for (const r of rs) sasaran.set(r.id, kodeRuteLengkap(r.route_name) || dasar)
  }
  if (!sasaran.size) return routes
  // Kode akhir harus unik. Nama kembar beda penulisan (PUNIAR / PUNINAR) dibedakan menurut urutan kode aslinya
  // dari aplikasi lama, jadi hasilnya sama walau dijalankan ulang.
  const dipakai = new Set(routes.filter((r) => !sasaran.has(r.id)).map((r) => r.route_code.toUpperCase()))
  const akhir = new Map<string, string>()
  const kodeAsli = (r: T) => r.route_code_lama ?? r.route_code
  for (const r of routes.filter((x) => sasaran.has(x.id)).sort((a, b) => kodeAsli(a).localeCompare(kodeAsli(b)) || a.id.localeCompare(b.id))) {
    let k = sasaran.get(r.id)!
    if (dipakai.has(k)) k = kodeRuteLengkap(r.route_name, true) || k
    if (dipakai.has(k)) {
      const akar = sasaran.get(r.id)!
      let n = 2
      while (dipakai.has(`${akar}-${n}`)) n++
      k = `${akar}-${n}`
    }
    dipakai.add(k)
    akhir.set(r.id, k)
  }
  return routes.map((r) => {
    const k = akhir.get(r.id)
    return k && k !== r.route_code ? { ...r, route_code: k, route_code_lama: r.route_code_lama ?? r.route_code } : r
  })
}
