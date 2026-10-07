/**
 * SIKOTIS - domain types.
 * Nama field mengikuti kosakata bisnis yang dipakai PT Bimajaya Mustika:
 * SIJO, Data Cost, Kode Cust, UJROUTE, Komisi Sopir, S/JO, Ritan, Bon Pribadi.
 */

/**
 * Peran pengguna (Meeting 17 Sep 2026): Owner (wewenang tertinggi), Manager (wewenang
 * menengah), Admin (input harian). Viewer hanya melihat & export. Izin per aksi ada di
 * AuthProvider (IZIN).
 */
export type Role = 'owner' | 'manager' | 'admin' | 'viewer'
export const ROLE_PENGGUNA: Record<Role, { label: string; ringkas: string }> = {
  owner: { label: 'Owner', ringkas: 'akses penuh' },
  manager: { label: 'Manager', ringkas: 'semua kecuali hapus trip & atur pengguna' },
  admin: { label: 'Admin', ringkas: 'input & ubah trip harian' },
  viewer: { label: 'Viewer', ringkas: 'hanya lihat & export' },
}

export interface User {
  username: string
  name: string
  role: Role
}

/**
 * Workspace = cabang, dan tiap cabang bisnisnya berbeda (Meeting 17 Sep 2026):
 * - priok    : Tanjung Priok, angkutan container (SI/JO, Party, Kapal).
 * - karawang : truk kepala + gandengan (Hi Bed, Low Bed, Dolly, Tronton, CDD),
 *              klien utama DHL; ada yang kontrak dan ada yang ikut pricelist rute.
 * Karawang adalah workspace utama dan bawaan saat login (6 Okt 2026).
 */
export const WORKSPACES = ['karawang', 'priok'] as const
export type Workspace = (typeof WORKSPACES)[number]

/**
 * Ditempel pada entitas transaksional. Opsional supaya data lama tetap terbaca;
 * nilai kosong diperlakukan sebagai Priok (lihat migrasi di persistence.ts).
 */
export interface WorkspaceScoped {
  workspace?: Workspace
}

/**
 * Lampiran (gambar / PDF) tidak disimpan di dalam record: isinya tinggal di
 * IndexedDB (lib/lampiran.ts), record hanya menyimpan daftar id-nya.
 */
export type Lampiran = string[]

/** Peran karyawan. Sopir adalah karyawan yang membawa kendaraan. */
export const EMPLOYEE_ROLES = ['sopir', 'manager'] as const
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number]
export const ROLE_LABEL: Record<EmployeeRole, string> = { sopir: 'Sopir', manager: 'Manager' }

/**
 * Master -> Data Karyawan (dulu Data Sopir).
 * Nama tipe dan koleksinya tetap `Driver` / `drivers` supaya data lama tetap
 * terbaca; yang berubah adalah maknanya: karyawan dengan peran.
 */
export interface Driver {
  id: string
  driver_code: string            // Kode
  driver_name: string            // Nama
  role: EmployeeRole             // Peran: sopir / manager
  address_1: string              // Alamat   (alamat jalan)
  address_2: string              // Alamat 2 (kecamatan / area)
  city: string                   // Kota
  phone: string
  status: 'aktif' | 'nonaktif'
  attachments: Lampiran          // KTP, SIM, dan dokumen lain karyawan
  created_at: string
  updated_at: string
}

/** Master -> Data Route */
/** Nominal pada route yang bisa berstatus perkiraan. */
export type RouteNominal = 'ujroute' | 'toll' | 'price'

export interface Route {
  id: string
  route_code: string             // No. Route
  route_name: string             // Nama Route
  project_id: string             // Project pemilik route - satu route, satu project
  feet: string                   // Feet - ukuran container, mis. 1X40 (1 x 40 kaki)
  ujroute: number                // UJROUTE - uang jalan baku untuk route ini
  toll: number                   // Uang Tol - patokan tol; yang dibayar dicatat di biaya operasional
  /**
   * Peninggalan kolom "Komisioner" aplikasi lama. Tidak dipakai lagi: komisi
   * kini dihitung dari master Komisi (bertingkat per kendaraan & layanan).
   */
  commissioner: number
  price: number                  // Harga
  /**
   * Nominal yang masih perkiraan: belum ada di data trip maupun diisi admin.
   * Ditampilkan bertanda "perkiraan" sampai nilainya diubah lewat form route.
   */
  estimated_fields?: RouteNominal[]
  created_at: string
  updated_at: string
}

/** Konfigurasi kendaraan - sebelumnya menempel pada nama sopir di spreadsheet. */
export const VEHICLE_CONFIGS = ['6X6', '4X4', 'DL', 'LB', 'HB', 'EXT', 'TRONTON', 'DOLLY', 'CDD'] as const

export interface Vehicle {
  id: string
  plate_number: string           // No. Kendaraan
  vehicle_type: string
  configuration: string          // 6X6, DL, LB, HB, EXT, TRONTON, DOLLY - boleh kosong
  status: 'aktif' | 'servis' | 'nonaktif'
  attachments: Lampiran          // Foto kendaraan, STNK, dsb.
  created_at: string
  updated_at: string
}

/**
 * Jenis klien:
 * - tetap   : pelanggan rutin, order per perjalanan (layanan Callout)
 * - kontrak : perusahaan lain yang memakai jasa lewat kontrak (layanan Dedicated)
 */
export const CLIENT_TYPES = ['tetap', 'kontrak'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]
export const CLIENT_TYPE_LABEL: Record<ClientType, string> = { tetap: 'Klien tetap', kontrak: 'Klien kontrak' }

/** Master -> Klien (SLB, ATLAS, PDT, ...): pemilik trip dan kontrak Dedicated. */
export interface Project {
  id: string
  project_code: string
  project_name: string
  client_type: ClientType
  description: string
  /** CASH tidak punya alur dokumen (tanpa TR / No PI) - lihat TBD-09. */
  requires_document: boolean
  status: 'aktif' | 'nonaktif'
  created_at: string
  updated_at: string
}

/** SI / Job Order */
export interface JobOrder {
  id: string
  sijo: string                   // Sijo - S / JO
  customer_code: string          // Kode Cust
  customer_name: string          // Customer
  customer_address: string
  party: string                  // Party
  ship: string                   // Kapal
  goods: string                  // Barang
  is_complete: boolean           // Komplit
  created_at: string
  updated_at: string
}

/**
 * Status trip. Spreadsheet mencampur status ke kolom dokumen, jadi dipisah.
 * menunggu_sopir: order sudah ada tetapi sopirnya belum ditentukan / belum datang.
 */
export type TripStatus = 'draft' | 'menunggu_sopir' | 'aktif' | 'selesai' | 'batal'

/**
 * Jenis layanan, dipilih di awal form trip.
 * - callout   : order per perjalanan (form lengkap)
 * - dedicated : kendaraan dikontrak satu client; wajib nomor kontrak
 */
export const SERVICE_TYPES = ['callout', 'dedicated'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]
export const SERVICE_LABEL: Record<ServiceType, string> = { callout: 'Callout', dedicated: 'Dedicated' }

/** Kontrak layanan Dedicated milik satu klien; dikelola di Master -> Klien. */
export interface Contract extends WorkspaceScoped {
  id: string
  contract_no: string            // Nomor Kontrak
  project_id: string             // Klien pemilik kontrak
  value: number                  // Nilai kontrak
  start_date: string
  end_date: string
  status: 'aktif' | 'selesai'
  notes: string
  attachments: Lampiran          // Dokumen kontrak
  created_at: string
  updated_at: string
}

/** Penyelesaian uang jalan yang sudah diterima sopir saat trip dibatalkan. */
export interface PenyelesaianUj {
  uj_payment_id: string
  driver_id: string
  tf: number                     // yang sudah ditransfer ke sopir
  cara: 'kembali' | 'kasbon'     // dikembalikan tunai / dijadikan kasbon sopir
}

/**
 * Transaksi -> Trip.
 *
 * Satu record = satu perjalanan beserta dokumen Surat Jalan-nya DAN catatan
 * keuangannya (uang jalan, biaya operasional, biaya internal, lainnya).
 * Dulu terpisah menjadi Surat Jalan dan Data Pengeluaran; keduanya digabung
 * supaya setiap perjalanan punya satu tempat untuk seluruh catatannya.
 *
 * Nama tipe dan koleksi (`transactions`) dipertahankan karena seluruh laporan
 * membaca dari sini.
 */
export interface CommissionTransaction extends WorkspaceScoped {
  id: string
  transaction_no: string         // Nomor Trip (NoTrans)
  transaction_date: string       // Tanggal Berangkat: hari trip jalan (ISO yyyy-mm-dd)
  order_date?: string            // Tanggal Order: hari permintaan klien masuk; trip lama boleh kosong
  service_type: ServiceType      // Callout / Dedicated
  contract_id: string            // Kontrak, wajib untuk Dedicated

  /* Konfigurasi */
  trip_ids: string[]             // ID Perjalanan / Trip. Karawang: satu ID per trip; Priok: nomor container, boleh lebih dari satu
  route_id: string               // Rute - satu per trip
  /**
   * Karawang: TR = nomor order klien (Order Release DHL/SLB). Satu trip boleh membawa
   * beberapa TR, dan TR yang sama boleh dipakai trip lain (satu order, banyak mobil).
   * Tidak pernah dibuat sistem. Data lama memakai tr_reference (satu nilai).
   */
  tr_numbers?: string[]
  /** Karawang: lokasi muat & bongkar di Berita Acara; kosong = diambil dari nama rute "ASAL - TUJUAN". */
  lokasi_muat?: string
  lokasi_bongkar?: string
  /** Backload: trip ini membawa muatan balik dari lokasi bongkar trip asal (id trip asal). */
  backload_dari?: string
  /** Ditandai saat Tutup Trip: ada muatan balik dari lokasi bongkar. */
  ada_backload?: boolean

  /* Informasi dokumen */
  sj_no: string                  // Nomor Surat Jalan (dokumen cetak)
  manager_id: string             // Manager terdaftar (karyawan berperan manager)
  manager_name: string           // ...atau diisi manual
  project_id: string             // Project (SLB / CASH / ATLAS / PDT)
  status: TripStatus

  /* Penerima */
  recipient_name: string         // Kepada Yth
  recipient_address_1: string    // di (baris 1)
  recipient_address_2: string    // di (baris 2)

  /* Pengiriman */
  vehicle_id: string             // No. Kendaraan
  driver_id: string              // Sopir utama = driver_ids[0]; dipakai laporan
  driver_ids: string[]           // Seluruh sopir trip ini
  job_order_id: string           // SI / BL
  party: string
  goods_type: string             // Jenis Brg
  kosongan: string
  location: string               // Lokasi
  ship: string                   // Kapal
  destination_detail: string     // Tujuan

  /* Identifier dokumen - TR / SIJO / No PI sengaja DIPISAH (TBD-08) */
  /** Data lama: satu TR. Karawang kini memakai tr_numbers. */
  tr_reference: string
  pi_number: string              // No PI (Proforma Invoice), satu per trip
  /** Catatan lama kolom "Status PI" spreadsheet (mis. "di pool", "masih moving"). Tahap PI ada di pi_tahap. */
  pi_status: string
  /** Tahap tagihan PI (Karawang): PI Tercetak -> Dikirim -> Revisi -> Disetujui -> Lunas. */
  pi_tahap?: PiTahap
  pi_date?: string               // Tanggal PI dibuat
  pi_tahap_date?: string         // Tanggal tahap PI terakhir berubah
  pi_note?: string               // Catatan revisi / persetujuan PI
  /** Bukti tahap PI: scan PI, tanda terima kirim, email persetujuan, bukti transfer. */
  pi_attachments?: string[]
  /* Penutupan trip (Receive all POD / bukti dokumen fisik) */
  closed_at?: string | null
  /** true = dokumen fisik bertanda tangan sudah diterima di pool; false = baru foto, fisik menyusul. */
  pod_fisik?: boolean
  /** Tanggal dokumen fisik POD diterima (saat ditutup, atau menyusul setelahnya). */
  pod_fisik_at?: string | null
  pod_attachments?: string[]     // Foto POD (BA / SJ / TR bertanda tangan penerima)
  /** Biaya cancel yang tetap ditagihkan ke klien saat trip dibatalkan (disetujui Manager / Owner). */
  cancel_fee?: number
  cost_value: number             // Harga trip (kolom COST di spreadsheet); 0 = memakai Harga route
  override_note?: string         // Alasan harga trip berbeda dari Harga route (override oleh Manager/Owner)
  override_attachments?: string[] // Bukti persetujuan override (gambar/berkas)

  notes: string
  is_marked: boolean
  bon_date: string | null        // Tgl Bon     (dipakai di Cek Ritan)
  personal_bon: number           // Bon Pribadi (dipakai di Cek Ritan)
  printed_at: string | null      // null = belum dicetak
  /* Pembatalan: catatan keuangan tetap disimpan sebagai arsip. */
  cancelled_at: string | null
  cancel_reason: string
  cancel_settlement: PenyelesaianUj[]
  /** Peninggalan data lama; nilainya kini ada di trip_ids. */
  container_no: string
  created_at: string
  updated_at: string
}

/**
 * Jenis termin uang jalan. Uang jalan = seluruh uang untuk sopir selama perjalanan,
 * dari mesin nyala sampai kembali ke pool (aturan 7 Okt 2026): termasuk uang dorong
 * (lanjut backload), uang pulang (pulang kosong), dan tambahan di luar patokan.
 */
export const JENIS_TERMIN = ['uj', 'uang_dorong', 'uang_pulang', 'tambahan'] as const
export type JenisTermin = (typeof JENIS_TERMIN)[number]
export const JENIS_TERMIN_LABEL: Record<JenisTermin, string> = {
  uj: 'Uang jalan', uang_dorong: 'Uang dorong', uang_pulang: 'Uang pulang', tambahan: 'Tambahan',
}

/**
 * Pembayaran Uang Jalan per termin. Satu trip bisa punya banyak termin
 * (data real: sampai 4). Aturan TERVERIFIKASI: tf_amount = uj_amount - kasbon_deduction
 */
export interface UjPayment {
  id: string
  trip_id: string
  sequence: number               // Termin ke-
  payment_date: string
  driver_id: string              // Sopir penerima; kasbon yang dipotong milik sopir ini
  jenis?: JenisTermin            // Kosong = uang jalan biasa
  uj_amount: number              // UJ
  kasbon_deduction: number       // Potong Kasbon
  notes: string
  attachments: Lampiran
  created_at: string
  updated_at: string
}

/**
 * Jenis biaya operasional - master, bukan kolom database permanen.
 * Biaya operasional = nota pemakaian uang jalan sopir (solar, tol, ASDP, SPSI, nginap, ...),
 * bukan uang tambahan untuk sopir: uang dorong & uang pulang dicatat sebagai termin uang jalan.
 */
export const EXPENSE_TYPES = ['DEX', 'Tol', 'ASDP', 'SPSI', 'Nginap', 'Escort', 'Reimbus', 'Double Driver', 'Lainnya'] as const
export type ExpenseType = (typeof EXPENSE_TYPES)[number]

/**
 * Biaya di luar tanggungan perusahaan (Meeting 17 Sep 2026): ikut ditagihkan ke klien
 * sebagai Additional Cost di PI, seperti di Summary Submission PI (TOL, ASDP, DEX,
 * SPSI, OVERNIGHT, ESCORT). Per biaya tetap bisa diubah.
 */
export const BIAYA_DITAGIHKAN: readonly string[] = ['DEX', 'Tol', 'ASDP', 'SPSI', 'Nginap', 'Escort']

/**
 * Siapa yang membayar biaya di jalan.
 * - sopir      : dari uang jalan yang sudah diterima -> bukan biaya tambahan perusahaan
 * - perusahaan : dibayar langsung (voucher solar, kartu e-toll, transfer) -> biaya di luar uang jalan
 * Keduanya tidak mengubah transfer ke sopir (rekap BJM: TF = UJ - potong kasbon, 314/314 baris).
 */
export const PEMBAYAR_BIAYA = ['sopir', 'perusahaan'] as const
export type PembayarBiaya = (typeof PEMBAYAR_BIAYA)[number]
export const PEMBAYAR_LABEL: Record<PembayarBiaya, string> = { sopir: 'Sopir, dari uang jalan', perusahaan: 'Perusahaan langsung' }

export interface OperationalExpense {
  id: string
  trip_id: string
  expense_type: string
  amount: number
  expense_date: string
  notes: string
  /** Ikut ditagihkan ke klien di PI. Kosong = mengikuti jenisnya (BIAYA_DITAGIHKAN). */
  ditagihkan?: boolean
  /** Kosong = sopir, dari uang jalan. */
  dibayar?: PembayarBiaya
  attachments: Lampiran
  created_at: string
  updated_at: string
}

/**
 * Jenis biaya internal - pengeluaran perusahaan sendiri atas satu trip.
 * "Komisi" meminta penerimanya: peran dan nama (terdaftar atau manual).
 * Uang jalan tidak ada di sini: UJ hanya dicatat di tab Uang Jalan.
 */
export const INTERNAL_COST_TYPES = ['Uang Makan', 'Kernet', 'Komisi', 'Servis & Sparepart', 'Gaji Sopir', 'Administrasi', 'Lainnya'] as const
export type InternalCostType = (typeof INTERNAL_COST_TYPES)[number]

/** Trip -> Biaya Internal. */
export interface InternalCost {
  id: string
  trip_id: string
  cost_type: string
  amount: number
  cost_date: string
  notes: string
  /* Diisi bila cost_type = Komisi */
  recipient_role: EmployeeRole | ''
  recipient_id: string           // karyawan terdaftar
  recipient_name: string         // ...atau diisi manual
  attachments: Lampiran
  created_at: string
  updated_at: string
}

/**
 * Trip -> Perjalanan: kejadian selama trip, dari pick up sampai kembali ke pool.
 * Jenisnya mengikuti isian Berita Acara Serah Terima (menginap, dialihkan,
 * dikembalikan, tiba di site, selesai bongkar) ditambah istirahat dan pool.
 */
export const JENIS_PERJALANAN = ['pickup', 'istirahat', 'menginap', 'kendala', 'dialihkan', 'tiba', 'bongkar', 'retur', 'pool'] as const
export type JenisPerjalanan = (typeof JENIS_PERJALANAN)[number]
export const PERJALANAN_LABEL: Record<JenisPerjalanan, string> = {
  pickup: 'Pick up barang',
  istirahat: 'Istirahat / rest area',
  menginap: 'Menginap',
  kendala: 'Kendala di jalan',
  dialihkan: 'Dialihkan / relokasi',
  tiba: 'Tiba di tujuan (ATA)',
  bongkar: 'Selesai bongkar',
  retur: 'Dikembalikan (retur)',
  pool: 'Tiba di pool',
}

export interface TripEvent {
  id: string
  trip_id: string
  jenis: JenisPerjalanan
  /** Tanggal & jam kejadian: yyyy-mm-ddThh:mm */
  waktu: string
  lokasi: string
  catatan: string
  attachments: Lampiran          // Manifest, foto barang, BA bertanda tangan, foto lokasi
  created_at: string
  updated_at: string
}

/** Tahap tagihan PI Karawang (alur atasan): setelah trip selesai sampai dibayar klien. */
export const PI_TAHAP = ['tercetak', 'dikirim', 'revisi', 'disetujui', 'lunas'] as const
export type PiTahap = (typeof PI_TAHAP)[number]
export const PI_TAHAP_LABEL: Record<PiTahap, string> = {
  tercetak: 'PI Tercetak', dikirim: 'PI Dikirim', revisi: 'PI Revisi', disetujui: 'Disetujui', lunas: 'Lunas',
}

/** Trip -> Lainnya: berkas atau catatan lain yang menyertai perjalanan. */
export interface TripNote {
  id: string
  trip_id: string
  note_date: string
  title: string
  notes: string
  attachments: Lampiran
  created_at: string
  updated_at: string
}

/**
 * Jenis mutasi kasbon karyawan.
 * - admin      : kasbon diberikan perusahaan          (menambah)
 * - trip       : dipotong dari uang jalan sebuah trip (mengurangi)
 * - pembatalan : trip dibatalkan, potongannya kembali (menambah)
 * - manual     : penyesuaian, arahnya dipilih         (menambah / mengurangi)
 */
export const KASBON_KINDS = ['admin', 'trip', 'pembatalan', 'manual'] as const
export type KasbonKind = (typeof KASBON_KINDS)[number]
export const KASBON_LABEL: Record<KasbonKind, string> = {
  admin: 'Kasbon dari Admin',
  trip: 'Potong dari Trip',
  pembatalan: 'Pembatalan Trip',
  manual: 'Penyesuaian Manual',
}

/**
 * Satu mutasi kasbon. `amount` bertanda: positif menambah kasbon (utang
 * karyawan ke perusahaan), negatif menguranginya. Saldo = jumlah seluruh
 * mutasi milik karyawan itu.
 *
 * Mutasi berjenis "trip" dibuat otomatis dari termin uang jalan yang memotong
 * kasbon, dan tertaut lewat uj_payment_id. Saat trip dibatalkan, tiap potongan
 * dikembalikan dengan mutasi "pembatalan" yang menunjuk termin yang sama.
 * uj_payment_id terisi = mutasi otomatis, tidak bisa diubah manual.
 */
export interface KasbonEntry {
  id: string
  employee_id: string
  entry_date: string
  kind: KasbonKind
  amount: number
  trip_id: string
  uj_payment_id: string
  notes: string
  attachments: Lampiran
  created_at: string
  updated_at: string
}

/** Transaksi -> Data Tagihan */
export interface Billing extends WorkspaceScoped {
  id: string
  invoice_no: string             // No Faktur / Nofaktur
  job_order_id: string           // No. SI/JO
  cost_code: string              // Data Cost / Kodecost - BUKAN "Data Cust"
  billing_date: string           // Tgl Tagih
  withdrawal_date: string        // Tgl Tarik
  amount: number                 // Jumlah Rp
  guarantee_amount: number       // Jaminan Rp
  is_sunting: boolean            // SUNTING
  is_rejected: boolean           // DITOLAK
  paid_date: string | null       // Tanggal Lunas
  is_marked: boolean             // Tandai
  // Legacy fields - disimpan di model, bukan fokus UI utama (bagian 7.1)
  bl_no: string
  invoice_ref: string
  notes: string
  created_at: string
  updated_at: string
}

/** Satuan nilai komisi: nominal Rupiah, atau persen. */
export type CommissionUnit = 'rp' | 'persen'

/**
 * Nilai yang menjadi dasar tingkat komisi.
 * - nilai   : harga trip = Harga yang diisi di trip, atau Harga route bila kosong
 * - uj      : uang jalan = UJROUTE route, atau UJ yang dibayar bila UJROUTE kosong
 * - kontrak : nilai kontrak Dedicated (dihitung per kontrak, bukan per trip)
 */
export const DASAR_KOMISI = ['nilai', 'uj', 'kontrak'] as const
export type DasarKomisi = (typeof DASAR_KOMISI)[number]
export const DASAR_KOMISI_LABEL: Record<DasarKomisi, string> = {
  nilai: 'Harga trip',
  uj: 'Uang jalan (UJ)',
  kontrak: 'Nilai kontrak',
}

/** Satu tingkat komisi: bila capaian di antara target awal dan akhir. */
export interface CommissionTier {
  target_awal: number
  /** 0 berarti tanpa batas atas. */
  target_akhir: number
  commission: number
  commission_unit: CommissionUnit
}

/**
 * Master -> Komisi: satu-satunya sumber aturan komisi.
 * Satu pengaturan = satu peran + layanan + jenis kendaraan, dengan beberapa
 * tingkat. Komisi tiap trip dihitung otomatis dari aturan yang paling cocok.
 */
export interface CommissionScheme extends WorkspaceScoped {
  id: string
  name: string
  role: EmployeeRole             // Untuk: sopir / manager
  service_type: ServiceType | 'semua'
  configurations: string[]       // Konfigurasi kendaraan; kosong = semua
  basis: DasarKomisi             // Dasar hitung tingkat
  base_deduction_pct: number     // Potongan dasar sebelum komisi, mis. 5 (%)
  is_active: boolean             // Nonaktif = disimpan, tidak dipakai hitungan
  tiers: CommissionTier[]
  notes: string
  created_at: string
  updated_at: string
}

export interface Database {
  drivers: Driver[]
  routes: Route[]
  vehicles: Vehicle[]
  jobOrders: JobOrder[]
  transactions: CommissionTransaction[]
  billings: Billing[]
  projects: Project[]
  ujPayments: UjPayment[]
  expenses: OperationalExpense[]
  internalCosts: InternalCost[]
  tripNotes: TripNote[]
  tripEvents: TripEvent[]
  kasbonEntries: KasbonEntry[]
  commissionSchemes: CommissionScheme[]
  contracts: Contract[]
}

export type EntityKey = keyof Database

/** Baris trip yang sudah di-join untuk ditampilkan di tabel */
export interface TransactionRow extends CommissionTransaction {
  driver_code: string
  driver_name: string
  /** Nama seluruh sopir, dipisah koma. */
  driver_names: string
  plate_number: string
  sijo: string
  route_code: string
  route_name: string
  route_price: number
  /** Harga trip yang dipakai komisi & pendapatan: Harga trip, atau Harga route bila kosong. */
  harga: number
  /** true bila trip punya harga sendiri (bukan mengikuti Harga route). */
  harga_khusus: boolean
  ujroute: number
  toll: number
  commissioner: number
  project_code: string
  project_name: string
  /** Nama manager: dari karyawan terdaftar, atau isian manual. */
  manager_label: string
  /** Agregat dari uj_payments milik trip ini. */
  uj_total: number
  kasbon_total: number
  tf_total: number
  termin_count: number
  expense_total: number
  /** Agregat biaya internal milik trip ini. */
  internal_total: number
  /** Tol yang benar-benar dibayar: biaya operasional jenis Tol. */
  toll_paid: number
  vehicle_config: string
  contract_no: string
  /** Nama klien pemilik kontrak (Dedicated). */
  client_name: string
  /** TR trip ini (tr_numbers, atau tr_reference data lama). */
  tr_list: string[]
  /** Lokasi muat & bongkar: isian trip, atau dari nama rute. */
  muat: string
  bongkar: string
  /** Waktu tiba di tujuan (ATA) dari tab Perjalanan; kosong bila belum dicatat. */
  ata: string
  /** Kejadian terakhir di tab Perjalanan. */
  posisi: TripEvent | null
  /** Biaya operasional yang ikut ditagihkan ke klien (Additional Cost PI). */
  biaya_ditagihkan: number
  /** Biaya operasional yang dibayar perusahaan langsung, di luar uang jalan. */
  biaya_perusahaan: number
  /* Komisi otomatis dari master Komisi (0 untuk trip batal). */
  komisi_sopir: number
  komisi_manager: number
  /** Penjelasan singkat aturan & tingkat yang dipakai. */
  komisi_keterangan: string
}

export interface BillingRow extends Billing {
  sijo: string
  customer_name: string
  customer_code: string
  party: string
}
