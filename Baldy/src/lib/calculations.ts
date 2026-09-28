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
    current: 'Dihitung dari master Komisi (catatan meeting): bertingkat per nilai trip untuk HB / LB / DL / TRONTON. Penerimanya sopir utama.',
    question: 'Dasar tingkatnya nilai trip (COST / Harga) atau uang jalan? Di data asli UJ per trip maksimal 17 jt, jadi tingkat 21 jt ke atas hanya terpakai bila dasarnya nilai trip. Nilai di bawah 1 jt dapat komisi atau tidak?',
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
    current: 'Sementara: Harga - UJROUTE - Komisi (dari aturan). Biaya operasional belum ikut dikurangkan. Trip batal tidak dihitung.',
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
    title: 'Status CASH pada kolom Klien',
    current: 'Klien punya penanda "alur dokumen"; CASH ditandai tanpa dokumen.',
    question: 'Seluruh 34 trip CASH tercatat tanpa TR dan tanpa No PI. Apakah CASH memang nama klien, atau sebenarnya jenis order / cara bayar yang seharusnya jadi field tersendiri?',
  },
  {
    id: 'TBD-10',
    title: 'Satuan cetak Surat Jalan',
    current: 'Satu trip dicetak satu halaman Surat Jalan berisi daftar ID Perjalanan/Trip bernomor.',
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
    id: 'TBD-13',
    title: 'Data Cost atau Kode Cust?',
    current: 'Label tetap "Data Cost" seperti dokumen; nilainya mengikuti kode customer.',
    question: 'Contoh nilainya berupa nama customer (mis. INDAH), dan layar pencarian memakai istilah Kode Cust untuk hal yang sama. Apakah kolom ini sebenarnya kode customer, atau memang kode jenis biaya yang berbeda?',
  },
  {
    id: 'TBD-14',
    title: 'Tiga kolom pada Cek Ritan',
    current: 'Memakai Tgl Bon, Bon Pribadi, dan SI - JOB ORDER.',
    question: 'Bacaan awal dari layar lama adalah Tujuan, Jam.Brkt, dan St.Job — ketiganya lazim di trucking. Mana yang benar: Tujuan atau Tgl Bon? Jam Berangkat atau Bon Pribadi? Status Job atau SI - Job Order?',
  },
  {
    id: 'TBD-15',
    title: 'Penulisan S / JO',
    current: 'Kolom ditulis S / JO mengikuti dokumen.',
    question: 'Apakah yang dimaksud SI / JO (Shipping Instruction / Job Order), atau memang S / JO dengan arti lain?',
  },
  {
    id: 'TBD-06',
    title: 'Fungsi tombol 4B pada halaman Trip',
    current: 'Dipertahankan sebagai secondary action, belum diberi logic.',
    question: 'Apa fungsi bisnis tombol 4B pada window Pengisian Data Surat Jalan?',
  },
  {
    id: 'TBD-16',
    title: 'Dasar target dan komisi pada halaman Komisi',
    current: 'Aturan komisi punya dasar hitung, layanan, dan jenis kendaraan. Dedicated CDD memakai (nilai kontrak - 5%) x 2,5% per kontrak.',
    question: 'Komisi kontrak Dedicated diberikan ke siapa (sopir, manager, atau marketing), kapan dibayarkan (sekali, bertahap, atau per tahun), dan 5% itu potongan apa?',
  },
  {
    id: 'TBD-17',
    title: 'Cakupan pemisahan data antar workspace',
    current: 'Trip, Tagihan, dan Pengaturan Komisi terpisah per workspace. Master (karyawan, mobil, route, project, SI/JO) dan kasbon karyawan dipakai bersama.',
    question: 'Apakah master juga dipisah per cabang? Lalu perhitungan apa saja yang berbeda antara Jakarta dan Tangerang - UJROUTE, komisi, tol, atau seluruhnya memakai rumus yang sama?',
  },
  {
    id: 'TBD-18',
    title: 'Uang Tol pada master Route',
    current: 'Uang Tol di route hanya patokan. Yang dihitung adalah tol yang benar-benar dibayar, dicatat di Biaya Operasional jenis Tol.',
    question: 'Uang Tol ini pengurang netto, komponen uang jalan, atau hanya acuan? Dan hubungannya dengan biaya operasional jenis "Tol" yang dicatat per trip - saling menggantikan atau dua hal berbeda?',
  },
  {
    id: 'TBD-19',
    title: 'Biaya Internal pada detail trip',
    current: 'Dicatat terpisah dari biaya operasional, belum mengurangi netto. Jenis "Uang Jalan" dihapus: UJ hanya dicatat di tab Uang Jalan.',
    question: 'Apakah biaya internal ikut mengurangi pendapatan netto?',
  },
  {
    id: 'TBD-07',
    title: 'Auto-number Nomor Surat Jalan',
    current: 'Sementara SJ-000001 berurutan, reset mengikuti data yang ada.',
    question: 'Apakah penomoran Surat Jalan mengikuti pola tertentu (per bulan / per customer / per armada)?',
  },
  {
    id: 'TBD-20',
    title: 'Finance balance kontrak Dedicated',
    current: 'Sisa kontrak = nilai kontrak - (uang jalan + biaya operasional + biaya internal) seluruh trip Dedicated kontrak itu.',
    question: 'Apakah "finance balance" memang sisa nilai kontrak setelah dikurangi biaya trip, atau nilai yang sudah ditagih ke client dibanding nilai kontrak?',
  },
  {
    id: 'TBD-21',
    title: 'Multi drop pada Penerima',
    current: 'Belum dibuat. Satu trip masih satu penerima.',
    question: 'Multi drop = satu route, beberapa penerima di satu area? Tiap drop punya TR dan keterangan sendiri? Perlu tanggal terima barang per drop? Alamat penerima perlu disimpan untuk dipakai ulang? Surat Jalan dicetak per drop atau satu untuk semua?',
  },
]

/**
 * Trip batal tidak dihitung di laporan mana pun. Catatannya tetap ada
 * sebagai arsip di halaman trip.
 */
export const tripDihitung = (row: Pick<TransactionRow, 'status'>) => row.status !== 'batal'

/** TBD-01 — komisi sopir untuk satu transaksi, dari master Komisi. */
export function komisiTransaksi(row: Pick<TransactionRow, 'komisi_sopir'>): number {
  return row.komisi_sopir
}

/** TBD-02 — pendapatan bruto untuk satu transaksi. */
export function pendapatanTransaksi(row: Pick<TransactionRow, 'route_price' | 'status'>): number {
  return tripDihitung(row) ? row.route_price : 0
}

/** TBD-03 — pendapatan netto untuk satu transaksi. */
export function nettoTransaksi(row: Pick<TransactionRow, 'route_price' | 'ujroute' | 'komisi_sopir' | 'status'>): number {
  return tripDihitung(row) ? row.route_price - row.ujroute - komisiTransaksi(row) : 0
}

/** TBD-05 — jumlah ritan untuk satu transaksi. */
export function ritanTransaksi(): number {
  return 1
}

/** Ringkasan agregat untuk kartu dashboard dan laporan. */
export function ringkas(semua: TransactionRow[]) {
  const rows = semua.filter(tripDihitung)
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
