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
    current: 'Dasar tingkatnya harga trip (dikonfirmasi atasan, 28 Sep 2026): harga yang diisi di trip, atau Harga route bila kosong. Berlaku untuk semua jenis kendaraan (diputuskan 6 Okt 2026; sebelumnya hanya HB / LB / DL / TRONTON); penerimanya sopir utama.',
    question: 'Harga di bawah Rp 1 jt dapat komisi atau tidak? Harga di sela tingkat (mis. Rp 10,5 jt) sementara masuk tingkat berikutnya; benarkah?',
  },
  {
    id: 'TBD-02',
    title: 'Pendapatan bruto per transaksi',
    current: 'Pendapatan = harga trip, sama dengan dasar komisi. Kolom COST di spreadsheet dibaca sebagai harga trip (93 dari 105 trip ber-COST sama persis dengan Harga route-nya). Trip baru terisi Harga route dan boleh diubah.',
    question: 'Benarkah COST di spreadsheet adalah harga yang ditagihkan ke klien untuk trip itu?',
  },
  {
    id: 'TBD-03',
    title: 'Pendapatan netto',
    current: 'Uang jalan = seluruh biaya perjalanan dari mesin nyala sampai kembali ke pool (7 Okt 2026). Netto = harga + biaya yang ditagihkan ke klien - uang jalan dibayar - biaya yang dibayar perusahaan langsung - komisi. Biaya yang dibayar sopir dari uang jalan tidak dikurangkan lagi; yang dibayar perusahaan langsung (voucher solar, e-toll) dikurangkan karena di luar uang jalan (di data lama ada 3 trip yang solarnya melebihi uang jalannya). Selama trip belum ditutup, sisa patokan UJROUTE dianggap masih akan dibayar. Kernet 0. Trip batal tidak dihitung.',
    question: 'Sisa uang jalan yang tidak terpakai menjadi hak sopir, atau dikembalikan? Reimbus (sopir menalangi) dan Double Driver dibayar di luar uang jalan - ikut mengurangi netto?',
  },
  {
    id: 'TBD-04',
    title: 'Data Cost pada Tagihan',
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
    title: 'Tombol "4B" pada halaman Trip (terjawab)',
    current: 'Di layar lama, angka itu "48" = jumlah record (baris bawah: "Record 48/48"), bukan tombol. Tombol 4B dihapus; jumlah data sudah tampil di bawah tabel Trip.',
    question: 'Tidak ada lagi. Catatan ini disimpan sebagai riwayat.',
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
    current: 'Dua cabang, dua bisnis (Meeting 17 Sep 2026): Priok = container, Karawang = alat berat & DHL. Trip, Tagihan, Kontrak, dan Pengaturan Komisi terpisah per cabang. Master (karyawan, mobil, route, klien, SI/JO) dan kasbon dipakai bersama.',
    question: 'Apakah master juga dipisah per cabang (di sistem lama, sopir dan rute Priok berbeda dari sopir SLB)? Perhitungan apa saja yang berbeda antara Priok dan Karawang: UJROUTE, komisi, tol, atau semuanya sama?',
  },
  {
    id: 'TBD-18',
    title: 'Uang Tol pada master Route',
    current: 'Tol dibayar sopir dari uang jalan (aturan 7 Okt 2026), lalu notanya dicatat di Biaya Operasional jenis Tol supaya ditagihkan ke klien sebagai Additional Cost PI. Tidak memotong transfer ke sopir (rekap BJM: TF = UJ - potong kasbon di 314 dari 314 baris). Bila dibayar kartu e-toll perusahaan, pilih "dibayar perusahaan": dihitung sebagai biaya di luar uang jalan. Uang Tol di route hanya patokan.',
    question: 'Tol dan solar biasanya dibayar sopir dari uang jalan, atau perusahaan langsung (e-toll, voucher solar)? Ini menentukan pilihan bawaan saat admin mencatat biaya.',
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
  {
    id: 'TBD-22',
    title: 'Nominal route (UJROUTE, Harga, Uang Tol)',
    current: 'Spreadsheet belum memuat nominal route. Sementara diisi dari trip asli (median uang jalan, COST, dan biaya Tol per route); route tanpa data diberi perkiraan dan bertanda "perkiraan" di menu Rute.',
    question: 'Mohon daftar resmi UJROUTE, Harga, dan Uang Tol per route, supaya nilai perkiraan bisa diganti.',
  },
  {
    id: 'TBD-23',
    title: 'Tahap PI data lama',
    current: 'Trip di rekap yang sudah punya No PI diberi tahap PI Dikirim, karena rekap tidak mencatat tahapnya. Kolom "Status PI" spreadsheet (di pool, masih moving, paket) disimpan sebagai catatan lama; "di pool" dibaca sebagai dokumen fisik sudah diterima.',
    question: 'PI lama mana yang sudah Disetujui atau Lunas? Apakah PI dibuat per trip (seperti Summary Submission PI: satu baris satu PI), atau ada PI yang menggabungkan beberapa trip?',
  },
  {
    id: 'TBD-24',
    title: 'Uang Dorong dan Uang Pulang',
    current: 'Keduanya uang untuk sopir, jadi dicatat sebagai termin uang jalan berjenis Uang Dorong / Uang Pulang, bukan biaya operasional (aturan 7 Okt 2026: semua uang perjalanan adalah uang jalan). Uang dorong dicatat di trip backload-nya. Empat catatan Uang Dorong di data lama dipindahkan otomatis menjadi termin.',
    question: 'Apakah uang dorong selalu sebesar UJROUTE rute backload, atau nominal tersendiri? Uang pulang punya patokan per rute atau dinilai per kejadian?',
  },
  {
    id: 'TBD-25',
    title: 'Biaya cancel (cancel fee)',
    current: 'Saat membatalkan trip Karawang, Manager / Owner boleh mengisi biaya cancel yang tetap ditagihkan ke klien. Trip batal itu masuk Tagihan (Siap PI) senilai biaya cancel, tetapi tidak ikut laporan pendapatan & netto.',
    question: 'Siapa yang menentukan besaran cancel fee, dan apakah sopir tetap dapat komisi atau uang jalan untuk trip yang dibatalkan setelah berangkat?',
  },
  {
    id: 'TBD-26',
    title: 'Trailer, equipment, dan helper per trip',
    current: 'Trip memilih head unit (No. Kendaraan) dan sopir. Trailer / equipment dan nama helper belum dicatat; di Berita Acara tercetak titik-titik untuk diisi tangan.',
    question: 'Trailer dan equipment punya nomor sendiri yang perlu dipilih per trip (master Data Kendaraan: unit utama, trailer, equipment), atau cukup jenisnya (HB, LB, Dolly)? Helper dibayar dari mana dan perlu masuk Kernet di laporan netto?',
  },
  {
    id: 'TBD-27',
    title: 'Lokasi muat & bongkar',
    current: 'Diambil dari nama rute "ASAL - TUJUAN" dan bisa diubah per trip. Backload memakai lokasi bongkar trip asal sebagai lokasi muat, lalu rute yang berawal dari lokasi itu tampil paling atas.',
    question: 'Perlukah Master Data Alamat (nama lokasi, alamat lengkap, koordinat, PIC & telepon seperti di Order Release SLB) supaya rute dan Berita Acara memakai alamat resmi?',
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
export function pendapatanTransaksi(row: Pick<TransactionRow, 'harga' | 'status'>): number {
  return tripDihitung(row) ? row.harga : 0
}

/**
 * TBD-03 — uang jalan sebagai biaya trip: termin yang benar-benar dibayar (termasuk uang
 * dorong & uang pulang). Selama trip belum ditutup, sisa patokan UJROUTE dianggap masih
 * akan dibayar; trip selesai tanpa termin memakai patokan.
 */
export function uangJalanTransaksi(row: Pick<TransactionRow, 'uj_total' | 'termin_count' | 'ujroute' | 'status'>): number {
  if (!tripDihitung(row)) return 0
  return row.status === 'selesai' && row.termin_count > 0 ? row.uj_total : Math.max(row.uj_total, row.ujroute)
}

/** Biaya di jalan (dari uang jalan) yang ditagihkan kembali ke klien sebagai Additional Cost PI. */
export function ditagihkanTransaksi(row: Pick<TransactionRow, 'biaya_ditagihkan' | 'status'>): number {
  return tripDihitung(row) ? row.biaya_ditagihkan : 0
}

/** Biaya di jalan yang dibayar perusahaan langsung (voucher solar, e-toll), di luar uang jalan. */
export function biayaPerusahaanTransaksi(row: Pick<TransactionRow, 'biaya_perusahaan' | 'status'>): number {
  return tripDihitung(row) ? row.biaya_perusahaan : 0
}

/**
 * TBD-03 — pendapatan netto untuk satu transaksi: harga + biaya yang ditagihkan ke klien,
 * dikurangi uang jalan, biaya yang dibayar perusahaan langsung, dan komisi. Biaya yang
 * dibayar sopir dari uang jalan tidak dikurangkan lagi karena sudah ada di uang jalan.
 */
export function nettoTransaksi(row: Pick<TransactionRow, 'harga' | 'ujroute' | 'uj_total' | 'termin_count' | 'biaya_ditagihkan' | 'biaya_perusahaan' | 'komisi_sopir' | 'status'>): number {
  if (!tripDihitung(row)) return 0
  return row.harga + row.biaya_ditagihkan - uangJalanTransaksi(row) - biayaPerusahaanTransaksi(row) - komisiTransaksi(row)
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
    uangJalan: rows.reduce((a, r) => a + uangJalanTransaksi(r), 0),
    ditagihkan: rows.reduce((a, r) => a + ditagihkanTransaksi(r), 0),
    biayaPerusahaan: rows.reduce((a, r) => a + biayaPerusahaanTransaksi(r), 0),
    netto: rows.reduce((a, r) => a + nettoTransaksi(r), 0),
    bonPribadi: rows.reduce((a, r) => a + r.personal_bon, 0),
    /** Harga yang diisi di trip saja (kolom COST data lama), tanpa Harga route. */
    cost: rows.reduce((a, r) => a + r.cost_value, 0),
  }
}

/** Perubahan persen antar dua periode; null bila pembanding nol. */
export function deltaPersen(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
