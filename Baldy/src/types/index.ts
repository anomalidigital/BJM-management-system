/**
 * SIKOTIS - domain types.
 * Nama field mengikuti kosakata bisnis yang dipakai PT Bimajaya Mustika:
 * SIJO, Data Cost, Kode Cust, UJROUTE, Komisioner, S/JO, Ritan, Bon Pribadi.
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

/** Master -> Data Sopir */
export interface Driver {
  id: string
  driver_code: string            // Kode
  driver_name: string            // Nama Sopir
  address_1: string              // Alamat   (alamat jalan)
  address_2: string              // Alamat 2 (kecamatan / area - lihat catatan bagian 4 dokumen)
  city: string                   // Kota
  phone: string
  status: 'aktif' | 'nonaktif'
  created_at: string
  updated_at: string
}

/** Master -> Data Route */
export interface Route {
  id: string
  route_code: string             // No. Route
  route_name: string             // Nama Route
  feet: string                   // Feet - ukuran container, mis. 1X40 (1 x 40 kaki)
  ujroute: number                // UJROUTE - uang jalan baku untuk route ini
  toll: number                   // Uang Tol - biaya tol baku untuk route ini
  commissioner: number           // Komisi Sopir (dulu berlabel "Komisioner")
  price: number                  // Harga
  created_at: string
  updated_at: string
}

/** Konfigurasi kendaraan - sebelumnya menempel pada nama sopir di spreadsheet. */
export const VEHICLE_CONFIGS = ['6X6', '4X4', 'DL', 'LB', 'HB', 'EXT', 'TRONTON', 'DOLLY'] as const

export interface Vehicle {
  id: string
  plate_number: string           // No Mobil / No. Polisi
  vehicle_type: string
  configuration: string          // 6X6, DL, LB, HB, EXT, TRONTON, DOLLY - boleh kosong
  status: 'aktif' | 'servis' | 'nonaktif'
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

/** Status trip. Spreadsheet mencampur status ke kolom dokumen, jadi dipisah. */
export type TripStatus = 'draft' | 'aktif' | 'selesai' | 'batal'

/**
 * Transaksi -> Data Trip / Komisi.
 * Entity operasional inti. Identifier TR / SIJO / No PI sengaja DIPISAH -
 * belum ada bukti ketiganya merujuk hal yang sama.
 */
export interface CommissionTransaction extends WorkspaceScoped {
  id: string
  transaction_no: string         // NoTrans
  transaction_date: string       // Tanggal (ISO yyyy-mm-dd)
  driver_id: string              // Kode Sopir / Nama Sopir
  vehicle_id: string             // No Mobil
  job_order_id: string           // S / JO
  route_id: string               // Kode Route
  destination_detail: string     // Detail Tujuan
  container_no: string           // Kont
  project_id: string             // Project (SLB / CASH / ATLAS / PDT)
  tr_reference: string           // TR  - JANGAN disamakan dengan SIJO (TBD-08)
  pi_number: string              // No PI (nomor saja)
  pi_status: string              // status yang di spreadsheet tercampur ke No PI
  cost_value: number             // COST - makna bisnis belum dikonfirmasi (TBD-02)
  status: TripStatus
  notes: string
  is_marked: boolean             // Tandai
  bon_date: string | null        // Tgl Bon     (dipakai di Cek Ritan)
  personal_bon: number           // Bon Pribadi (dipakai di Cek Ritan)
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
  uj_amount: number              // UJ
  kasbon_deduction: number       // Potong Kasbon
  notes: string
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
  created_at: string
  updated_at: string
}

/**
 * Jenis biaya internal - pengeluaran perusahaan sendiri atas satu trip
 * (uang jalan, uang makan, kernet, dst). Dipisah dari biaya operasional
 * yang ditagihkan / dikeluarkan di jalan.
 */
export const INTERNAL_COST_TYPES = ['Uang Jalan', 'Uang Makan', 'Kernet', 'Servis & Sparepart', 'Gaji Sopir', 'Administrasi', 'Lainnya'] as const
export type InternalCostType = (typeof INTERNAL_COST_TYPES)[number]

/** Transaksi -> Data Komisi -> detail trip -> Biaya Internal. */
export interface InternalCost {
  id: string
  trip_id: string
  cost_type: string
  amount: number
  cost_date: string
  notes: string
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

/**
 * Transaksi -> Surat Jalan (addendum modul Surat Jalan).
 * Label field mengikuti dokumen: Kepada Yth, di, No.Polisi, Party, SI/BL,
 * Jenis Brg, Kosongan, Lokasi, Kapal, Tujuan.
 */
export interface DeliveryNote extends WorkspaceScoped {
  id: string
  sj_no: string                  // Nomor Surat Jalan
  sj_date: string                // Tanggal (ISO yyyy-mm-dd)
  recipient_name: string         // Kepada Yth
  recipient_address_1: string    // di (baris 1)
  recipient_address_2: string    // di (baris 2)
  vehicle_id: string             // No.Polisi
  driver_id: string              // Kode Sopir / Nama Sopir (mengikuti trip terkait)
  route_id: string               // Kode Route (mengikuti trip terkait)
  party: string                  // Party
  job_order_id: string           // SI/BL  -> relasi ke SI / Job Order
  goods_type: string             // Jenis Brg
  kosongan: string               // Kosongan
  location: string               // Lokasi
  ship: string                   // Kapal
  destination: string            // Tujuan
  containers: string[]           // No.Container (dinamis, tanpa batas jumlah)
  printed_at: string | null      // null = Draft, terisi = Tercetak
  created_at: string
  updated_at: string
}

/** Satuan nilai komisi: nominal Rupiah, atau persen. */
export type CommissionUnit = 'rp' | 'persen'

/**
 * Master -> Komisi. Daftar tarif komisi, bukan pemantauan.
 * Satu baris = satu aturan: komisi dasar dipakai selama target belum tercapai,
 * setelah tercapai memakai komisi target. Tiap nilai boleh nominal Rupiah atau
 * persen. Apa yang diukur target masih TBD-16.
 */
export interface CommissionScheme extends WorkspaceScoped {
  id: string
  name: string                   // Nama
  target: number                 // Target
  base_commission: number        // Komisi Dasar
  base_commission_unit: CommissionUnit
  target_commission: number      // Komisi Apabila Target Tercapai
  target_commission_unit: CommissionUnit
  notes: string                  // Catatan
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
  deliveryNotes: DeliveryNote[]
  projects: Project[]
  ujPayments: UjPayment[]
  expenses: OperationalExpense[]
  internalCosts: InternalCost[]
  commissionSchemes: CommissionScheme[]
}

export type EntityKey = keyof Database

/** Baris transaksi yang sudah di-join untuk ditampilkan di tabel */
export interface TransactionRow extends CommissionTransaction {
  driver_code: string
  driver_name: string
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
  /** Agregat dari uj_payments milik trip ini. */
  uj_total: number
  kasbon_total: number
  tf_total: number
  termin_count: number
  expense_total: number
  /** Agregat biaya internal milik trip ini. */
  internal_total: number
}

export interface BillingRow extends Billing {
  sijo: string
  customer_name: string
  customer_code: string
  party: string
}

export interface DeliveryNoteRow extends DeliveryNote {
  plate_number: string
  driver_code: string
  driver_name: string
  route_code: string
  route_name: string
  sijo: string
  container_no: string
  container_count: number
}
