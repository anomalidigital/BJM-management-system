/**
 * Melengkapi angka yang belum ada di data impor, supaya layar tidak dipenuhi Rp 0.
 *
 * 1. Nominal route (UJROUTE, Harga, Uang Tol). Spreadsheet tidak memuat nominal
 *    route, jadi diturunkan dari trip asli yang menempuh route itu: median uang
 *    jalan per trip, median COST, dan median biaya Tol. Route yang tidak punya
 *    datanya diberi perkiraan, dan nominal itu dicatat di `estimated_fields`.
 * 2. Trip contoh (dibangkitkan dari Surat Jalan contoh) belum punya uang jalan
 *    maupun biaya. Trip yang sudah jalan diberi termin sebesar UJROUTE route-nya,
 *    biaya operasional & internal seukuran data asli, dan sebagian potong kasbon.
 *
 * Dipakai saat database dibuat dan sekali saat migrasi data tersimpan.
 */
import type {
  CommissionTransaction, InternalCost, KasbonEntry, OperationalExpense, Route, RouteNominal, UjPayment,
} from '../types'

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Dibulatkan seperti angka di spreadsheet (kelipatan step), minimal satu step. */
const bulat = (n: number, step: number): number => Math.max(step, Math.round(n / step) * step)

/** "BBS 19 - CIB (2)" -> ['BBS', 'CIB']: ujung asal & tujuan tanpa nomor. */
function ujungRoute(nama: string): string[] {
  return nama
    .toUpperCase()
    .replace(/\(.*?\)/g, '')
    .split('-')
    .map((s) => s.replace(/[0-9]+/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function jumlahPerTrip(baris: Array<[string, number]>): Map<string, number> {
  const m = new Map<string, number>()
  for (const [trip, nilai] of baris) m.set(trip, (m.get(trip) ?? 0) + nilai)
  return m
}

/**
 * Isi nominal route yang masih kosong semua (UJROUTE, Harga, dan Uang Tol = 0).
 * Route yang sudah punya `estimated_fields` tidak disentuh; route yang sudah
 * bernominal dianggap isian admin, jadi tidak ada yang berstatus perkiraan.
 */
export function lengkapiNominalRoute(
  routes: Route[],
  trips: Array<Pick<CommissionTransaction, 'id' | 'route_id' | 'cost_value' | 'status'>>,
  payments: Array<Pick<UjPayment, 'trip_id' | 'uj_amount'>>,
  expenses: Array<Pick<OperationalExpense, 'trip_id' | 'expense_type' | 'amount'>>,
): Route[] {
  const ujTrip = jumlahPerTrip(payments.map((p) => [p.trip_id, p.uj_amount]))
  const tolTrip = jumlahPerTrip(expenses.filter((e) => e.expense_type === 'Tol').map((e) => [e.trip_id, e.amount]))

  const data = new Map<string, { uj: number[]; harga: number[]; tol: number[] }>()
  for (const t of trips) {
    if (!t.route_id || t.status === 'batal') continue
    const d = data.get(t.route_id) ?? { uj: [], harga: [], tol: [] }
    const uj = ujTrip.get(t.id)
    if (uj) d.uj.push(uj)
    if (t.cost_value > 0) d.harga.push(t.cost_value)
    const tol = tolTrip.get(t.id)
    if (tol) d.tol.push(tol)
    data.set(t.route_id, d)
  }

  // Nominal dari data trip (median), per route.
  const dariData = new Map(routes.map((r) => {
    const d = data.get(r.id)
    return [r.id, {
      ujroute: d?.uj.length ? bulat(median(d.uj), 50_000) : 0,
      price: d?.harga.length ? bulat(median(d.harga), 50_000) : 0,
      toll: d?.tol.length ? bulat(median(d.tol), 5_000) : 0,
    }]
  }))

  // Perbandingan antar-nominal dari route yang datanya lengkap, untuk perkiraan.
  const semua = [...dariData.values()]
  const rasioHarga = median(semua.filter((n) => n.ujroute && n.price).map((n) => n.price / n.ujroute)) || 4.5
  const rasioTol = median(semua.filter((n) => n.ujroute && n.toll).map((n) => n.toll / n.ujroute)) || 0.25
  const ujUmum = median(semua.filter((n) => n.ujroute).map((n) => n.ujroute)) || 4_000_000
  const ujPerUjung = new Map<string, number[]>()
  for (const r of routes) {
    const uj = dariData.get(r.id)?.ujroute
    if (!uj) continue
    for (const u of ujungRoute(r.route_name)) ujPerUjung.set(u, [...(ujPerUjung.get(u) ?? []), uj])
  }

  return routes.map((r) => {
    if (r.estimated_fields) return r
    if (r.ujroute || r.price || r.toll) return { ...r, estimated_fields: [] }
    const d = dariData.get(r.id)!
    const kira: RouteNominal[] = []

    let ujroute = d.ujroute
    if (!ujroute) {
      kira.push('ujroute')
      // Dari COST bila ada; kalau tidak, dari route lain yang berujung sama.
      const mirip = ujungRoute(r.route_name).flatMap((u) => ujPerUjung.get(u) ?? [])
      ujroute = d.price ? bulat(d.price / rasioHarga, 50_000) : bulat(mirip.length ? median(mirip) : ujUmum, 50_000)
    }
    let price = d.price
    if (!price) {
      kira.push('price')
      price = bulat(ujroute * rasioHarga, 100_000)
    }
    let toll = d.toll
    if (!toll) {
      kira.push('toll')
      toll = bulat(ujroute * rasioTol, 10_000)
    }
    return { ...r, ujroute, price, toll, estimated_fields: kira }
  })
}

/** Trip contoh: hasil Surat Jalan contoh (id "sj-..."), bukan trip dari data operasional. */
export const tripContoh = (id: string): boolean => /^(trp-)?sj-/.test(id)

/** Angka acak yang selalu sama untuk teks yang sama, supaya hasil pengisian stabil. */
function acakDari(teks: string): () => number {
  let h = 2166136261
  for (let i = 0; i < teks.length; i++) h = Math.imul(h ^ teks.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function geserHari(iso: string, hari: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + hari)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Biaya operasional contoh, seukuran data asli: [jenis, peluang, minimum, maksimum]. */
const BIAYA_CONTOH: ReadonlyArray<readonly [string, number, number, number]> = [
  ['DEX', 0.7, 1_500_000, 3_500_000],
  ['SPSI', 0.45, 140_000, 175_000],
  ['Nginap', 0.25, 300_000, 600_000],
  ['Reimbus', 0.15, 100_000, 400_000],
]

/** Biaya internal contoh: [jenis, peluang, minimum, maksimum]. */
const INTERNAL_CONTOH: ReadonlyArray<readonly [string, number, number, number]> = [
  ['Uang Makan', 0.45, 100_000, 350_000],
  ['Kernet', 0.25, 150_000, 450_000],
  ['Administrasi', 0.2, 50_000, 250_000],
]

/**
 * Uang jalan, biaya, dan potong kasbon untuk trip contoh yang sudah jalan
 * (Aktif / Selesai) dan belum punya catatan keuangan sama sekali.
 */
export function keuanganTripContoh(
  trips: CommissionTransaction[],
  routes: Route[],
  sudahAda: { payments: Array<Pick<UjPayment, 'trip_id'>>; expenses: Array<Pick<OperationalExpense, 'trip_id'>>; internal: Array<Pick<InternalCost, 'trip_id'>> },
  hariIni: string,
  stamp: string,
): { ujPayments: UjPayment[]; expenses: OperationalExpense[]; internalCosts: InternalCost[] } {
  const routeMap = new Map(routes.map((r) => [r.id, r]))
  const tercatat = new Set([...sudahAda.payments, ...sudahAda.expenses, ...sudahAda.internal].map((x) => x.trip_id))
  const ujPayments: UjPayment[] = []
  const expenses: OperationalExpense[] = []
  const internalCosts: InternalCost[] = []

  for (const t of trips) {
    if (!tripContoh(t.id) || (t.status !== 'aktif' && t.status !== 'selesai') || tercatat.has(t.id)) continue
    const acak = acakDari(t.id)
    const antara = (min: number, max: number, step: number) => bulat(min + acak() * (max - min), step)
    const route = routeMap.get(t.route_id)
    const patokan = route?.ujroute || 3_000_000
    const sopir = t.driver_ids?.[0] || t.driver_id
    const tanggalTermin = (ke: number) =>
      ke === 0 ? t.transaction_date : [geserHari(t.transaction_date, 1 + Math.floor(acak() * 3)), hariIni].sort()[0]

    // Uang jalan: sebagian besar sekali bayar sebesar UJROUTE, sisanya dua termin.
    const termin = acak() < 0.65 ? [patokan] : (() => {
      const pertama = bulat(patokan * (0.5 + acak() * 0.2), 50_000)
      return [pertama, Math.max(50_000, patokan - pertama)]
    })()
    termin.forEach((uj, i) => {
      ujPayments.push({
        id: `ujp-${t.id}-${i + 1}`,
        trip_id: t.id,
        sequence: i + 1,
        payment_date: tanggalTermin(i),
        driver_id: sopir,
        uj_amount: uj,
        kasbon_deduction: sopir && acak() < 0.3 ? Math.min(uj, antara(100_000, 400_000, 50_000)) : 0,
        notes: '',
        attachments: [],
        created_at: stamp,
        updated_at: stamp,
      })
    })

    // Biaya operasional: tol mengikuti patokan route, lainnya seukuran data asli.
    const biaya: Array<[string, number]> = []
    if (route?.toll && acak() < 0.55) biaya.push(['Tol', bulat(route.toll * (0.9 + acak() * 0.2), 5_000)])
    for (const [jenis, peluang, min, max] of BIAYA_CONTOH) if (acak() < peluang) biaya.push([jenis, antara(min, max, 5_000)])
    biaya.forEach(([jenis, amount], i) => {
      expenses.push({
        id: `exp-${t.id}-${i + 1}`,
        trip_id: t.id,
        expense_type: jenis,
        amount,
        expense_date: t.transaction_date,
        notes: '',
        attachments: [],
        created_at: stamp,
        updated_at: stamp,
      })
    })

    INTERNAL_CONTOH.filter(([, peluang]) => acak() < peluang).forEach(([jenis, , min, max], i) => {
      internalCosts.push({
        id: `int-${t.id}-${i + 1}`,
        trip_id: t.id,
        cost_type: jenis,
        amount: antara(min, max, 25_000),
        cost_date: t.transaction_date,
        notes: '',
        recipient_role: '',
        recipient_id: '',
        recipient_name: '',
        attachments: [],
        created_at: stamp,
        updated_at: stamp,
      })
    })
  }
  return { ujPayments, expenses, internalCosts }
}

/**
 * Mutasi kasbon untuk potongan pada termin contoh: kasbon yang diberikan
 * beberapa hari sebelumnya, lalu dipotong dari termin itu. Saldo sopir tidak berubah.
 */
export function kasbonTerminContoh(payments: UjPayment[], stamp: string): KasbonEntry[] {
  return payments
    .filter((p) => p.kasbon_deduction > 0 && p.driver_id)
    .flatMap((p): KasbonEntry[] => [
      {
        id: `ksb-contoh-${p.id}`,
        employee_id: p.driver_id,
        entry_date: geserHari(p.payment_date, -3),
        kind: 'admin',
        amount: p.kasbon_deduction,
        trip_id: '',
        uj_payment_id: '',
        notes: 'Kasbon contoh, dipotong dari uang jalan trip contoh',
        attachments: [],
        created_at: stamp,
        updated_at: stamp,
      },
      {
        id: `ksb-${p.id}`,
        employee_id: p.driver_id,
        entry_date: p.payment_date,
        kind: 'trip',
        amount: -p.kasbon_deduction,
        trip_id: p.trip_id,
        uj_payment_id: p.id,
        notes: '',
        attachments: [],
        created_at: stamp,
        updated_at: stamp,
      },
    ])
}
