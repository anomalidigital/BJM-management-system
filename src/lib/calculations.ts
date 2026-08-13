/**
 * ===========================================================================
 *  PERHITUNGAN BISNIS - PLACEHOLDER / TBD
 * ===========================================================================
 *  Seluruh perhitungan yang belum ditetapkan dikumpulkan DI SATU FILE INI
 *  supaya mudah diganti begitu rumus resminya tersedia.
 *
 *  Jangan menyalin rumus di bawah ke file lain -- panggil fungsinya.
 * ===========================================================================
 */
import type { TransactionRow, UjPayment } from '../types'

/* ===========================================================================
 *  ATURAN TERVERIFIKASI (bukan TBD)
 *  Berasal dari formula asli pada spreadsheet operasional:
 *      TF = UJ - POTONG KASBON
 *  Konsisten pada seluruh 343 baris pembayaran.
 * ======================================================================== */
export function tfPembayaran(p: Pick<UjPayment, 'uj_amount' | 'kasbon_deduction'>): number {
  return p.uj_amount - p.kasbon_deduction
}

/** Total UJ / potong kasbon / TF untuk sekumpulan termin. */
export function totalUj(payments: Array<Pick<UjPayment, 'uj_amount' | 'kasbon_deduction'>>) {
  const uj = payments.reduce((a, p) => a + p.uj_amount, 0)
  const kasbon = payments.reduce((a, p) => a + p.kasbon_deduction, 0)
  return { uj, kasbon, tf: uj - kasbon, termin: payments.length }
}

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
    current: 'Sementara memakai nilai Komisioner dari master Route. Fitur komisi dipertahankan.',
    question: 'Data operasional tidak memuat kolom komisi sama sekali. Apakah komisi masih dipakai? Bila ya, apa formula, sumber data, dan waktu pembayarannya?',
  },
  {
    id: 'TBD-02',
    title: 'Pendapatan bruto per transaksi',
    current: 'Trip menyimpan cost_value apa adanya; maknanya belum diubah.',
    question: 'COST pada spreadsheet hanya terisi di 107 dari 241 trip dan nilainya berbeda-beda pada rute yang sama. Apakah COST = harga ke customer, pendapatan bruto, biaya, atau nilai kontrak?',
  },
  {
    id: 'TBD-03',
    title: 'Pendapatan netto',
    current: 'Sementara: Harga - UjRoute - Komisioner. Biaya operasional belum ikut dikurangkan.',
    question: 'Apakah DEX, tol, SPSI, nginap, dan biaya lain menjadi pengurang pendapatan netto?',
  },
  {
    id: 'TBD-04',
    title: 'Data Cost pada Data Tagihan',
    current: 'Data Cost mengikuti Kode Cust dari SI/JO.',
    question: 'Apakah Data Cost memang sama dengan Kode Cust, atau master kode biaya tersendiri?',
  },
  {
    id: 'TBD-05',
    title: 'Definisi 1 Ritan',
    current: 'Sementara 1 transaksi komisi dihitung sebagai 1 ritan.',
    question: 'Apakah ritan dihitung per transaksi, per container, atau per surat jalan?',
  },
  {
    id: 'TBD-08',
    title: 'Apakah TR sama dengan SIJO?',
    current: 'Disimpan sebagai dua field terpisah pada trip.',
    question: 'TR pada data operasional seragam 10 digit, sedangkan SIJO berformat 7 digit, dan tidak ada kolom berformat SIJO sama sekali. Apakah TR = SI/Job Order, nomor trucking request, atau dokumen lain?',
  },
  {
    id: 'TBD-09',
    title: 'Status CASH pada kolom Project',
    current: 'Project punya penanda "alur dokumen"; CASH ditandai tanpa dokumen.',
    question: 'Seluruh 34 trip CASH tercatat tanpa TR dan tanpa No PI. Apakah CASH memang nama project, atau sebenarnya jenis order / cara bayar yang seharusnya jadi field tersendiri?',
  },
  {
    id: 'TBD-10',
    title: 'Satuan cetak Surat Jalan',
    current: 'Satu Surat Jalan dicetak satu halaman berisi daftar container bernomor.',
    question: 'Apakah satu Surat Jalan dicetak sekali untuk semua container, atau satu halaman per container? Dan apakah tiap container punya nomor Surat Jalan sendiri?',
  },
  {
    id: 'TBD-11',
    title: 'Komponen Kernet pada laporan Netto',
    current: 'Belum ada field kernet di sistem.',
    question: 'Komponen Kernet: dari mana nilainya diambil, dan apakah dipakai?',
  },
  {
    id: 'TBD-12',
    title: 'Potong Kasbon vs Bon Pribadi',
    current: 'Potong Kasbon dicatat per termin UJ; Bon Pribadi tetap di Cek Ritan.',
    question: 'Apakah keduanya hal yang sama? Bila ya, apakah ada saldo kasbon sopir yang dikelola terpisah?',
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
    /** Nilai COST apa adanya dari data operasional; makna bisnisnya TBD-02. */
    cost: rows.reduce((a, r) => a + r.cost_value, 0),
  }
}

/** Perubahan persen antar dua periode; null bila pembanding nol. */
export function deltaPersen(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
