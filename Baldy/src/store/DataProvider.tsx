import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Billing, BillingRow, CommissionTransaction, Database, DeliveryNote, DeliveryNoteRow, EntityKey, TransactionRow, Workspace } from '../types'
import { loadDatabase, resetDatabase, resetToSampleDatabase, saveDatabase } from './persistence'
import { nowISO, uid } from '../lib/utils'
import { useWorkspace } from './WorkspaceProvider'

type Row<K extends EntityKey> = Database[K][number]
type NewRow<K extends EntityKey> = Omit<Row<K>, 'id' | 'created_at' | 'updated_at'>

/**
 * Koleksi yang isinya terpisah antar workspace. Master (sopir, mobil, route,
 * project, SI/JO) sengaja dipakai bersama supaya relasi antar data tidak putus
 * saat workspace berganti - lihat TBD-17.
 */
const SCOPED_KEYS = ['transactions', 'deliveryNotes', 'billings', 'commissionSchemes'] as const

/** Data lama tanpa penanda cabang diperlakukan sebagai Jakarta. */
const wsOf = (row: { workspace?: Workspace }): Workspace => row.workspace ?? 'jakarta'

interface DataContextValue {
  /** Database yang sudah disaring mengikuti workspace aktif. */
  db: Database
  /** Seluruh data lintas workspace - dipakai halaman Tools / ekspor. */
  dbAll: Database
  loading: boolean
  error: string | null
  /** Muat ulang data (mensimulasikan fetch ulang + state loading). */
  reload: () => void
  /** Paksa state error untuk mendemokan halaman gagal memuat. */
  simulateError: () => void
  muatUlangData: () => void
  /** Ganti seluruh isi dengan dataset contoh (tanpa data operasional asli). */
  resetToSample: () => void
  create: <K extends EntityKey>(key: K, row: NewRow<K>) => Row<K>
  update: <K extends EntityKey>(key: K, id: string, patch: Partial<Row<K>>) => void
  remove: <K extends EntityKey>(key: K, ids: string | string[]) => number
  /** Transaksi komisi yang sudah di-join dengan sopir / mobil / route / SI-JO. */
  transactionRows: TransactionRow[]
  /** Tagihan yang sudah di-join dengan SI/JO. */
  billingRows: BillingRow[]
  /** Surat Jalan yang sudah di-join dengan mobil & SI/JO. */
  deliveryNoteRows: DeliveryNoteRow[]
}

const DataContext = createContext<DataContextValue | null>(null)

const EMPTY_DB: Database = {
  drivers: [], routes: [], vehicles: [], jobOrders: [], transactions: [],
  billings: [], deliveryNotes: [], projects: [], ujPayments: [], expenses: [],
  internalCosts: [], commissionSchemes: [],
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace()
  const [db, setDb] = useState<Database>(EMPTY_DB)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hydrated = useRef(false)

  // Pemuatan awal sengaja diberi jeda kecil supaya skeleton loading terlihat.
  const runLoad = useCallback(() => {
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      try {
        setDb(loadDatabase())
        hydrated.current = true
      } catch {
        setError('Gagal memuat data.')
      } finally {
        setLoading(false)
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => runLoad(), [runLoad])

  // Simpan tiap perubahan, tapi jangan menimpa storage sebelum data ter-hidrasi.
  useEffect(() => {
    if (hydrated.current && !loading) saveDatabase(db)
  }, [db, loading])

  const create = useCallback(<K extends EntityKey>(key: K, row: NewRow<K>): Row<K> => {
    // Data baru otomatis milik workspace yang sedang aktif.
    const scoped = (SCOPED_KEYS as readonly string[]).includes(key) ? { workspace } : null
    const created = { ...scoped, ...row, id: uid(key.slice(0, 3)), created_at: nowISO(), updated_at: nowISO() } as Row<K>
    setDb((prev) => ({ ...prev, [key]: [created, ...(prev[key] as Row<K>[])] }))
    return created
  }, [workspace])

  const update = useCallback(<K extends EntityKey>(key: K, id: string, patch: Partial<Row<K>>) => {
    setDb((prev) => ({
      ...prev,
      [key]: (prev[key] as Row<K>[]).map((r) => (r.id === id ? { ...r, ...patch, updated_at: nowISO() } : r)),
    }))
  }, [])

  const remove = useCallback(<K extends EntityKey>(key: K, ids: string | string[]): number => {
    const list = Array.isArray(ids) ? ids : [ids]
    const target = new Set(list)
    setDb((prev) => ({ ...prev, [key]: (prev[key] as Row<K>[]).filter((r) => !target.has(r.id)) }))
    return list.length
  }, [])

  const muatUlangData = useCallback(() => {
    setLoading(true)
    window.setTimeout(() => {
      setDb(resetDatabase())
      setError(null)
      setLoading(false)
    }, 400)
  }, [])

  const resetToSample = useCallback(() => {
    setLoading(true)
    window.setTimeout(() => {
      setDb(resetToSampleDatabase())
      setError(null)
      setLoading(false)
    }, 400)
  }, [])

  const simulateError = useCallback(() => {
    setError('Gagal memuat data.')
    setLoading(false)
  }, [])

  /**
   * Penyaringan per workspace dikerjakan di satu tempat ini, sehingga seluruh
   * halaman ikut berganti isi tanpa perlu tahu soal workspace.
   */
  const scopedDb = useMemo<Database>(() => {
    const transactions = db.transactions.filter((t) => wsOf(t) === workspace)
    const tripIds = new Set(transactions.map((t) => t.id))
    return {
      ...db,
      transactions,
      // Anak dari trip ikut induknya, tidak perlu penanda workspace sendiri.
      ujPayments: db.ujPayments.filter((p) => tripIds.has(p.trip_id)),
      expenses: db.expenses.filter((e) => tripIds.has(e.trip_id)),
      internalCosts: db.internalCosts.filter((c) => tripIds.has(c.trip_id)),
      deliveryNotes: db.deliveryNotes.filter((n) => wsOf(n) === workspace),
      billings: db.billings.filter((b) => wsOf(b) === workspace),
      commissionSchemes: db.commissionSchemes.filter((s) => wsOf(s) === workspace),
    }
  }, [db, workspace])

  const transactionRows = useMemo<TransactionRow[]>(() => {
    const drivers = new Map(scopedDb.drivers.map((d) => [d.id, d]))
    const vehicles = new Map(scopedDb.vehicles.map((v) => [v.id, v]))
    const routes = new Map(scopedDb.routes.map((r) => [r.id, r]))
    const jobOrders = new Map(scopedDb.jobOrders.map((j) => [j.id, j]))
    const projects = new Map(scopedDb.projects.map((p) => [p.id, p]))
    // Agregasi termin UJ dan biaya per trip - dihitung sekali di sini.
    const uj = new Map<string, { uj: number; kasbon: number; n: number }>()
    for (const p of scopedDb.ujPayments) {
      const a = uj.get(p.trip_id) ?? { uj: 0, kasbon: 0, n: 0 }
      a.uj += p.uj_amount; a.kasbon += p.kasbon_deduction; a.n += 1
      uj.set(p.trip_id, a)
    }
    const exp = new Map<string, number>()
    for (const e of scopedDb.expenses) exp.set(e.trip_id, (exp.get(e.trip_id) ?? 0) + e.amount)
    const internal = new Map<string, number>()
    for (const c of scopedDb.internalCosts) internal.set(c.trip_id, (internal.get(c.trip_id) ?? 0) + c.amount)

    return scopedDb.transactions.map((t: CommissionTransaction) => {
      const d = drivers.get(t.driver_id)
      const v = vehicles.get(t.vehicle_id)
      const r = routes.get(t.route_id)
      const j = jobOrders.get(t.job_order_id)
      const pr = projects.get(t.project_id)
      const u = uj.get(t.id) ?? { uj: 0, kasbon: 0, n: 0 }
      return {
        ...t,
        driver_code: d?.driver_code ?? '',
        driver_name: d?.driver_name ?? '',
        plate_number: v?.plate_number ?? '',
        sijo: j?.sijo ?? '',
        route_code: r?.route_code ?? '',
        route_name: r?.route_name ?? '',
        route_price: r?.price ?? 0,
        ujroute: r?.ujroute ?? 0,
        toll: r?.toll ?? 0,
        commissioner: r?.commissioner ?? 0,
        project_code: pr?.project_code ?? '',
        project_name: pr?.project_name ?? '',
        uj_total: u.uj,
        kasbon_total: u.kasbon,
        tf_total: u.uj - u.kasbon,
        termin_count: u.n,
        expense_total: exp.get(t.id) ?? 0,
        internal_total: internal.get(t.id) ?? 0,
      }
    })
  }, [scopedDb])

  const billingRows = useMemo<BillingRow[]>(() => {
    const jobOrders = new Map(scopedDb.jobOrders.map((j) => [j.id, j]))
    return scopedDb.billings.map((b: Billing) => {
      const j = jobOrders.get(b.job_order_id)
      return {
        ...b,
        sijo: j?.sijo ?? '',
        customer_name: j?.customer_name ?? '',
        customer_code: j?.customer_code ?? '',
        party: j?.party ?? '',
      }
    })
  }, [scopedDb])

  const deliveryNoteRows = useMemo<DeliveryNoteRow[]>(() => {
    const vehicles = new Map(scopedDb.vehicles.map((v) => [v.id, v]))
    const jobOrders = new Map(scopedDb.jobOrders.map((j) => [j.id, j]))
    const drivers = new Map(scopedDb.drivers.map((d) => [d.id, d]))
    const routes = new Map(scopedDb.routes.map((r) => [r.id, r]))
    return scopedDb.deliveryNotes.map((n: DeliveryNote) => {
      const d = drivers.get(n.driver_id)
      const r = routes.get(n.route_id)
      return {
        ...n,
        plate_number: vehicles.get(n.vehicle_id)?.plate_number ?? '',
        driver_code: d?.driver_code ?? '',
        driver_name: d?.driver_name ?? '',
        route_code: r?.route_code ?? '',
        route_name: r?.route_name ?? '',
        sijo: jobOrders.get(n.job_order_id)?.sijo ?? '',
        container_no: n.containers[0] ?? '',
        container_count: n.containers.length,
      }
    })
  }, [scopedDb])

  const value = useMemo<DataContextValue>(
    () => ({ db: scopedDb, dbAll: db, loading, error, reload: runLoad, simulateError, muatUlangData, resetToSample, create, update, remove, transactionRows, billingRows, deliveryNoteRows }),
    [scopedDb, db, loading, error, runLoad, simulateError, muatUlangData, resetToSample, create, update, remove, transactionRows, billingRows, deliveryNoteRows],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData harus dipakai di dalam <DataProvider>')
  return ctx
}
