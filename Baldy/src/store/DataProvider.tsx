import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Billing, BillingRow, CommissionTransaction, Database, DeliveryNote, DeliveryNoteRow, EntityKey, TransactionRow } from '../types'
import { loadDatabase, resetDatabase, resetToSampleDatabase, saveDatabase } from './persistence'
import { nowISO, uid } from '../lib/utils'

type Row<K extends EntityKey> = Database[K][number]
type NewRow<K extends EntityKey> = Omit<Row<K>, 'id' | 'created_at' | 'updated_at'>

interface DataContextValue {
  db: Database
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
}

export function DataProvider({ children }: { children: ReactNode }) {
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
    const created = { ...row, id: uid(key.slice(0, 3)), created_at: nowISO(), updated_at: nowISO() } as Row<K>
    setDb((prev) => ({ ...prev, [key]: [created, ...(prev[key] as Row<K>[])] }))
    return created
  }, [])

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

  const transactionRows = useMemo<TransactionRow[]>(() => {
    const drivers = new Map(db.drivers.map((d) => [d.id, d]))
    const vehicles = new Map(db.vehicles.map((v) => [v.id, v]))
    const routes = new Map(db.routes.map((r) => [r.id, r]))
    const jobOrders = new Map(db.jobOrders.map((j) => [j.id, j]))
    const projects = new Map(db.projects.map((p) => [p.id, p]))
    // Agregasi termin UJ dan biaya per trip - dihitung sekali di sini.
    const uj = new Map<string, { uj: number; kasbon: number; n: number }>()
    for (const p of db.ujPayments) {
      const a = uj.get(p.trip_id) ?? { uj: 0, kasbon: 0, n: 0 }
      a.uj += p.uj_amount; a.kasbon += p.kasbon_deduction; a.n += 1
      uj.set(p.trip_id, a)
    }
    const exp = new Map<string, number>()
    for (const e of db.expenses) exp.set(e.trip_id, (exp.get(e.trip_id) ?? 0) + e.amount)

    return db.transactions.map((t: CommissionTransaction) => {
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
        commissioner: r?.commissioner ?? 0,
        project_code: pr?.project_code ?? '',
        project_name: pr?.project_name ?? '',
        uj_total: u.uj,
        kasbon_total: u.kasbon,
        tf_total: u.uj - u.kasbon,
        termin_count: u.n,
        expense_total: exp.get(t.id) ?? 0,
      }
    })
  }, [db])

  const billingRows = useMemo<BillingRow[]>(() => {
    const jobOrders = new Map(db.jobOrders.map((j) => [j.id, j]))
    return db.billings.map((b: Billing) => {
      const j = jobOrders.get(b.job_order_id)
      return {
        ...b,
        sijo: j?.sijo ?? '',
        customer_name: j?.customer_name ?? '',
        customer_code: j?.customer_code ?? '',
        party: j?.party ?? '',
      }
    })
  }, [db])

  const deliveryNoteRows = useMemo<DeliveryNoteRow[]>(() => {
    const vehicles = new Map(db.vehicles.map((v) => [v.id, v]))
    const jobOrders = new Map(db.jobOrders.map((j) => [j.id, j]))
    return db.deliveryNotes.map((n: DeliveryNote) => ({
      ...n,
      plate_number: vehicles.get(n.vehicle_id)?.plate_number ?? '',
      sijo: jobOrders.get(n.job_order_id)?.sijo ?? '',
      container_count: n.containers.length,
    }))
  }, [db])

  const value = useMemo<DataContextValue>(
    () => ({ db, loading, error, reload: runLoad, simulateError, muatUlangData, resetToSample, create, update, remove, transactionRows, billingRows, deliveryNoteRows }),
    [db, loading, error, runLoad, simulateError, muatUlangData, resetToSample, create, update, remove, transactionRows, billingRows, deliveryNoteRows],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData harus dipakai di dalam <DataProvider>')
  return ctx
}
