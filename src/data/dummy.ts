/**
 * Generator dummy data SIKOTIS.
 *
 * Deterministik (seeded PRNG) supaya data tidak berubah tiap render, tetapi
 * TANGGALNYA relatif terhadap hari ini -- jadi menu "Lap. Bulan Ini" selalu
 * berisi data, kapan pun prototype ini dibuka.
 */
import type {
  Billing, CommissionTransaction, Database, DeliveryNote, Driver, JobOrder,
  OperationalExpense, Project, Route, TripStatus, UjPayment, Vehicle,
} from '../types'
import { EXPENSE_TYPES, VEHICLE_CONFIGS } from '../types'
import REAL from './real.json'
import { toISO } from '../lib/format'

/* PRNG deterministik (mulberry32) */
function mulberry32(seed: number) {
  return function rand() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260812)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
const int = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min
/** Bulatkan ke kelipatan step supaya nominal terlihat wajar. */
const money = (min: number, max: number, step = 5000): number => Math.round(int(min, max) / step) * step

const now = new Date()
const stamp = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

/* Referensi teks Indonesia */
const FIRST = ['Budi', 'Andi', 'Slamet', 'Joko', 'Agus', 'Bambang', 'Dedi', 'Eko', 'Fajar', 'Gunawan', 'Hendra', 'Imam', 'Rudi', 'Sugeng', 'Teguh', 'Wahyu', 'Yanto', 'Rizki', 'Sapto', 'Marno', 'Darmawan', 'Hadi', 'Nurdin', 'Suryadi', 'Iwan', 'Parjo', 'Trisno', 'Basuki']
const LAST = ['Santoso', 'Pratama', 'Wijaya', 'Susanto', 'Hidayat', 'Nugroho', 'Saputra', 'Kurniawan', 'Setiawan', 'Firmansyah', 'Ramadhan', 'Purnomo', 'Wibowo', 'Halim', 'Maulana', 'Suryana', 'Prasetyo', 'Gunadi', 'Sanjaya', 'Herlambang']
const STREET = ['Jl. Melati', 'Jl. Mawar', 'Jl. Kenanga', 'Jl. Anggrek', 'Jl. Cempaka', 'Jl. Flamboyan', 'Jl. Bougenville', 'Jl. Nusa Indah', 'Jl. Rajawali', 'Jl. Garuda', 'Jl. Merpati', 'Jl. Kalimalang', 'Jl. Raya Bekasi', 'Jl. Sukarno Hatta', 'Jl. Pahlawan', 'Jl. Kamboja']
const AREA_CITY: ReadonlyArray<readonly [string, string]> = [
  ['Jakarta Timur', 'Jakarta'], ['Jakarta Utara', 'Jakarta'], ['Cakung', 'Jakarta'], ['Cilincing', 'Jakarta'],
  ['Bekasi Barat', 'Bekasi'], ['Bekasi Utara', 'Bekasi'], ['Tambun Selatan', 'Bekasi'], ['Cikarang Barat', 'Bekasi'],
  ['Periuk', 'Tangerang'], ['Jatiuwung', 'Tangerang'], ['Karawaci', 'Tangerang'],
  ['Cibitung', 'Cikarang'], ['Telukjambe', 'Karawang'], ['Klari', 'Karawang'],
  ['Serang Timur', 'Serang'], ['Cilegon Barat', 'Cilegon'],
]

const PLACES: ReadonlyArray<readonly [string, string]> = [
  ['PRK', 'PRIOK'], ['SRG', 'SERANG'], ['PD2', 'PINDO2'], ['CKR', 'CIKARANG'], ['KRW', 'KARAWANG'],
  ['TGR', 'TANGERANG'], ['CLG', 'CILEGON'], ['MRK', 'MERAK'], ['BKS', 'BEKASI'], ['CBT', 'CIBITUNG'],
  ['BGR', 'BOGOR'], ['SBP', 'SUNTER'],
]
/** Ukuran container: jumlah x kaki. 1X40 = satu container 40 kaki. */
const FEET_OPTIONS = ['1X20', '1X40', '2X20', '1X20K', '1X40K'] as const

const CUSTOMERS: ReadonlyArray<readonly [string, string, string]> = [
  ['INDAH', 'PT INDAH KIAT PULP & PAPER', 'Jl. Raya Serpong KM 8, Tangerang'],
  ['SINAR', 'PT SINAR JAYA LOGISTIK', 'Jl. Yos Sudarso No. 12, Jakarta Utara'],
  ['MEGAH', 'PT MEGAH SURYA PERTIWI', 'Kawasan Industri MM2100, Cikarang'],
  ['ARTHA', 'PT ARTHA MAKMUR SENTOSA', 'Jl. Raya Bekasi KM 22, Bekasi'],
  ['BINTG', 'PT BINTANG SAMUDERA LINE', 'Jl. Enggano No. 5, Tanjung Priok'],
  ['CAHYA', 'PT CAHAYA ABADI TRANSPORT', 'Jl. Cakung Cilincing, Jakarta Timur'],
  ['DELTA', 'PT DELTA NUSANTARA KARGO', 'Jl. Raya Cilegon KM 4, Serang'],
  ['GRAHA', 'PT GRAHA MULTI SARANA', 'Jl. Industri Selatan, Karawang'],
  ['HARUM', 'PT HARUM SEJAHTERA MANDIRI', 'Jl. Gatot Subroto KM 5, Tangerang'],
  ['JAYAP', 'PT JAYA PERKASA CONTAINER', 'Jl. Raya Merak No. 88, Cilegon'],
  ['KURNI', 'PT KURNIA TIRTA SEJAHTERA', 'Jl. Pulo Gadung No. 30, Jakarta Timur'],
  ['LESTR', 'PT LESTARI ANUGRAH PRIMA', 'Kawasan Industri Jababeka, Cikarang'],
]
const SHIPS = ['MV. ORIENTAL DIAMOND', 'MV. SINAR BANDUNG', 'KM. TANTO EXPRESS', 'MV. MERATUS JAYAPURA', 'KM. LUZON STRAIT', 'MV. ARMADA PERMATA', 'KM. SPIL NIKEN', 'MV. CARAKA JAYA NIAGA']
const GOODS = ['PAPER ROLL', 'PLASTIC RESIN', 'TEXTILE GOODS', 'GENERAL CARGO', 'STEEL COIL', 'CERAMIC TILES', 'FOOD GRADE PACK', 'AUTO PARTS', 'CHEMICAL DRUM', 'PACKAGING BOX']
const VEHICLE_TYPES = ['Tronton 6x2', 'Trailer 20 FT', 'Trailer 40 FT', 'Head Truck', 'Wingbox']
const CONT_PREFIX = ['TGHU', 'MSKU', 'TCLU', 'CAIU', 'GESU', 'SEGU', 'FCIU', 'TRHU']

/**
 * Project dummy. Struktur meniru data real (beberapa project berdokumen +
 * satu jenis order tunai tanpa TR/No PI), tetapi kodenya fiktif - data
 * operasional asli tidak boleh masuk repository publik.
 */
const PROJECT_SEED: ReadonlyArray<readonly [string, string, string, boolean]> = [
  ['ARM', 'Armada Migas Riau', 'Distribusi peralatan pengeboran wilayah Riau', true],
  ['NSP', 'Nusantara Selat Pulp', 'Pengangkutan pulp dan kertas lintas Sumatera-Jawa', true],
  ['TBS', 'Tirta Bumi Sejahtera', 'Proyek kawasan industri Cikarang-Karawang', true],
  ['CASH', 'Order Tunai', 'Order lepas tanpa alur dokumen TR / No PI', false],
]
/** Status yang pada spreadsheet tercampur ke kolom No PI. */
const PI_STATUS = ['', '', '', '', 'di pool', 'masih moving', 'sudah di pool', 'paket']

/* Master: Project */
function makeProjects(): Project[] {
  return PROJECT_SEED.map(([code, name, desc, doc], i) => ({
    id: `prj-${i + 1}`,
    project_code: code,
    project_name: name,
    description: desc,
    requires_document: doc,
    status: 'aktif' as const,
    created_at: stamp,
    updated_at: stamp,
  }))
}

/* Master: Sopir */
function makeDrivers(count: number): Driver[] {
  const used = new Set<string>()
  const out: Driver[] = []
  for (let i = 0; i < count; i++) {
    let name = `${pick(FIRST)} ${pick(LAST)}`
    let guard = 0
    while (used.has(name) && guard++ < 40) name = `${pick(FIRST)} ${pick(LAST)}`
    used.add(name)
    const [area, city] = pick(AREA_CITY)
    out.push({
      id: `drv-${i + 1}`,
      driver_code: `SPR${String(i + 1).padStart(3, '0')}`,
      driver_name: name,
      address_1: `${pick(STREET)} No. ${int(1, 148)}`,
      address_2: area,
      city,
      phone: `08${int(11, 89)}${int(1000000, 9999999)}`,
      status: i % 13 === 12 ? 'nonaktif' : 'aktif',
      created_at: stamp,
      updated_at: stamp,
    })
  }
  return out
}

/* Master: Route */
function makeRoutes(count: number): Route[] {
  const out: Route[] = []
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    const from = pick(PLACES)
    let to = pick(PLACES)
    let guard = 0
    while (to[0] === from[0] && guard++ < 20) to = pick(PLACES)
    const feet = pick(FEET_OPTIONS)
    const sizeCode = feet.startsWith('2') ? '2' + feet.slice(2, 4) : feet.slice(2, 4)
    const suffix = feet.endsWith('K') ? 'K' : ''
    let code = `${from[0]}${to[0]}${sizeCode}${suffix}`.toUpperCase().slice(0, 8)
    let n = 1
    while (used.has(code)) code = `${from[0]}${to[0]}${sizeCode}${n++}`.slice(0, 8)
    used.add(code)
    const nameSize = feet.startsWith('2') ? '2X20' : feet.includes('40') ? "40'" : "20'"
    out.push({
      id: `rte-${i + 1}`,
      route_code: code,
      route_name: `${from[1]}-${to[1]} ${nameSize}${suffix ? '(K)' : ''}`,
      feet,
      ujroute: money(620_000, 1_150_000),
      commissioner: money(100_000, 250_000),
      price: money(1_650_000, 3_600_000, 50_000),
      created_at: stamp,
      updated_at: stamp,
    })
  }
  return out
}

/* Master: Mobil */
function makeVehicles(count: number): Vehicle[] {
  const letters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ'
  const used = new Set<string>()
  const out: Vehicle[] = []
  for (let i = 0; i < count; i++) {
    let plate = ''
    let guard = 0
    do {
      const sfx = Array.from({ length: 3 }, () => letters[int(0, letters.length - 1)]).join('')
      plate = `B ${int(9000, 9999)} ${sfx}`
    } while (used.has(plate) && guard++ < 40)
    used.add(plate)
    out.push({
      id: `veh-${i + 1}`,
      plate_number: plate,
      vehicle_type: pick(VEHICLE_TYPES),
      // Konfigurasi disimpan di kendaraan, bukan ditempel ke nama sopir.
      configuration: rand() > 0.45 ? pick(VEHICLE_CONFIGS) : '',
      status: i % 11 === 10 ? 'servis' : 'aktif',
      created_at: stamp,
      updated_at: stamp,
    })
  }
  return out
}

/* SI / Job Order */
function makeJobOrders(count: number): JobOrder[] {
  const out: JobOrder[] = []
  let sijo = 3250880
  for (let i = 0; i < count; i++) {
    sijo += int(11, 96)
    const [code, name, address] = pick(CUSTOMERS)
    out.push({
      id: `jo-${i + 1}`,
      sijo: String(sijo),
      customer_code: code,
      customer_name: name,
      customer_address: address,
      party: `${int(3, 24)} X ${pick(['20FT', '40FT'])}`,
      ship: pick(SHIPS),
      goods: pick(GOODS),
      is_complete: rand() > 0.28,
      created_at: stamp,
      updated_at: stamp,
    })
  }
  return out
}

/* Transaksi Komisi */
function makeTransactions(
  db: Pick<Database, 'drivers' | 'routes' | 'vehicles' | 'jobOrders' | 'projects'>,
  count: number,
): CommissionTransaction[] {
  const activeDrivers = db.drivers.filter((d) => d.status === 'aktif')
  const activeVehicles = db.vehicles.filter((v) => v.status === 'aktif')

  // Sebar tanggal: ~40% bulan lalu (pembanding), ~60% bulan berjalan s/d hari ini.
  const dates: string[] = []
  const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  const thisMonthDays = now.getDate()
  for (let i = 0; i < count; i++) {
    const inPrev = i < Math.floor(count * 0.4)
    const day = inPrev ? int(1, prevMonthDays) : int(1, thisMonthDays)
    dates.push(toISO(new Date(now.getFullYear(), now.getMonth() - (inPrev ? 1 : 0), day)))
  }
  dates.sort()

  const seqPerMonth: Record<string, number> = {}
  return dates.map((date, i) => {
    const ym = date.slice(0, 4) + date.slice(5, 7)
    seqPerMonth[ym] = (seqPerMonth[ym] ?? 0) + 1
    const route = pick(db.routes)
    const jo = pick(db.jobOrders)
    const driver = pick(activeDrivers)
    const vehicle = pick(activeVehicles)
    const hasBon = rand() > 0.45
    const project = pick(db.projects)
    const withDoc = project.requires_document
    const roll = rand()
    const status: TripStatus = roll > 0.97 ? 'batal' : roll > 0.28 ? 'selesai' : roll > 0.06 ? 'aktif' : 'draft'
    return {
      id: `trx-${i + 1}`,
      transaction_no: `${ym}${String(seqPerMonth[ym]).padStart(4, '0')}`,
      transaction_date: date,
      driver_id: driver.id,
      vehicle_id: vehicle.id,
      job_order_id: jo.id,
      route_id: route.id,
      destination_detail: route.route_name,
      // sengaja ada beberapa yang kosong -> muncul di panel "Perlu perhatian"
      container_no: rand() > 0.08 ? `${pick(CONT_PREFIX)} ${int(1000000, 9999999)}` : '',
      // Project tanpa alur dokumen tidak punya TR maupun No PI - pola ini nyata.
      project_id: project.id,
      tr_reference: withDoc && rand() > 0.05 ? String(2600280000 + int(1, 39999)) : '',
      pi_number: withDoc && rand() > 0.32 ? String(int(400, 999)).padStart(4, '0') : '',
      pi_status: withDoc ? pick(PI_STATUS) : '',
      cost_value: rand() > 0.45 ? money(2_000_000, 48_000_000, 50_000) : 0,
      status,
      notes: '',
      is_marked: false,
      bon_date: hasBon ? date : null,
      personal_bon: hasBon ? money(150_000, 900_000, 25_000) : 0,
      created_at: stamp,
      updated_at: stamp,
    }
  })
}

/* Tagihan */
function makeBillings(db: Pick<Database, 'jobOrders' | 'transactions'>, count: number): Billing[] {
  // Tagihan dibuat dari SI/JO yang benar-benar punya transaksi, agar relasinya nyata.
  const joIdsWithTrx = Array.from(new Set(db.transactions.map((t) => t.job_order_id)))
  const out: Billing[] = []
  let invoiceSeq = 1
  const dayMs = 86_400_000
  for (let i = 0; i < count && i < joIdsWithTrx.length; i++) {
    const joId = joIdsWithTrx[i]
    const jo = db.jobOrders.find((j) => j.id === joId)!
    const trxForJo = db.transactions.filter((t) => t.job_order_id === joId)
    const billingDate = trxForJo.map((t) => t.transaction_date).sort().at(-1)!
    const base = new Date(billingDate + 'T00:00:00').getTime()
    const rejected = rand() > 0.9
    const paid = !rejected && rand() > 0.45
    out.push({
      id: `bil-${i + 1}`,
      invoice_no: `INV-${String(invoiceSeq++).padStart(3, '0')}`,
      job_order_id: joId,
      cost_code: jo.customer_code, // Data Cost default mengikuti Kode Cust SI/JO (lihat TBD-04)
      billing_date: billingDate,
      withdrawal_date: toISO(new Date(base - dayMs)),
      amount: money(4_200_000, 24_500_000, 50),
      guarantee_amount: rand() > 0.7 ? money(500_000, 2_500_000, 50_000) : 0,
      is_sunting: rand() > 0.82,
      is_rejected: rejected,
      paid_date: paid ? toISO(new Date(base + int(3, 21) * dayMs)) : null,
      is_marked: false,
      bl_no: `BL${int(100000, 999999)}`,
      invoice_ref: `FK-${int(1000, 9999)}`,
      notes: '',
      created_at: stamp,
      updated_at: stamp,
    })
  }
  return out
}

/* Surat Jalan */
const GOODS_TYPE = ['Container', 'Paper Roll', 'General Cargo', 'Curah Kering', 'Palet Kayu']
const KOSONGAN = ['DEPO MUSTIKA CAKUNG', 'DEPO PRIOK 3', 'DEPO CIBITUNG', '-', 'DEPO MERAK']
const LOKASI = ['JICT 1', 'NPCT1', 'KOJA', 'MAL PRIOK', 'TPK PALARAN']

function makeDeliveryNotes(
  db: Pick<Database, 'jobOrders' | 'vehicles' | 'transactions'>,
  count: number,
): DeliveryNote[] {
  const out: DeliveryNote[] = []
  // Ambil dari transaksi nyata supaya relasi SI/BL, mobil, dan tanggal konsisten.
  const source = [...db.transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)).slice(0, count)
  source.forEach((t, i) => {
    const jo = db.jobOrders.find((j) => j.id === t.job_order_id)!
    const veh = db.vehicles.find((v) => v.id === t.vehicle_id)!
    const qty = int(1, 4)
    const containers = Array.from({ length: qty }, () => `${pick(CONT_PREFIX)}${int(1000000, 9999999)}`)
    const printed = rand() > 0.4
    out.push({
      id: `sj-${i + 1}`,
      sj_no: `SJ-${String(count - i).padStart(6, '0')}`,
      sj_date: t.transaction_date,
      recipient_name: jo.customer_name,
      recipient_address_1: jo.customer_address.split(',')[0].trim(),
      recipient_address_2: jo.customer_address.split(',').slice(1).join(',').trim() || 'Jakarta',
      vehicle_id: veh.id,
      party: jo.party,
      job_order_id: jo.id,
      goods_type: pick(GOODS_TYPE),
      kosongan: pick(KOSONGAN),
      location: pick(LOKASI),
      ship: jo.ship,
      destination: t.destination_detail,
      containers,
      printed_at: printed ? t.transaction_date : null,
      created_at: stamp,
      updated_at: stamp,
    })
  })
  return out
}

/* Uang Jalan - multi termin (data real: 1 sampai 4 termin per trip) */
function makeUjPayments(trips: CommissionTransaction[]): UjPayment[] {
  const out: UjPayment[] = []
  let n = 0
  for (const t of trips) {
    if (t.status === 'batal' && rand() > 0.5) continue
    // Proporsi meniru sebaran nyata: sebagian trip belum ada UJ sama sekali.
    const r = rand()
    const termin = r > 0.88 ? 0 : r > 0.24 ? 1 : r > 0.09 ? 2 : r > 0.02 ? 3 : 4
    for (let i = 1; i <= termin; i++) {
      const uj = money(1_000_000, 6_500_000, 50_000)
      out.push({
        id: `ujp-${++n}`,
        trip_id: t.id,
        sequence: i,
        payment_date: i === 1 ? t.transaction_date : addDays(t.transaction_date, i * int(1, 4)),
        uj_amount: uj,
        kasbon_deduction: rand() > 0.68 ? money(100_000, 400_000, 50_000) : 0,
        notes: '',
        created_at: stamp,
        updated_at: stamp,
      })
    }
  }
  return out
}

function addDays(iso: string, d: number): string {
  const x = new Date(iso + 'T00:00:00')
  x.setDate(x.getDate() + d)
  return toISO(x)
}

/* Biaya operasional - baris terpisah, bukan tujuh kolom permanen */
function makeExpenses(trips: CommissionTransaction[]): OperationalExpense[] {
  const out: OperationalExpense[] = []
  let n = 0
  for (const t of trips) {
    const jumlah = rand() > 0.62 ? int(1, 3) : 0
    const dipakai = new Set<string>()
    for (let i = 0; i < jumlah; i++) {
      const jenis = pick(EXPENSE_TYPES)
      if (dipakai.has(jenis)) continue
      dipakai.add(jenis)
      const nominal =
        jenis === 'DEX' ? money(2_500_000, 6_500_000, 12_500)
        : jenis === 'Tol' ? money(150_000, 900_000, 5_000)
        : jenis === 'Nginap' ? money(150_000, 600_000, 25_000)
        : money(100_000, 500_000, 5_000)
      out.push({
        id: `exp-${++n}`,
        trip_id: t.id,
        expense_type: jenis,
        amount: nominal,
        expense_date: t.transaction_date,
        notes: '',
        created_at: stamp,
        updated_at: stamp,
      })
    }
  }
  return out
}

/**
 * Bangun database awal aplikasi.
 *
 * Sopir, mobil, project, route, trip, termin uang jalan, dan biaya operasional
 * berasal dari berkas data operasional yang diimpor.
 *
 * SI/Job Order, Data Tagihan, dan Surat Jalan belum tercakup berkas tersebut,
 * jadi ketiganya masih memakai dataset contoh.
 */
export function generateDatabase(): Database {
  const real = REAL as unknown as Pick<Database,
    'drivers' | 'vehicles' | 'projects' | 'routes' | 'transactions' | 'ujPayments' | 'expenses'>

  const jobOrders = makeJobOrders(42)
  // Dataset contoh untuk modul yang belum tercakup data operasional. Trip contoh ini
  // hanya dipakai untuk membangkitkan tagihan dan surat jalan, tidak ikut disimpan.
  const trxContoh = makeTransactions(
    { drivers: real.drivers, routes: real.routes, vehicles: real.vehicles, jobOrders, projects: real.projects },
    60,
  )
  const billings = makeBillings({ jobOrders, transactions: trxContoh }, 46)
  const deliveryNotes = makeDeliveryNotes({ jobOrders, vehicles: real.vehicles, transactions: trxContoh }, 34)

  return { ...real, jobOrders, billings, deliveryNotes }
}

/**
 * Database berisi data contoh sepenuhnya (fiktif), tanpa data operasional asli.
 * Berguna bila prototype perlu ditunjukkan ke pihak luar.
 */
export function generateSampleDatabase(): Database {
  const drivers = makeDrivers(26)
  const routes = makeRoutes(18)
  const vehicles = makeVehicles(16)
  const jobOrders = makeJobOrders(42)
  const projects = makeProjects()
  const transactions = makeTransactions({ drivers, routes, vehicles, jobOrders, projects }, 88)
  const billings = makeBillings({ jobOrders, transactions }, 46)
  const deliveryNotes = makeDeliveryNotes({ jobOrders, vehicles, transactions }, 34)
  const ujPayments = makeUjPayments(transactions)
  const expenses = makeExpenses(transactions)
  return { drivers, routes, vehicles, jobOrders, projects, transactions, billings, deliveryNotes, ujPayments, expenses }
}

/** Entitas yang datanya berasal dari berkas data operasional. */
export const SUMBER_REAL = ['drivers', 'vehicles', 'projects', 'routes', 'transactions', 'ujPayments', 'expenses'] as const
/** Entitas yang masih memakai dataset contoh. */
export const SUMBER_CONTOH = ['jobOrders', 'billings', 'deliveryNotes'] as const
