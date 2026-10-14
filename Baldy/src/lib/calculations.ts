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
 *      Transfer = Uang Jalan − Potong Kasbon
 *  Konsisten pada seluruh 343 baris pembayaran.
 * ======================================================================== */
export function tfPembayaran(p: Pick<UjPayment, 'uj_amount' | 'kasbon_deduction'>): number {
  return p.uj_amount - p.kasbon_deduction
}

/** Total Uang Jalan / potong kasbon / TF untuk sekumpulan termin. */
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
    title: 'Komisi supir per transaksi',
    current: 'Dasar tingkatnya harga trip (dikonfirmasi atasan, 28 Sep 2026): harga yang diisi di trip, atau Harga Rute bila kosong. Berlaku untuk semua jenis kendaraan (diputuskan 6 Okt 2026; sebelumnya hanya HB / LB / DL / TRONTON); penerimanya supir utama.',
    question: 'Harga di bawah Rp 1 jt dapat komisi atau tidak? Harga di sela tingkat (mis. Rp 10,5 jt) sementara masuk tingkat berikutnya; benarkah?',
  },
  {
    id: 'TBD-02',
    title: 'Pendapatan bruto per transaksi',
    current: 'Pendapatan = harga trip, sama dengan dasar komisi. Kolom COST di spreadsheet dibaca sebagai harga trip (93 dari 105 trip ber-COST sama persis dengan Harga Rute-nya). Trip baru terisi Harga Rute dan boleh diubah.',
    question: 'Benarkah COST di spreadsheet adalah harga yang ditagihkan ke klien untuk trip itu?',
  },
  {
    id: 'TBD-03',
    title: 'Pendapatan netto',
    current: 'Uang jalan = seluruh biaya perjalanan dari mesin nyala sampai kembali ke pool (7 Okt 2026). Netto = harga + biaya yang ditagihkan ke klien - uang jalan dibayar - biaya yang dibayar perusahaan langsung - komisi. Biaya yang dibayar supir dari uang jalan tidak dikurangkan lagi; yang dibayar perusahaan langsung (voucher solar, e-toll) dikurangkan karena di luar uang jalan (di data lama ada 3 trip yang solarnya melebihi uang jalannya). Selama trip belum ditutup, sisa patokan Uang Jalan Rute dianggap masih akan dibayar. Kernet 0. Trip batal tidak dihitung.',
    question: 'Sisa uang jalan yang tidak terpakai menjadi hak supir, atau dikembalikan? Reimbus (supir menalangi) dan Double Driver dibayar di luar uang jalan - ikut mengurangi netto?',
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
    title: 'Apakah TR sama dengan SIJO? (terjawab)',
    current: 'Terjawab 7 Okt 2026: di Karawang, TR adalah nomor order klien (Order Release DHL/SLB; di dokumen klien tertulis TR/OR), bukan SI/Job Order. Di layar disebut No. Referensi: satu trip boleh membawa beberapa nomor, nomor yang sama boleh dipakai trip lain, dan tidak pernah dibuat sistem. SI/Job Order tetap milik Priok (container).',
    question: 'Tidak ada lagi. Catatan ini disimpan sebagai riwayat.',
  },
  {
    id: 'TBD-09',
    title: 'Status CASH pada kolom Klien',
    current: 'Klien punya penanda "alur dokumen"; CASH ditandai tanpa dokumen.',
    question: 'Seluruh 34 trip CASH tercatat tanpa No. Referensi (TR) dan tanpa No PI. Apakah CASH memang nama klien, atau sebenarnya jenis order / cara bayar yang seharusnya jadi field tersendiri?',
  },
  {
    id: 'TBD-10',
    title: 'Satuan cetak Surat Jalan',
    current: 'Karawang: satu trip = satu mobil, dicetak satu Berita Acara Serah Terima Barang per trip (isian yang belum diketahui dicetak titik-titik). Priok: satu trip dicetak satu halaman Surat Jalan berisi daftar container bernomor.',
    question: 'Untuk Priok: apakah satu Surat Jalan dicetak sekali untuk semua container, atau satu halaman per container? Dan apakah tiap container punya nomor Surat Jalan sendiri?',
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
    question: 'Apakah keduanya hal yang sama? Bila ya, apakah ada saldo kasbon supir yang dikelola terpisah?',
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
    current: 'Memakai Tanggal Bon, Bon Pribadi, dan SI - JOB ORDER.',
    question: 'Bacaan awal dari layar lama adalah Tujuan, Jam.Brkt, dan St.Job — ketiganya lazim di trucking. Mana yang benar: Tujuan atau Tanggal Bon? Jam Berangkat atau Bon Pribadi? Status Job atau SI - Job Order?',
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
    title: 'Komisi Dedicated CDD (dicatat, belum diputuskan)',
    current: 'Aturan dari catatan meeting dipakai apa adanya dan belum diubah (12 Okt 2026): (nilai kontrak − 5%) × 2,5%, dihitung per kontrak, bukan per trip, dan tampil di halaman klien. Contoh: kontrak Rp 100 jt → dasar Rp 95 jt → komisi Rp 2.375.000.',
    question: 'Komisi kontrak Dedicated diberikan ke siapa (supir, manager, atau marketing), kapan dibayarkan (sekali, bertahap, atau per tahun), dan 5% itu potongan apa?',
  },
  {
    id: 'TBD-17',
    title: 'Cakupan pemisahan data antar workspace',
    current: 'Dua cabang, dua bisnis (Meeting 17 Sep 2026): Priok = container, Karawang = alat berat & DHL. Trip, Tagihan, Kontrak, Aturan Komisi, dan Dokumen umum terpisah per cabang. Master (karyawan, kendaraan, rute, klien, alamat, SI/JO) dan kasbon dipakai bersama.',
    question: 'Apakah master juga dipisah per cabang (di sistem lama, supir dan rute Priok berbeda dari supir SLB)? Perhitungan apa saja yang berbeda antara Priok dan Karawang: Uang Jalan Rute, komisi, tol, atau semuanya sama?',
  },
  {
    id: 'TBD-18',
    title: 'Uang Tol pada master Rute',
    current: 'Tol dibayar supir dari uang jalan (aturan 7 Okt 2026), lalu notanya dicatat di Biaya Operasional jenis Tol supaya ditagihkan ke klien sebagai Additional Cost PI. Tidak memotong transfer ke supir (rekap BJM: Transfer = Uang Jalan − potong kasbon di 314 dari 314 baris). Bila dibayar kartu e-toll perusahaan, pilih "dibayar perusahaan": dihitung sebagai biaya di luar uang jalan. Uang Tol di rute hanya patokan.',
    question: 'Tol dan solar biasanya dibayar supir dari uang jalan, atau perusahaan langsung (e-toll, voucher solar)? Ini menentukan pilihan bawaan saat admin mencatat biaya. Solar (DEX) sekarang bawaannya ditagihkan ke klien untuk semua trip: benar untuk semua klien dan layanan, atau hanya trip tertentu?',
  },
  {
    id: 'TBD-19',
    title: 'Biaya Internal pada detail trip',
    current: 'Dicatat terpisah dari biaya operasional, belum mengurangi netto. Jenis "Uang Jalan" dihapus: uang jalan hanya dicatat di tab Uang Jalan.',
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
    question: 'Apakah "finance balance" memang sisa nilai kontrak setelah dikurangi biaya trip, atau nilai yang sudah ditagih ke klien dibanding nilai kontrak?',
  },
  {
    id: 'TBD-21',
    title: 'Multi drop (belum dibangun)',
    current: 'Belum dibangun (12 Okt 2026): satu trip = satu pengirim (pick up) + satu penerima (destinasi). Dua cara yang bisa dipilih nanti: (a) tiap drop berikutnya dicatat sebagai Backload / Rute Lanjutan (ID -BL, -BL2; kendaraan & supir sama; uang jalan, POD, dan PI sendiri), bisa dipakai sekarang tanpa perubahan data; (b) satu trip dengan beberapa penerima (daftar drop: penerima, No. Referensi, waktu terima, POD per drop), perlu tabel baru dan Berita Acara per drop.',
    question: 'Pada multi drop, PI-nya satu untuk semua drop atau per drop? Uang jalan dan Berita Acara satu atau per drop? Perlu tanggal terima barang per drop? Jawabannya menentukan cara (a) atau (b).',
  },
  {
    id: 'TBD-22',
    title: 'Nominal rute (Uang Jalan Rute, Harga, Uang Tol)',
    current: 'Spreadsheet belum memuat nominal rute. Sementara diisi dari trip asli (median uang jalan, COST, dan biaya Tol per rute); rute tanpa data diberi perkiraan dan bertanda "perkiraan" di menu Rute.',
    question: 'Mohon daftar resmi Uang Jalan Rute (UJROUTE), Harga, dan Uang Tol per rute, supaya nilai perkiraan bisa diganti.',
  },
  {
    id: 'TBD-23',
    title: 'Tahap PI data lama',
    current: 'Trip di rekap yang sudah punya No PI diberi tahap PI Dikirim, karena rekap tidak mencatat tahapnya. Kolom "Status PI" spreadsheet (di pool, masih moving, paket) disimpan sebagai catatan lama; "di pool" dibaca sebagai dokumen fisik sudah diterima. Nilai PI kini dibekukan saat PI dibuat (12 Okt 2026); trip lama yang sudah ber-PI diberi nilai beku dari nilai sekarang, sekali saat data dimuat.',
    question: 'PI lama mana yang sudah Disetujui atau Lunas? Apakah PI dibuat per trip (seperti Summary Submission PI: satu baris satu PI), atau ada PI yang menggabungkan beberapa trip?',
  },
  {
    id: 'TBD-24',
    title: 'Uang Dorong dan Uang Pulang',
    current: 'Keduanya uang untuk supir, jadi dicatat sebagai termin uang jalan berjenis Uang Dorong / Uang Pulang, bukan biaya operasional (aturan 7 Okt 2026: semua uang perjalanan adalah uang jalan). Uang dorong dicatat di trip backload / rute lanjutannya; di tab Biaya Operasional hanya tampil baca-saja bertanda "dari Uang Jalan", tidak ikut dijumlah dan tidak ditagihkan (12 Okt 2026). Nominalnya belum diatur, jadi tidak dibatasi patokan Uang Jalan Rute dan Admin boleh mencatatnya. Empat catatan Uang Dorong di data lama dipindahkan otomatis menjadi termin.',
    question: 'Apakah uang dorong selalu sebesar Uang Jalan Rute rute backload, atau nominal tersendiri? Uang pulang punya patokan per rute atau dinilai per kejadian? Perlu persetujuan Manager / Owner seperti uang tambahan?',
  },
  {
    id: 'TBD-25',
    title: 'Biaya cancel (cancel fee)',
    current: 'Saat membatalkan trip Karawang, Manager / Owner boleh mengisi biaya cancel yang tetap ditagihkan ke klien. Trip batal itu masuk Tagihan (Siap PI) senilai biaya cancel, tetapi tidak ikut laporan pendapatan & netto.',
    question: 'Siapa yang menentukan besaran cancel fee, dan apakah supir tetap dapat komisi atau uang jalan untuk trip yang dibatalkan setelah berangkat?',
  },
  {
    id: 'TBD-26',
    title: 'Trailer, equipment, dan helper per trip',
    current: 'Trip kini mencatat Sub Kendaraan / Gandengan (Hi Bed, Low Bed, Dolly, Tronton, CDD, ...) sebagai jenis: terisi otomatis dari konfigurasi kendaraan, bisa diubah, dan tercetak di Berita Acara (12 Okt 2026). Nomor trailer / equipment dan nama helper belum dicatat, karena master Trailer / Equipment belum ada.',
    question: 'Perlukah master Trailer / Equipment bernomor (seperti Kendaraan: nomor, jenis, status) yang dipilih per trip dan ikut tertahan sampai kembali ke pool, atau cukup jenisnya? Helper dibayar dari mana dan perlu masuk Kernet di laporan netto?',
  },
  {
    id: 'TBD-27',
    title: 'Lokasi muat & bongkar, Master Data Alamat (terjawab)',
    current: 'Sudah dibuat (12 Okt 2026): Master Data → Alamat menyimpan kode area, nama lokasi, alamat, kota, PIC & telepon, koordinat, dan ID lokasi klien seperti di Order Release SLB. Form trip memilih pengirim (pick up) dan penerima (destinasi) dari master atau mengetik manual (bisa langsung disimpan ke master); trip menyimpan salinannya, jadi perubahan master tidak mengubah trip lama. Lokasi muat & bongkar tetap diambil dari nama rute dan bisa diubah per trip; backload memakai lokasi bongkar trip asal sebagai lokasi muat.',
    question: 'Tidak ada lagi. Catatan ini disimpan sebagai riwayat.',
  },
  {
    id: 'TBD-28',
    title: 'SC dan HC pada rekap biaya',
    current: 'Kolom SC dan HC ada di susunan rekap atasan, tetapi belum ada datanya dan belum dimasukkan sebagai jenis biaya (12 Okt 2026). Jenis biaya sekarang: Tol, DEX (solar), SPSI Banlok, Overnight, Escort, ASDP, Double Driver, Reimbus, Lainnya.',
    question: 'SC dan HC kepanjangannya apa, siapa yang membayar (supir dari uang jalan atau perusahaan langsung), dan apakah ditagihkan ke klien di PI? Perlu dijadikan jenis biaya operasional baru?',
  },
  {
    id: 'TBD-29',
    title: 'Tabel komisi Manager (marketing) dan Supir (dicatat, belum diputuskan)',
    current: 'Tabel komisi manager vs supir dari catatan atasan sudah dicatat tetapi belum diputuskan, jadi aturan komisi belum diubah (12 Okt 2026). Yang berlaku: komisi supir Callout bertingkat dari harga trip (Rp 50 rb untuk 1–10 jt sampai Rp 250 rb untuk ≥ 41 jt). Aturan peran Manager bisa dibuat di Komisi → tab Aturan tetapi belum ada isinya, jadi komisi manager masih Rp 0. Hanya Owner yang boleh mengubah aturan; Manager & Admin hanya melihat.',
    question: 'Bagaimana tabel komisi Manager (marketing): dasarnya harga trip, uang jalan, atau nominal tetap per trip, dan berapa tingkatnya? Apakah Manager dan Supir sama-sama dapat komisi dari trip yang sama? Komisi manager ikut mengurangi netto?',
  },
  {
    id: 'TBD-30',
    title: 'Kendaraan tertahan sampai kembali ke pool',
    current: 'Aturan 12 Okt 2026: kendaraan yang masih dipakai trip lain tidak bisa dipilih trip baru sampai trip itu tercatat kembali di pool (Tutup Trip "sudah di pool", menu ⋯ "Tandai sudah di pool", atau kejadian "Tiba di pool" di tab Perjalanan). Kendaraan juga lepas bila trip dibatalkan atau dilanjutkan Backload / Rute Lanjutan (kendaraan pindah ke trip lanjutan). Supir yang masih di trip lain hanya diberi peringatan, tidak diblokir. Trip lama dari rekap dianggap sudah kembali.',
    question: 'Sekarang mobil yang sudah tercatat di pool langsung bisa dipakai walau tripnya belum ditutup (mis. POD belum lengkap). Benar begitu, atau harus menunggu trip ditutup? Perlukah supir juga diblokir, bukan hanya diberi peringatan?',
  },
  {
    id: 'TBD-31',
    title: 'ID Trip dan ID Perjalanan',
    current: 'Atasan (13 Okt 2026) memakai Kode Trip sebagai ID Trip: YYYYMM + 4 digit urut (2026100001), langsung dibuat saat Tambah Trip diklik dan menjadi judul form; backload = kode trip asal + "-BL". ID Perjalanan pindah ke Add Items Details (ID Perjalanan + keterangan barang per item), boleh kosong. ID Perjalanan yang dulu dibuatkan sistem untuk trip lama dibuang.',
    question: 'ID Perjalanan dipakai untuk apa dan siapa yang menerbitkannya (klien atau BJM)? Perlukah tombol buat otomatis, atau selalu diketik dari dokumen klien?',
  },
  {
    id: 'TBD-32',
    title: 'Kode area dari nama rute & salah ketik',
    current: 'Kode area pick up & destinasi diturunkan dari nama rute "ASAL - TUJUAN" (nomor site di ujung dibuang: RAWA 52 → RAWA, KB 575 1 → KB 575) atau diisi sendiri di master Rute. Di data asli ada ejaan ganda untuk tempat yang sama (JONGGOL / JONNGOL, PUNINAR / PUNIAR, SECANGGANG / SECANGNGGANG / SICANGGANG, REBONJARO / REBON JARO / REBENOJARO), sehingga satu lokasi bisa terpecah menjadi beberapa kode area. Form Rute memberi peringatan bila kode area mirip kode lain.',
    question: 'Siapa yang menetapkan daftar kode area resmi dan merapikan nama rute yang salah ketik? Perlukah master Kode Area tersendiri yang dipakai Rute dan Alamat?',
  },
  {
    id: 'TBD-33',
    title: 'Administrator = Admin',
    current: 'Susunan menu atasan menyebut peran Administrator; di prototipe peran ini bernama Admin: input & ubah trip harian (termasuk uang jalan) dan mencatat nota biaya operasional. Owner = super admin; Manager boleh semua kecuali hapus trip permanen, ubah aturan komisi, dan atur pengguna.',
    question: 'Benarkah Administrator sama dengan Admin di prototipe, atau peran tersendiri (mis. pengelola akun & pengaturan)?',
  },
  {
    id: 'TBD-34',
    title: 'Kosongan di form trip Karawang',
    current: 'Kosongan = depo tempat mengambil / mengembalikan container kosong (mis. DEPO MUSTIKA CAKUNG). Dipakai terutama di Priok (container). Di form trip Karawang tetap ada sebagai isian opsional untuk trip yang membawa container (revisi 13 Okt 2026).',
    question: 'Di Karawang, Kosongan perlu tetap ada (opsional) atau disembunyikan dan hanya muncul di workspace Priok?',
  },
  {
    id: 'TBD-35',
    title: 'Tanda saldo piutang karyawan',
    current: 'Mengikuti atasan (13 Okt 2026): piutang tampil minus, pelunasan plus. Saldo memakai tanda yang sama di daftar karyawan, kartu, dan tabel (−Rp 300.000 merah = masih punya piutang), supaya satu angka tidak tampil dengan dua tanda berbeda. Perhitungannya sama seperti sebelumnya.',
    question: 'Saldo boleh bertanda minus seperti ini, atau kolom Saldo di tabel transaksi tetap positif (Rp 300.000) seperti sebelumnya?',
  },
  {
    id: 'TBD-36',
    title: 'Isian form trip di luar mock',
    current: 'Form trip mengikuti mock 1a & 1b. Ditambah Tanggal Berangkat (dipakai Berita Acara, laporan, dan periode; bawaan hari ini) dan No. Kontrak yang muncul hanya untuk klien Dedicated. Tipe layanan, lokasi muat / bongkar, tanggal order, dan status terisi otomatis. Manager trip dipilih di tab Komisi.',
    question: 'Tanggal Berangkat di form trip boleh tetap ada? Manager trip cukup dipilih di tab Komisi?',
  },
  {
    id: 'TBD-37',
    title: 'Istilah Sopir atau Supir',
    current: 'Menu memakai "Supir / Karyawan", sedangkan mock atasan 13 Okt 2026 memakai "Sopir" di tabel & form trip (judul kartunya "Kendaraan dan Supir"). Prototipe memakai "Supir" di semua tempat supaya seragam. KBBI: bentuk baku "sopir".',
    question: 'Pakai "Supir" (seperti menu sekarang) atau "Sopir" (baku KBBI, seperti mock) di seluruh aplikasi?',
  },
  {
    id: 'TBD-38',
    title: 'Jenis dokumen penting',
    current: 'Karyawan: KTP, SIM (berlaku s/d), Kartu Keluarga, NPWP, ditambah dokumen lainnya. Kendaraan: STNK, KIR, Pajak Kendaraan, Asuransi (semuanya berlaku s/d), ditambah foto & dokumen lainnya. Dokumen yang habis / habis dalam 30 hari ditandai merah di daftar.',
    question: 'Perlu jenis lain sebagai tempat khusus (mis. BPJS, SKCK karyawan; BPKB kendaraan)? Perlu nomor dokumen (mis. nomor SIM) selain berkasnya?',
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
    /** Harga yang diisi di trip saja (kolom COST data lama), tanpa Harga Rute. */
    cost: rows.reduce((a, r) => a + r.cost_value, 0),
  }
}

/** Perubahan persen antar dua periode; null bila pembanding nol. */
export function deltaPersen(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
