/**
 * ===========================================================================
 *  PERHITUNGAN BISNIS - PLACEHOLDER / TBD
 * ===========================================================================
 *  Formula asli SIKOTIS belum tersedia. Sesuai dokumen bagian 23, seluruh
 *  perhitungan yang belum tervalidasi dikumpulkan DI SATU FILE INI supaya
 *  mudah diganti begitu rumus resmi dari PT Bimajaya Mustika diberikan.
 *
 *  Jangan menyalin rumus di bawah ke file lain -- panggil fungsinya.
 * ===========================================================================
 */
import type { TransactionRow } from '../types'

export interface TbdNote {
  id: string
  title: string
  current: string
  question: string
}

/** Daftar rumus yang masih perlu dikonfirmasi (ditampilkan di halaman Tools). */
export const TBD_NOTES: TbdNote[] = [
  {
    id: 'TBD-01',
    title: 'Komisi sopir per transaksi',
    current: 'Sementara memakai nilai Komisioner dari master Route.',
    question: 'Apakah komisi sopir = Komisioner route, atau ada persentase / potongan lain?',
  },
  {
    id: 'TBD-02',
    title: 'Pendapatan bruto per transaksi',
    current: 'Sementara memakai Harga dari master Route.',
    question: 'Apakah pendapatan diakui dari Harga route atau dari Jumlah Rp pada Data Tagihan?',
  },
  {
    id: 'TBD-03',
    title: 'Pendapatan netto',
    current: 'Sementara: Harga - UjRoute - Komisioner.',
    question: 'Komponen biaya apa saja yang mengurangi pendapatan netto (BBM, tol, bon sopir, jaminan)?',
  },
  {
    id: 'TBD-04',
    title: 'Data Cost pada Data Tagihan',
    current: 'Dummy mengisi Data Cost mengikuti Kode Cust dari SI/JO.',
    question: 'Apakah Data Cost memang sama dengan Kode Cust, atau master kode biaya tersendiri?',
  },
  {
    id: 'TBD-05',
    title: 'Definisi 1 Ritan',
    current: 'Sementara 1 transaksi komisi dihitung sebagai 1 ritan.',
    question: 'Apakah ritan dihitung per transaksi, per container, atau per surat jalan?',
  },
  {
    id: 'TBD-06',
    title: 'Fungsi tombol 4B pada Data Komisi',
    current: 'Dipertahankan sebagai secondary action, belum diberi logic.',
    question: 'Apa fungsi bisnis tombol 4B pada window Pengisian Data Surat Jalan?',
  },
  {
    id: 'TBD-07',
    title: 'Auto-number Nomor Surat Jalan',
    current: 'Sementara SJ-000001 berurutan, reset mengikuti data yang ada.',
    question: 'Apakah penomoran Surat Jalan mengikuti pola tertentu (per bulan / per customer / per armada)?',
  },
]

/** TBD-01 — komisi sopir untuk satu transaksi. */
export function komisiTransaksi(row: Pick<TransactionRow, 'commissioner'>): number {
  return row.commissioner
}

/** TBD-02 — pendapatan bruto untuk satu transaksi. */
export function pendapatanTransaksi(row: Pick<TransactionRow, 'route_price'>): number {
  return row.route_price
}

/** TBD-03 — pendapatan netto untuk satu transaksi. */
export function nettoTransaksi(row: Pick<TransactionRow, 'route_price' | 'ujroute' | 'commissioner'>): number {
  return row.route_price - row.ujroute - row.commissioner
}

/** TBD-05 — jumlah ritan untuk satu transaksi. */
export function ritanTransaksi(): number {
  return 1
}

/** Ringkasan agregat untuk kartu dashboard dan laporan. */
export function ringkas(rows: TransactionRow[]) {
  return {
    transaksi: rows.length,
    ritan: rows.reduce((a) => a + ritanTransaksi(), 0),
    komisi: rows.reduce((a, r) => a + komisiTransaksi(r), 0),
    pendapatan: rows.reduce((a, r) => a + pendapatanTransaksi(r), 0),
    ujroute: rows.reduce((a, r) => a + r.ujroute, 0),
    netto: rows.reduce((a, r) => a + nettoTransaksi(r), 0),
    bonPribadi: rows.reduce((a, r) => a + r.personal_bon, 0),
  }
}

/** Perubahan persen antar dua periode; null bila pembanding nol. */
export function deltaPersen(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
