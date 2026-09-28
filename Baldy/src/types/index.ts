/**
 * SIKOTIS - domain types.
 * Nama field mengikuti kosakata bisnis yang dipakai PT Bimajaya Mustika:
 * SIJO, Data Cost, Kode Cust, UJROUTE, Komisi Sopir, S/JO, Ritan, Bon Pribadi.
 */

export type Role = 'admin' | 'viewer'

export interface User {
  username: string
  name: string
  role: Role
}

/**
 * Workspace = area kerja / cabang. Satu aplikasi web, dua sistem management
 * yang datanya terpisah. Jakarta adalah workspace bawaan saat login.
 */
export const WORKSPACES = ['jakarta', 'tangerang'] as const
export type Workspace = (typeof WORKSPACES)[number]

/**
 * Ditempel pada entitas transaksional. Opsional supaya data lama tetap terbaca;
 * nilai kosong diperlakukan sebagai Jakarta (lihat migrasi di persistence.ts).
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

/** Master -> Data Project (SLB, ATLAS, PDT, ...). */
export interface Project {
  id: string
  project_code: string
  project_name: string
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

/** Master -> Data Kontrak: kontrak layanan Dedicated dengan satu client. */
export interface Contract extends WorkspaceScoped {
  id: string
  contract_no: string            // Nomor Kontrak
  client_name: string            // Nama client
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
  transaction_date: string       // Tanggal (ISO yyyy-mm-dd)
  service_type: ServiceType      // Callout / Dedicated
  contract_id: string            // Kontrak, wajib untuk Dedicated

  /* Konfigurasi */
  trip_ids: string[]             // ID Perjalanan / Trip - boleh lebih dari satu
  route_id: string               // Rute - satu per trip

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
  tr_reference: string
  pi_number: string
  pi_status: string
  cost_value: number             // COST - makna bisnis belum dikonfirmasi (TBD-02)

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
 * Pembayaran Uang Jalan per termin. Satu trip bisa punya banyak termin
 * (data real: sampai 4). Aturan TERVERIFIKASI: tf_amount = uj_amount - kasbon_deduction
 */
export interface UjPayment {
  id: string
  trip_id: string
  sequence: number               // Termin ke-
  payment_date: string
  driver_id: string              // Sopir penerima; kasbon yang dipotong milik sopir ini
  uj_amount: number              // UJ
  kasbon_deduction: number       // Potong Kasbon
  notes: string
  attachments: Lampiran
  created_at: string
  updated_at: string
}

/** Jenis biaya operasional - master, bukan kolom database permanen. */
export const EXPENSE_TYPES = ['DEX', 'Tol', 'SPSI', 'Nginap', 'Reimbus', 'Uang Dorong', 'Double Driver', 'Escort', 'Lainnya'] as const
export type ExpenseType = (typeof EXPENSE_TYPES)[number]

export interface OperationalExpense {
  id: string
  trip_id: string
  expense_type: string
  amount: number
  expense_date: string
  notes: string
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
 * - nilai   : nilai trip = COST trip, atau Harga route bila COST kosong
 * - uj      : uang jalan = UJROUTE route, atau UJ yang dibayar bila UJROUTE kosong
 * - kontrak : nilai kontrak Dedicated (dihitung per kontrak, bukan per trip)
 */
export const DASAR_KOMISI = ['nilai', 'uj', 'kontrak'] as const
export type DasarKomisi = (typeof DASAR_KOMISI)[number]
export const DASAR_KOMISI_LABEL: Record<DasarKomisi, string> = {
  nilai: 'Nilai trip (COST / Harga)',
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
  client_name: string
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
