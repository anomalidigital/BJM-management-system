import type {
  CommissionTransaction, Database, InternalCost, KasbonEntry, OperationalExpense, Project, Route, UjPayment,
} from '../types'
import { aturanKomisiMeeting, generateDatabase, generateSampleDatabase, makeKlienKontrak, projectDominanPerRoute, workspaceForSeed, CATATAN_KOMISI_CALLOUT, NAMA_KOMISI_CALLOUT } from '../data/dummy'
import { kasbonTerminContoh, keuanganTripContoh, lengkapiNominalRoute } from '../data/lengkapi'
import { petaSaldoKasbon } from '../lib/kasbon'
import { susunKasbonDariDataLama } from '../lib/kasbon'
import { todayISO } from '../lib/format'
import { kodeKlienBerikut, nomorTripBerikut } from '../lib/kode'
import { uid } from '../lib/utils'

const DB_KEY = 'sikotis.db.v2'
const AUTH_KEY = 'sikotis.auth.v1'
const WORKSPACE_KEY = 'sikotis.workspace.v1'

/** Koleksi inti yang sudah ada sejak versi pertama. */
const CORE_KEYS: Array<keyof Database> = ['drivers', 'routes', 'vehicles', 'jobOrders', 'transactions', 'billings']
/** Koleksi yang ditambahkan belakangan - boleh belum ada di data tersimpan. */
const ADDED_KEYS: Array<keyof Database> = ['projects', 'ujPayments', 'expenses', 'internalCosts', 'commissionSchemes']

function hasCore(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return CORE_KEYS.every((k) => Array.isArray(v[k]))
}

/**
 * Migrasi non-destruktif: data lama dipertahankan, koleksi baru diisi dari
 * dummy segar. Jadi menambah modul tidak menghapus perubahan yang sudah
 * dibuat user pada master maupun transaksi.
 */
function migrate(stored: Record<string, unknown>): Database {
  const merged = { ...stored }

  // 1) Koleksi yang belum ada diisi dari dummy segar.
  const missing = ADDED_KEYS.filter((k) => !Array.isArray(merged[k]))
  if (missing.length > 0) {
    const fresh = generateDatabase() as unknown as Record<string, unknown>
    for (const k of missing) merged[k] = fresh[k]
  }

  // 2) Field baru pada record lama diberi nilai awal, supaya data yang sudah
  //    tersimpan tetap terbaca dan tidak ada kolom kosong di tabel.
  const trx = merged.transactions as Array<Record<string, unknown>> | undefined
  if (Array.isArray(trx)) {
    merged.transactions = trx.map((t) => {
      const sopir = String(t.driver_id ?? '')
      const kont = String(t.container_no ?? '').trim()
      return {
        project_id: '',
        tr_reference: '',
        pi_number: '',
        pi_status: '',
        cost_value: 0,
        notes: '',
        // Trip menyerap field Surat Jalan: ID Perjalanan (dulu Kont), banyak sopir,
        // manager, penerima, dan rincian pengiriman.
        trip_ids: kont ? [kont] : [],
        driver_ids: sopir ? [sopir] : [],
        manager_id: '',
        manager_name: '',
        sj_no: '',
        recipient_name: '',
        recipient_address_1: '',
        recipient_address_2: '',
        party: '',
        goods_type: '',
        kosongan: '',
        location: '',
        ship: '',
        printed_at: null,
        service_type: 'callout',
        contract_id: '',
        cancelled_at: null,
        cancel_reason: '',
        cancel_settlement: [],
        ...t,
        container_no: '',
        // Field lama is_done dipetakan ke status baru, bukan dibuang.
        status: t.status ?? (t.is_done ? 'selesai' : 'aktif'),
      }
    })
  }

  // Karyawan: peran baru, semua data lama adalah sopir.
  const drv = merged.drivers as Array<Record<string, unknown>> | undefined
  if (Array.isArray(drv)) merged.drivers = drv.map((d) => ({ role: 'sopir', attachments: [], ...d }))

  const veh = merged.vehicles as Array<Record<string, unknown>> | undefined
  if (Array.isArray(veh)) {
    merged.vehicles = veh.map((v) => ({ configuration: '', attachments: [], ...v }))
  }

  // Kolom ukuran container semula bernama "fart" (salah baca dari "feet").
  // Uang Tol dan Project baru ditambahkan, jadi route lama diberi nilai awal.
  // Project route lama diambil dari project yang paling sering dipakai trip
  // pada route itu; route yang belum pernah dipakai dibiarkan kosong.
  const rte = merged.routes as Array<Record<string, unknown>> | undefined
  if (Array.isArray(rte)) {
    const projectRoute = rte.some((r) => !('project_id' in r))
      ? projectDominanPerRoute((merged.transactions ?? []) as CommissionTransaction[])
      : new Map<string, string>()
    merged.routes = rte.map(({ fart, ...r }) => ({
      feet: fart ?? '', toll: 0, project_id: projectRoute.get(String(r.id)) ?? '', ...r,
    }))
  }

  /* Workspace (Jakarta / Tangerang).
   *
   * Data lama belum mengenal workspace. Pembagiannya mengikuti armada:
   * satu kendaraan dianggap berpangkalan di satu cabang, sehingga trip dan
   * Surat Jalan yang memakai kendaraan itu jatuh ke cabang yang sama.
   * Tagihan mengikuti SI/JO-nya. Pembagian ini SEMENTARA - begitu klien
   * memberi daftar armada per cabang, cukup ganti workspaceForSeed(). */
  const tagihanTanpaWs = new Set(
    ((merged.billings ?? []) as Array<Record<string, unknown>>).filter((b) => !b.workspace).map((b) => String(b.id)),
  )
  const beriWorkspace = (
    key: 'transactions' | 'deliveryNotes' | 'billings',
    seedField: string,
  ) => {
    const list = merged[key] as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(list)) return
    merged[key] = list.map((row) => {
      if (row.workspace) return row
      // Baris tanpa kendaraan jatuh ke id-nya sendiri, supaya tidak menumpuk
      // di satu cabang hanya karena seed-nya sama-sama kosong.
      const seed = String(row[seedField] ?? '') || String(row.id ?? '')
      return { ...row, workspace: workspaceForSeed(seed) }
    })
  }
  beriWorkspace('transactions', 'vehicle_id')
  beriWorkspace('deliveryNotes', 'vehicle_id')
  beriWorkspace('billings', 'job_order_id')

  // Pengaturan Komisi kini bertingkat (target awal - akhir) untuk satu peran.
  // Bentuk lama "komisi dasar sampai target, komisi target setelahnya" diubah
  // tepat menjadi dua tingkat, jadi tidak ada nilai yang hilang.
  const skema = merged.commissionSchemes as Array<Record<string, unknown>> | undefined
  const perluAturanMeeting = perluAturanMeetingAwal(skema)
  // Aturan lama adalah contoh sebelum catatan meeting: disimpan tapi dinonaktifkan
  // supaya tidak menghasilkan komisi untuk kendaraan di luar aturan meeting.
  const aturanDefault = { service_type: 'callout', configurations: [], basis: 'nilai', base_deduction_pct: 0, is_active: !perluAturanMeeting }
  if (Array.isArray(skema)) {
    merged.commissionSchemes = skema.map((c) => {
      if (Array.isArray(c.tiers)) return { role: 'sopir', notes: '', ...aturanDefault, ...c }
      const {
        target, base_commission, base_commission_unit, target_commission, target_commission_unit,
        commission, commission_unit, realization, period, ...tetap
      } = c
      void realization
      void period
      const batas = Number(target ?? 0)
      return {
        ...aturanDefault,
        ...tetap,
        role: 'sopir',
        notes: tetap.notes ?? '',
        tiers: [
          { target_awal: 0, target_akhir: batas, commission: Number(base_commission ?? commission ?? 0), commission_unit: base_commission_unit ?? commission_unit ?? 'rp' },
          { target_awal: batas, target_akhir: 0, commission: Number(target_commission ?? commission ?? 0), commission_unit: target_commission_unit ?? commission_unit ?? 'rp' },
        ],
      }
    })
  }

  // Tagihan yang baru diberi workspace sebisa mungkin mengikuti trip pada SI/JO
  // yang sama. Hanya sekali saat migrasi: tagihan yang sudah punya workspace
  // tidak dipindah-pindah mengikuti trip yang dibuat belakangan.
  const trxWs = merged.transactions as Array<Record<string, unknown>> | undefined
  const bil = merged.billings as Array<Record<string, unknown>> | undefined
  if (Array.isArray(trxWs) && Array.isArray(bil) && tagihanTanpaWs.size > 0) {
    const wsPerJo = new Map<string, unknown>()
    for (const t of trxWs) {
      const jo = String(t.job_order_id ?? '')
      if (jo && !wsPerJo.has(jo)) wsPerJo.set(jo, t.workspace)
    }
    merged.billings = bil.map((b) => {
      if (!tagihanTanpaWs.has(String(b.id))) return b
      const ws = wsPerJo.get(String(b.job_order_id ?? ''))
      return ws ? { ...b, workspace: ws } : b
    })
  }

  // Surat Jalan semula tidak menyimpan sopir dan route.
  //
  // Surat Jalan dibangkitkan dari trip contoh yang tidak ikut disimpan, jadi trip
  // asalnya tidak bisa ditelusuri kembali. Yang bisa dipakai adalah Tujuan: nilainya
  // selalu sama dengan Nama Route, sehingga route dapat dipetakan tepat. Sopir lalu
  // diambil dari trip yang memang pernah menempuh route tersebut, agar pasangan
  // sopir-route tetap masuk akal.
  const notes = merged.deliveryNotes as Array<Record<string, unknown>> | undefined
  const rte2 = merged.routes as Array<Record<string, unknown>> | undefined
  if (Array.isArray(notes) && Array.isArray(rte2)) {
    const src = Array.isArray(trx) ? (merged.transactions as Array<Record<string, unknown>>) : []
    const kunci = (v: unknown) => String(v ?? '').trim().toUpperCase()

    const routePerNama = new Map<string, string>()
    for (const r of rte2) {
      const nama = kunci(r.route_name)
      if (nama && !routePerNama.has(nama)) routePerNama.set(nama, String(r.id ?? ''))
    }

    const sopirPerRoute = new Map<string, string>()
    const sopirPerMobil = new Map<string, string>()
    for (const t of src) {
      const rid = String(t.route_id ?? '')
      const did = String(t.driver_id ?? '')
      const vid = String(t.vehicle_id ?? '')
      if (rid && did && !sopirPerRoute.has(rid)) sopirPerRoute.set(rid, did)
      if (vid && did && !sopirPerMobil.has(vid)) sopirPerMobil.set(vid, did)
    }

    merged.deliveryNotes = notes.map((n) => {
      // Nilai kosong ikut diisi ulang, bukan hanya field yang belum ada.
      if (n.driver_id && n.route_id) return n
      const routeId = String(n.route_id ?? '') || (routePerNama.get(kunci(n.destination)) ?? '')
      const driverId =
        String(n.driver_id ?? '') ||
        (routeId ? sopirPerRoute.get(routeId) : undefined) ||
        sopirPerMobil.get(String(n.vehicle_id ?? '')) ||
        ''
      return { ...n, driver_id: driverId, route_id: routeId }
    })
  }

  const stamp = new Date().toISOString()
  const trips = (merged.transactions as Array<Record<string, unknown>> | undefined) ?? []

  /* Surat Jalan digabung ke Trip.
   *
   * Tiap Surat Jalan menjadi satu trip dengan rincian dokumennya utuh. Tidak ada
   * yang dicocokkan ke trip lama: pengujian sebelumnya menunjukkan tidak satu pun
   * Surat Jalan punya pasangan trip (SI/JO + kendaraan), jadi menebak pasangan
   * justru berisiko menempelkan dokumen ke perjalanan yang salah. */
  const sj = merged.deliveryNotes as Array<Record<string, unknown>> | undefined
  if (Array.isArray(sj) && sj.length > 0) {
    const nomor = trips.map((t) => String(t.transaction_no ?? ''))
    const idAda = new Set(trips.map((t) => String(t.id)))
    for (const n of sj) {
      const tanggal = String(n.sj_date ?? '') || stamp.slice(0, 10)
      const no = nomorTripBerikut(nomor, tanggal)
      nomor.push(no)
      const sopir = String(n.driver_id ?? '')
      const id = idAda.has(String(n.id)) ? `trp-${n.id}` : String(n.id)
      trips.push({
        id,
        workspace: n.workspace,
        transaction_no: no,
        transaction_date: tanggal,
        trip_ids: Array.isArray(n.containers) ? (n.containers as unknown[]).map(String).filter(Boolean) : [],
        route_id: String(n.route_id ?? ''),
        sj_no: String(n.sj_no ?? ''),
        manager_id: '',
        manager_name: '',
        project_id: '',
        status: n.printed_at ? 'aktif' : 'draft',
        recipient_name: String(n.recipient_name ?? ''),
        recipient_address_1: String(n.recipient_address_1 ?? ''),
        recipient_address_2: String(n.recipient_address_2 ?? ''),
        vehicle_id: String(n.vehicle_id ?? ''),
        driver_id: sopir,
        driver_ids: sopir ? [sopir] : [],
        job_order_id: String(n.job_order_id ?? ''),
        party: String(n.party ?? ''),
        goods_type: String(n.goods_type ?? ''),
        kosongan: String(n.kosongan ?? ''),
        location: String(n.location ?? ''),
        ship: String(n.ship ?? ''),
        destination_detail: String(n.destination ?? ''),
        tr_reference: '',
        pi_number: '',
        pi_status: '',
        cost_value: 0,
        notes: '',
        is_marked: false,
        bon_date: null,
        personal_bon: 0,
        printed_at: n.printed_at ?? null,
        service_type: 'callout',
        contract_id: '',
        cancelled_at: null,
        cancel_reason: '',
        cancel_settlement: [],
        container_no: '',
        created_at: n.created_at ?? stamp,
        updated_at: n.updated_at ?? stamp,
      })
    }
    merged.transactions = trips
  }
  delete merged.deliveryNotes

  // Anak trip: lampiran, penerima termin, dan penerima komisi.
  const sopirTrip = new Map(trips.map((t) => [String(t.id), String(t.driver_id ?? '')]))
  const uj = merged.ujPayments as Array<Record<string, unknown>> | undefined
  if (Array.isArray(uj)) {
    merged.ujPayments = uj.map((p) => ({
      attachments: [],
      ...p,
      driver_id: p.driver_id ?? sopirTrip.get(String(p.trip_id)) ?? '',
    }))
  }
  const exp = merged.expenses as Array<Record<string, unknown>> | undefined
  if (Array.isArray(exp)) merged.expenses = exp.map((e) => ({ attachments: [], ...e }))
  const intr = merged.internalCosts as Array<Record<string, unknown>> | undefined
  if (Array.isArray(intr)) {
    merged.internalCosts = intr.map((c) => ({ attachments: [], recipient_role: '', recipient_id: '', recipient_name: '', ...c }))
  }
  if (!Array.isArray(merged.tripNotes)) merged.tripNotes = []
  if (!Array.isArray(merged.contracts)) merged.contracts = []

  // Kontrak kini milik Klien (Master -> Klien). Kontrak lama menyimpan nama client
  // sebagai teks: dicocokkan ke Klien bernama sama, atau dibuatkan Klien baru
  // supaya tidak ada kontrak tanpa pemilik.
  const kontrak = merged.contracts as Array<Record<string, unknown>>
  if (kontrak.some((c) => !('project_id' in c))) {
    const klien = [...((merged.projects ?? []) as Project[])]
    const contoh = makeKlienKontrak(stamp)
    merged.contracts = kontrak.map(({ client_name, ...c }) => {
      if ('project_id' in c) return c
      const nama = String(client_name ?? '').trim()
      const sama = (p: Project) => p.project_name.trim().toLowerCase() === nama.toLowerCase()
      let pemilik = klien.find(sama)
      if (!pemilik && nama) {
        pemilik = contoh.find(sama) ?? klienDariNama(nama, klien, stamp)
        klien.push(pemilik)
      }
      return { ...c, project_id: pemilik?.id ?? '' }
    })
    merged.projects = klien
  }
  // Jenis klien: yang punya kontrak (di workspace mana pun) = klien kontrak, lainnya klien tetap.
  const prj = merged.projects as Array<Record<string, unknown>> | undefined
  if (Array.isArray(prj) && prj.some((p) => !p.client_type)) {
    const berkontrak = new Set((merged.contracts as Array<Record<string, unknown>>).map((c) => String(c.project_id ?? '')))
    merged.projects = prj.map((p) => (p.client_type ? p : { ...p, client_type: berkontrak.has(String(p.id)) ? 'kontrak' : 'tetap' }))
  }
  // Trip Dedicated yang belum berklien mengikuti klien kontraknya.
  const klienKontrak = new Map((merged.contracts as Array<Record<string, unknown>>).map((c) => [String(c.id), String(c.project_id ?? '')]))
  merged.transactions = (merged.transactions as Array<Record<string, unknown>>).map((t) => {
    const pemilik = t.contract_id && !t.project_id ? klienKontrak.get(String(t.contract_id)) : ''
    return pemilik ? { ...t, project_id: pemilik } : t
  })

  // Aturan komisi dari catatan meeting, ditambahkan sekali per workspace.
  if (perluAturanMeeting) {
    merged.commissionSchemes = [
      ...aturanKomisiMeeting('jakarta', 'cms-meeting-jkt', stamp),
      ...aturanKomisiMeeting('tangerang', 'cms-meeting-tng', stamp),
      ...(merged.commissionSchemes as unknown[]),
    ]
  }

  // Komisi Callout dari harga trip kini berlaku untuk semua jenis kendaraan. Hanya aturan
  // meeting yang belum diubah pengguna (masih bernama & berbatas HB/LB/DL/TRONTON).
  if (Array.isArray(merged.commissionSchemes)) {
    const lama = ['HB', 'LB', 'DL', 'TRONTON']
    merged.commissionSchemes = (merged.commissionSchemes as Array<Record<string, unknown>>).map((c) => {
      const kendaraan = Array.isArray(c.configurations) ? (c.configurations as string[]) : []
      const belumDiubah = c.name === 'Komisi Sopir HB / LB / DL / TRONTON' &&
        kendaraan.length === lama.length && lama.every((k) => kendaraan.includes(k))
      return belumDiubah ? { ...c, name: NAMA_KOMISI_CALLOUT, configurations: [], notes: CATATAN_KOMISI_CALLOUT } : c
    })
  }

  // Biaya internal jenis "Uang Jalan" dihapus: UJ hanya dicatat di tab Uang Jalan.
  const intr2 = merged.internalCosts as Array<Record<string, unknown>> | undefined
  if (Array.isArray(intr2)) {
    merged.internalCosts = intr2.map((c) => (c.cost_type === 'Uang Jalan'
      ? { ...c, cost_type: 'Lainnya', notes: ['Uang jalan internal (jenis lama)', c.notes].filter(Boolean).join(' - ') }
      : c))
  }

  // Kasbon karyawan baru ada sekarang: disusun dari potong kasbon yang tercatat.
  if (!Array.isArray(merged.kasbonEntries)) {
    merged.kasbonEntries = susunKasbonDariDataLama(
      (merged.ujPayments ?? []) as UjPayment[],
      (merged.transactions ?? []) as CommissionTransaction[],
      stamp,
    )
  }

  // Angka yang dulu kosong, diisi sekali (penandanya: route belum punya estimated_fields).
  // Nominal route diturunkan dari trip asli; trip contoh yang sudah jalan diberi
  // uang jalan, biaya, dan potong kasbon. Catatan yang sudah ada tidak diubah.
  const rute = merged.routes as Route[]
  if (rute.some((r) => !r.estimated_fields)) {
    const trips = merged.transactions as CommissionTransaction[]
    const bayar = (merged.ujPayments ?? []) as UjPayment[]
    const biaya = (merged.expenses ?? []) as OperationalExpense[]
    const internal = (merged.internalCosts ?? []) as InternalCost[]
    const routes = lengkapiNominalRoute(rute, trips, bayar, biaya)
    const contoh = keuanganTripContoh(trips, routes, { payments: bayar, expenses: biaya, internal }, todayISO(), stamp)
    merged.routes = routes
    merged.ujPayments = [...bayar, ...contoh.ujPayments]
    merged.expenses = [...biaya, ...contoh.expenses]
    merged.internalCosts = [...internal, ...contoh.internalCosts]
    const kasbon = merged.kasbonEntries as KasbonEntry[]
    merged.kasbonEntries = [...kasbon, ...kasbonTerminContoh(contoh.ujPayments, stamp)]
  }

  // Status Piutang tidak dipakai lagi: kasbon contoh "belum dipotong" yang dulu dibuat
  // untuknya dihapus, selama saldo kasbon sopir itu tidak jadi minus.
  const semuaKasbon = (merged.kasbonEntries ?? []) as KasbonEntry[]
  if (semuaKasbon.some((k) => k.id.startsWith('ksb-piutang-'))) {
    const saldo = petaSaldoKasbon(semuaKasbon)
    merged.kasbonEntries = semuaKasbon.filter(
      (k) => !(k.id.startsWith('ksb-piutang-') && (saldo.get(k.employee_id) ?? 0) - k.amount >= 0),
    )
  }

  return merged as unknown as Database
}

/** Klien baru untuk kontrak lama; kodenya singkatan nama (PT/CV diabaikan), dijamin unik. */
function klienDariNama(nama: string, ada: Project[], stamp: string): Project {
  const kode = kodeKlienBerikut(nama, ada.map((p) => p.project_code))
  return {
    id: uid('prj'), project_code: kode, project_name: nama, client_type: 'kontrak', description: 'Dibuat dari data kontrak.',
    requires_document: true, status: 'aktif', created_at: stamp, updated_at: stamp,
  }
}

/** Data tersimpan belum mengenal aturan komisi berdasar (sebelum catatan meeting). */
function perluAturanMeetingAwal(skema: unknown): boolean {
  return Array.isArray(skema) && !skema.some((c) => c && typeof c === 'object' && 'basis' in c)
}

/** Muat dari localStorage; jika kosong / rusak, bangun ulang dari dummy. */
export function loadDatabase(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (hasCore(parsed)) {
        const migrated = migrate(parsed as Record<string, unknown>)
        saveDatabase(migrated)
        return migrated
      }
    }
  } catch {
    // localStorage tidak tersedia / JSON rusak -> jatuh ke dummy
  }
  const fresh = generateDatabase()
  saveDatabase(fresh)
  return fresh
}

export function saveDatabase(db: Database): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // storage penuh atau mode privat: prototype tetap jalan dari memori
  }
}

/** Buang data tersimpan dan bangun ulang dummy database. */
export function resetDatabase(): Database {
  try {
    localStorage.removeItem(DB_KEY)
  } catch {
    /* abaikan */
  }
  const fresh = generateDatabase()
  saveDatabase(fresh)
  return fresh
}

/** Ganti isi database dengan dataset contoh sepenuhnya (tanpa data operasional asli). */
export function resetToSampleDatabase(): Database {
  const fresh = generateSampleDatabase()
  saveDatabase(fresh)
  return fresh
}

/** Workspace aktif (Jakarta / Tangerang) - disimpan terpisah dari data. */
export const workspaceStorage = {
  read(): string | null {
    try {
      return localStorage.getItem(WORKSPACE_KEY)
    } catch {
      return null
    }
  },
  write(value: string): void {
    try {
      localStorage.setItem(WORKSPACE_KEY, value)
    } catch {
      /* abaikan */
    }
  },
}

export const authStorage = {
  read<T>(): T | null {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  write(value: unknown): void {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(value))
    } catch {
      /* abaikan */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {
      /* abaikan */
    }
  },
}
