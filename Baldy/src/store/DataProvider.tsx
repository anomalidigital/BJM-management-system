import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AksiAudit, AuditLog, Billing, BillingRow, CommissionTransaction, Database, EntityKey, KasbonEntry, PenyelesaianUj, PerubahanAudit,
  TransactionRow, TripEvent, UjPayment, Workspace,
} from '../types'
import { loadDatabase, resetDatabase, resetToSampleDatabase, saveDatabase } from './persistence'
import { nowISO, uid } from '../lib/utils'
import { todayISO } from '../lib/format'
import { petaSaldoKasbon } from '../lib/kasbon'
import { hargaTrip, hitungKomisiTrip } from '../lib/komisi'
import {
  ataDari, biayaDitagihkan, dibayarPerusahaan, idPerjalanan, idTampil, kodeAreaRute, lokasiTrip, menahanKendaraan, normalKodeArea,
  sekarangLokal, trTrip,
} from '../lib/trip'
import { bedaRecord, LABEL_ENTITAS, labelRecord } from '../lib/audit'
import { formatRupiah } from '../lib/format'
import { bersihkanLampiran, hapusLampiran } from '../lib/lampiran'
import { useWorkspace } from './WorkspaceProvider'
import { useAuth } from './AuthProvider'

type Row<K extends EntityKey> = Database[K][number]
type NewRow<K extends EntityKey> = Omit<Row<K>, 'id' | 'created_at' | 'updated_at'>

/**
 * Koleksi yang isinya terpisah antar workspace. Master (karyawan, mobil, route,
 * project, SI/JO) dan kasbon karyawan sengaja dipakai bersama supaya relasi
 * antar data tidak putus saat workspace berganti - lihat TBD-17.
 */
const SCOPED_KEYS = ['transactions', 'billings', 'commissionSchemes', 'contracts', 'dokumen'] as const

/** Batas catatan Audit Log yang disimpan di browser (ruang localStorage terbatas). */
const BATAS_AUDIT = 3000

/** Isian satu catatan Audit Log; siapa & kapan diisi otomatis. */
export interface CatatanAudit {
  aksi: AksiAudit
  entitas: string
  entity_id: string
  label: string
  ringkasan: string
  perubahan?: PerubahanAudit[]
}

/** Data lama tanpa penanda cabang diperlakukan sebagai Priok. */
const wsOf = (row: { workspace?: Workspace }): Workspace => row.workspace ?? 'priok'

/** Isian termin uang jalan dari form. */
export type TerminForm = Pick<UjPayment, 'payment_date' | 'driver_id' | 'jenis' | 'uj_amount' | 'kasbon_deduction' | 'notes' | 'attachments'>
  & Partial<Pick<UjPayment, 'override_note' | 'override_by'>>

/** Seluruh id lampiran yang masih dirujuk record, lintas workspace. */
function lampiranDipakai(d: Database): Set<string> {
  const ids = new Set<string>()
  const ambil = (rows: Array<{ attachments?: string[] }>) => rows.forEach((r) => r.attachments?.forEach((a) => ids.add(a)))
  ambil(d.vehicles); ambil(d.drivers); ambil(d.contracts ?? [])
  ambil(d.ujPayments); ambil(d.expenses); ambil(d.internalCosts); ambil(d.tripNotes); ambil(d.kasbonEntries)
  ambil(d.tripEvents ?? []); ambil(d.dokumen ?? [])
  // Dokumen penting karyawan & kendaraan (KTP, SIM, STNK, KIR, ...).
  for (const r of [...d.drivers, ...d.vehicles]) Object.values(r.dokumen ?? {}).forEach((x) => x.berkas?.forEach((a) => ids.add(a)))
  // Lampiran yang menempel langsung di trip: bukti override harga dan foto POD.
  for (const t of d.transactions) {
    t.override_attachments?.forEach((a) => ids.add(a))
    t.pod_attachments?.forEach((a) => ids.add(a))
    t.pi_attachments?.forEach((a) => ids.add(a))
  }
  return ids
}

/** Potongan kasbon (mutasi "trip" bernilai negatif) milik satu trip. */
const potonganTrip = (entries: KasbonEntry[], tripId: string) =>
  entries.filter((e) => e.trip_id === tripId && e.kind === 'trip' && e.amount < 0)

/** Satu termin UJ pada ringkasan trip, untuk penyelesaian saat dibatalkan. */
export interface RincianTermin {
  id: string
  sequence: number
  driver_id: string
  uj: number
  kasbon: number
  /** Yang sudah ditransfer ke sopir: UJ - potong kasbon. */
  tf: number
}

/** Ringkasan isi trip sebelum dibatalkan, untuk peringatan. */
export interface IsiTrip {
  termin: number
  uj: number
  kasbon: number
  /** Potongan kasbon yang akan dikembalikan bila trip dibatalkan. */
  kasbonKembali: number
  rincianTermin: RincianTermin[]
  biaya: number
  biayaTotal: number
  internal: number
  internalTotal: number
  lainnya: number
  /** Kejadian di tab Perjalanan. */
  perjalanan: number
}

/** Pilihan saat membatalkan trip. */
export interface OpsiBatal {
  alasan: string
  /** Per termin: TF yang sudah diterima sopir dikembalikan tunai, atau jadi kasbon. */
  penyelesaian: Record<string, 'kembali' | 'kasbon'>
  /** Biaya cancel yang tetap ditagihkan ke klien (0 = tidak ada). */
  biayaCancel?: number
}

/** Isian saat menutup trip (Receive all POD / bukti dokumen fisik). */
export interface OpsiTutup {
  /** Dokumen fisik sudah diterima di pool; false = baru foto, fisik menyusul. */
  podFisik: boolean
  podFoto: string[]
  /**
   * Ada muatan balik dari lokasi bongkar. Sejak 13 Okt 2026 backload dibuat dari menu ⋯ tabel trip,
   * jadi Tutup Trip tidak menanyakannya lagi; kosong = penanda lama trip dibiarkan.
   */
  adaBackload?: boolean
  /** Mobil sudah kembali di pool: kendaraannya langsung bisa dipakai trip lain. */
  diPool?: boolean
}

interface DataContextValue {
  /** Database yang sudah disaring mengikuti workspace aktif. */
  db: Database
  /** Seluruh data lintas workspace - dipakai halaman Tools / ekspor / kasbon. */
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
  /** Trip yang sudah di-join dengan sopir / kendaraan / route / SI-JO. */
  transactionRows: TransactionRow[]
  /** Tagihan yang sudah di-join dengan SI/JO. */
  billingRows: BillingRow[]
  /** Saldo kasbon tiap karyawan (lintas workspace). */
  saldoKasbon: Map<string, number>

  /* ── Aksi domain trip ─────────────────────────────────── */
  /**
   * Buat trip. UJROUTE route hanya patokan: uang jalan baru tercatat saat
   * termin benar-benar dibayar di tab Uang Jalan.
   */
  buatTrip: (row: NewRow<'transactions'>) => CommissionTransaction
  ubahTrip: (tripId: string, patch: Partial<CommissionTransaction>) => void
  /** Simpan termin UJ sekaligus menyelaraskan potongan kasbon sopirnya. */
  simpanTermin: (tripId: string, form: TerminForm, ada?: UjPayment) => void
  hapusTermin: (p: UjPayment) => void
  isiTrip: (tripId: string) => IsiTrip
  /**
   * Tandai batal. Catatannya tetap disimpan sebagai arsip (tidak dihitung
   * laporan); potongan kasbon dikembalikan, dan TF yang sudah diterima sopir
   * dicatat dikembalikan tunai atau dijadikan kasbon.
   */
  batalkanTrip: (tripId: string, opsi: OpsiBatal) => void
  /** Tutup trip: status Selesai, POD dicatat, dan backload ditandai bila ada. */
  tutupTrip: (tripId: string, opsi: OpsiTutup) => void
  /** Hapus trip beserta seluruh catatannya, seolah tidak pernah ada. */
  hapusTrip: (tripId: string) => void
  /** Catat kendaraan trip sudah kembali di pool: kendaraannya bisa dipilih trip lain lagi. */
  tandaiDiPool: (tripId: string, waktu?: string, lokasi?: string) => void

  /* ── Audit Log ────────────────────────────────────────── */
  /** Tulis satu catatan Audit Log (siapa & kapan diisi otomatis). */
  catatAudit: (e: CatatanAudit) => void
  /** Jalankan beberapa perubahan sebagai satu catatan Audit Log yang bermakna. */
  denganAudit: <T>(e: CatatanAudit, kerja: () => T) => T
}

const DataContext = createContext<DataContextValue | null>(null)

const EMPTY_DB: Database = {
  drivers: [], routes: [], vehicles: [], jobOrders: [], transactions: [],
  billings: [], projects: [], ujPayments: [], expenses: [],
  internalCosts: [], tripNotes: [], tripEvents: [], kasbonEntries: [], commissionSchemes: [], contracts: [],
  alamat: [], auditLogs: [], dokumen: [],
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace()
  const { user } = useAuth()
  const [db, setDb] = useState<Database>(EMPTY_DB)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hydrated = useRef(false)
  /** Salinan terbaru untuk aksi domain yang perlu membaca sebelum menulis. */
  const dbRef = useRef(db)
  dbRef.current = db
  /** Pengguna & workspace terbaru untuk Audit Log, tanpa membuat ulang fungsi tiap render. */
  const userRef = useRef(user)
  userRef.current = user
  const wsRef = useRef(workspace)
  wsRef.current = workspace
  /** > 0 selama aksi domain berjalan: perubahan di dalamnya dicatat sebagai satu catatan. */
  const diam = useRef(0)

  const catatAudit = useCallback((e: CatatanAudit) => {
    if (diam.current > 0) return
    const u = userRef.current
    const waktu = nowISO()
    const log: AuditLog = {
      id: uid('aud'), waktu, username: u?.username ?? '', nama: u?.name ?? '', peran: u?.role ?? '', workspace: wsRef.current,
      aksi: e.aksi, entitas: e.entitas, entity_id: e.entity_id, label: e.label, ringkasan: e.ringkasan, perubahan: e.perubahan ?? [],
      created_at: waktu, updated_at: waktu,
    }
    setDb((prev) => ({ ...prev, auditLogs: [log, ...(prev.auditLogs ?? [])].slice(0, BATAS_AUDIT) }))
  }, [])

  const denganAudit = useCallback(<T,>(e: CatatanAudit, kerja: () => T): T => {
    diam.current += 1
    try {
      return kerja()
    } finally {
      diam.current -= 1
      catatAudit(e)
    }
  }, [catatAudit])

  /** Nama jenis data untuk ringkasan Audit Log. */
  const namaEntitas = (key: EntityKey) => (LABEL_ENTITAS[key] ?? key).toLowerCase()
  /** Penanda trip untuk Audit Log & ringkasan. */
  const labelTrip = (tripId: string) => {
    const t = dbRef.current.transactions.find((x) => x.id === tripId)
    return t ? idTampil(t) : ''
  }

  // Pemuatan awal sengaja diberi jeda kecil supaya skeleton loading terlihat.
  const runLoad = useCallback(() => {
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      try {
        const dimuat = loadDatabase()
        setDb(dimuat)
        hydrated.current = true
        // Sapu berkas lampiran yang sudah tidak dirujuk record mana pun.
        bersihkanLampiran(lampiranDipakai(dimuat)).catch(() => undefined)
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
    if (key !== 'auditLogs') {
      catatAudit({
        aksi: 'buat', entitas: key, entity_id: created.id, label: labelRecord(key, created as unknown as Record<string, unknown>, dbRef.current),
        ringkasan: `Menambah ${namaEntitas(key)}`,
      })
    }
    return created
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, catatAudit])

  const update = useCallback(<K extends EntityKey>(key: K, id: string, patch: Partial<Row<K>>) => {
    const lama = (dbRef.current[key] as Row<K>[]).find((r) => r.id === id)
    setDb((prev) => ({
      ...prev,
      [key]: (prev[key] as Row<K>[]).map((r) => (r.id === id ? { ...r, ...patch, updated_at: nowISO() } : r)),
    }))
    if (key !== 'auditLogs' && lama) {
      const perubahan = bedaRecord(lama, patch)
      if (perubahan.length) {
        catatAudit({
          aksi: 'ubah', entitas: key, entity_id: id, label: labelRecord(key, { ...lama, ...patch } as unknown as Record<string, unknown>, dbRef.current),
          ringkasan: `Mengubah ${namaEntitas(key)}: ${perubahan.map((p) => p.field).join(', ')}`.slice(0, 160), perubahan,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catatAudit])

  const remove = useCallback(<K extends EntityKey>(key: K, ids: string | string[]): number => {
    const list = Array.isArray(ids) ? ids : [ids]
    if (list.length === 0) return 0
    const target = new Set(list)
    const lama = (dbRef.current[key] as Row<K>[]).filter((r) => target.has(r.id))
    setDb((prev) => ({ ...prev, [key]: (prev[key] as Row<K>[]).filter((r) => !target.has(r.id)) }))
    if (key !== 'auditLogs' && lama.length) {
      catatAudit({
        aksi: 'hapus', entitas: key, entity_id: lama[0].id,
        label: lama.map((r) => labelRecord(key, r as unknown as Record<string, unknown>, dbRef.current)).filter(Boolean).join(', ').slice(0, 120),
        ringkasan: lama.length > 1 ? `Menghapus ${lama.length} ${namaEntitas(key)}` : `Menghapus ${namaEntitas(key)}`,
      })
    }
    return list.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catatAudit])

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

  /* ── Aksi domain ──────────────────────────────────────── */

  /** Mutasi kasbon "trip" yang mengikuti satu termin: dibuat, diubah, atau dihapus. */
  const selaraskanKasbon = useCallback((tripId: string, p: Pick<UjPayment, 'id' | 'driver_id' | 'kasbon_deduction' | 'payment_date'>) => {
    const ada = dbRef.current.kasbonEntries.find((e) => e.uj_payment_id === p.id && e.kind === 'trip')
    if (!(p.kasbon_deduction > 0) || !p.driver_id) {
      if (ada) remove('kasbonEntries', ada.id)
      return
    }
    const isi = { employee_id: p.driver_id, entry_date: p.payment_date, amount: -p.kasbon_deduction, trip_id: tripId }
    if (ada) update('kasbonEntries', ada.id, isi)
    else create('kasbonEntries', { ...isi, kind: 'trip', uj_payment_id: p.id, notes: '', attachments: [] })
  }, [create, update, remove])

  const buatTrip = useCallback((row: NewRow<'transactions'>) => create('transactions', row), [create])

  const ubahTrip = useCallback((tripId: string, patch: Partial<CommissionTransaction>) => {
    update('transactions', tripId, patch)
  }, [update])

  const simpanTermin = useCallback((tripId: string, form: TerminForm, ada?: UjPayment) => {
    const seq = ada?.sequence ?? dbRef.current.ujPayments.filter((p) => p.trip_id === tripId).reduce((m, p) => Math.max(m, p.sequence), 0) + 1
    const potong = form.kasbon_deduction > 0 ? `, potong kasbon ${formatRupiah(form.kasbon_deduction)}` : ''
    const disetujui = form.override_note?.trim() ? ` (di atas patokan, disetujui ${form.override_by || 'Manager / Owner'}: ${form.override_note.trim()})` : ''
    denganAudit({
      aksi: ada ? 'ubah' : 'buat', entitas: 'ujPayments', entity_id: ada?.id ?? '', label: `Termin ${seq} · ${labelTrip(tripId)}`,
      ringkasan: `${ada ? 'Mengubah' : 'Menambah'} termin ${seq} uang jalan ${formatRupiah(form.uj_amount)}${potong}${disetujui}`.slice(0, 240),
      perubahan: ada ? bedaRecord(ada, form) : [],
    }, () => {
      if (ada) {
        update('ujPayments', ada.id, form)
        selaraskanKasbon(tripId, { ...form, id: ada.id })
      } else {
        const baru = create('ujPayments', { ...form, trip_id: tripId, sequence: seq })
        selaraskanKasbon(tripId, baru)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, update, selaraskanKasbon, denganAudit])

  const hapusTermin = useCallback((p: UjPayment) => {
    denganAudit({
      aksi: 'hapus', entitas: 'ujPayments', entity_id: p.id, label: `Termin ${p.sequence} · ${labelTrip(p.trip_id)}`,
      ringkasan: `Menghapus termin ${p.sequence} uang jalan ${formatRupiah(p.uj_amount)}`,
    }, () => {
      remove('ujPayments', p.id)
      const terkait = dbRef.current.kasbonEntries.filter((e) => e.uj_payment_id === p.id)
      if (terkait.length) remove('kasbonEntries', terkait.map((e) => e.id))
    })
    void hapusLampiran(p.attachments ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remove, denganAudit])

  const isiTrip = useCallback((tripId: string): IsiTrip => {
    const d = dbRef.current
    const termin = d.ujPayments.filter((p) => p.trip_id === tripId)
    const biaya = d.expenses.filter((e) => e.trip_id === tripId)
    const internal = d.internalCosts.filter((c) => c.trip_id === tripId)
    return {
      termin: termin.length,
      uj: termin.reduce((a, p) => a + p.uj_amount, 0),
      kasbon: termin.reduce((a, p) => a + p.kasbon_deduction, 0),
      kasbonKembali: potonganTrip(d.kasbonEntries, tripId).reduce((a, e) => a - e.amount, 0),
      rincianTermin: [...termin].sort((a, b) => a.sequence - b.sequence).map((p) => ({
        id: p.id, sequence: p.sequence, driver_id: p.driver_id,
        uj: p.uj_amount, kasbon: p.kasbon_deduction, tf: p.uj_amount - p.kasbon_deduction,
      })),
      biaya: biaya.length,
      biayaTotal: biaya.reduce((a, e) => a + e.amount, 0),
      internal: internal.length,
      internalTotal: internal.reduce((a, c) => a + c.amount, 0),
      lainnya: d.tripNotes.filter((n) => n.trip_id === tripId).length,
      perjalanan: (d.tripEvents ?? []).filter((e) => e.trip_id === tripId).length,
    }
  }, [])

  /** Hapus seluruh catatan keuangan trip beserta lampirannya. */
  const kosongkanTrip = useCallback((tripId: string) => {
    const d = dbRef.current
    const termin = d.ujPayments.filter((p) => p.trip_id === tripId)
    const biaya = d.expenses.filter((e) => e.trip_id === tripId)
    const internal = d.internalCosts.filter((c) => c.trip_id === tripId)
    const lain = d.tripNotes.filter((n) => n.trip_id === tripId)
    const jalan = (d.tripEvents ?? []).filter((e) => e.trip_id === tripId)
    remove('ujPayments', termin.map((x) => x.id))
    remove('expenses', biaya.map((x) => x.id))
    remove('internalCosts', internal.map((x) => x.id))
    remove('tripNotes', lain.map((x) => x.id))
    remove('tripEvents', jalan.map((x) => x.id))
    const trip = d.transactions.find((t) => t.id === tripId)
    void hapusLampiran([
      ...[...termin, ...biaya, ...internal, ...lain, ...jalan].flatMap((x) => x.attachments ?? []),
      ...(trip?.override_attachments ?? []), ...(trip?.pod_attachments ?? []), ...(trip?.pi_attachments ?? []),
    ])
  }, [remove])

  const batalkanTrip = useCallback((tripId: string, opsi: OpsiBatal) => {
    const d = dbRef.current
    const trip = d.transactions.find((t) => t.id === tripId)
    const no = trip ? idTampil(trip) : ''
    const hariIni = todayISO()
    diam.current += 1
    try {
    // Potongan kasbon dikembalikan satu per satu. Pasangan otomatis ini tetap
    // menunjuk termin asalnya, sehingga terkunci dari ubah / hapus manual.
    for (const e of potonganTrip(d.kasbonEntries, tripId)) {
      create('kasbonEntries', {
        employee_id: e.employee_id, entry_date: hariIni, kind: 'pembatalan', amount: -e.amount,
        trip_id: tripId, uj_payment_id: e.uj_payment_id, notes: `Potongan dikembalikan: trip ${no} dibatalkan`, attachments: [],
      })
    }
    // Uang yang sudah ditransfer ke sopir tidak hilang karena trip batal:
    // dikembalikan tunai, atau menjadi kasbon sopir itu.
    const penyelesaian: PenyelesaianUj[] = []
    for (const p of d.ujPayments.filter((x) => x.trip_id === tripId)) {
      const tf = p.uj_amount - p.kasbon_deduction
      if (tf <= 0) continue
      const cara = p.driver_id ? (opsi.penyelesaian[p.id] ?? 'kasbon') : 'kembali'
      penyelesaian.push({ uj_payment_id: p.id, driver_id: p.driver_id, tf, cara })
      if (cara === 'kasbon') {
        create('kasbonEntries', {
          employee_id: p.driver_id, entry_date: hariIni, kind: 'pembatalan', amount: tf,
          trip_id: tripId, uj_payment_id: p.id, notes: `UJ termin ${p.sequence} trip ${no} tidak dikembalikan, jadi kasbon`, attachments: [],
        })
      }
    }
    update('transactions', tripId, {
      status: 'batal', cancelled_at: hariIni, cancel_reason: opsi.alasan.trim(), cancel_settlement: penyelesaian,
      cancel_fee: Math.max(0, opsi.biayaCancel ?? 0),
    })
    } finally {
      diam.current -= 1
    }
    catatAudit({
      aksi: 'batal', entitas: 'transactions', entity_id: tripId, label: no,
      ringkasan: `Membatalkan trip: ${opsi.alasan.trim()}${opsi.biayaCancel ? ` (biaya cancel ${formatRupiah(opsi.biayaCancel)})` : ''}`.slice(0, 200),
    })
  }, [create, update, catatAudit])

  /** Kejadian "Tiba di pool" sudah tercatat untuk trip ini? */
  const punyaPool = (tripId: string) => (dbRef.current.tripEvents ?? []).some((e) => e.trip_id === tripId && e.jenis === 'pool')

  const tutupTrip = useCallback((tripId: string, opsi: OpsiTutup) => {
    const waktu = sekarangLokal()
    const catatan = [
      `POD ${opsi.podFisik ? 'fisik diterima' : 'baru foto'}`, opsi.adaBackload ? 'ada backload / lanjutan' : '', opsi.diPool ? 'mobil sudah di pool' : '',
    ].filter(Boolean).join(', ')
    denganAudit({ aksi: 'tutup', entitas: 'transactions', entity_id: tripId, label: labelTrip(tripId), ringkasan: `Menutup trip: ${catatan}` }, () => {
      update('transactions', tripId, {
        status: 'selesai', closed_at: todayISO(), pod_fisik: opsi.podFisik, pod_fisik_at: opsi.podFisik ? todayISO() : null,
        pod_attachments: opsi.podFoto, ...(opsi.adaBackload !== undefined ? { ada_backload: opsi.adaBackload } : {}),
        ...(opsi.diPool ? { pool_at: waktu } : {}),
      })
      if (opsi.diPool && !punyaPool(tripId)) {
        create('tripEvents', { trip_id: tripId, jenis: 'pool', waktu, lokasi: 'Pool', catatan: 'Dicatat saat Tutup Trip', attachments: [] })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, update, denganAudit])

  const tandaiDiPool = useCallback((tripId: string, waktu = sekarangLokal(), lokasi = 'Pool') => {
    denganAudit({ aksi: 'pool', entitas: 'transactions', entity_id: tripId, label: labelTrip(tripId), ringkasan: `Mobil kembali di pool (${waktu.replace('T', ' ')})` }, () => {
      update('transactions', tripId, { pool_at: waktu })
      if (!punyaPool(tripId)) create('tripEvents', { trip_id: tripId, jenis: 'pool', waktu, lokasi, catatan: '', attachments: [] })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, update, denganAudit])

  const hapusTrip = useCallback((tripId: string) => {
    const d = dbRef.current
    denganAudit({ aksi: 'hapus', entitas: 'transactions', entity_id: tripId, label: labelTrip(tripId), ringkasan: 'Menghapus trip beserta seluruh catatannya' }, () => {
      kosongkanTrip(tripId)
      const mutasi = d.kasbonEntries.filter((e) => e.trip_id === tripId)
      if (mutasi.length) remove('kasbonEntries', mutasi.map((e) => e.id))
      remove('transactions', tripId)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kosongkanTrip, remove, denganAudit])

  /**
   * Penyaringan per workspace dikerjakan di satu tempat ini, sehingga seluruh
   * halaman ikut berganti isi tanpa perlu tahu soal workspace.
   */
  const scopedDb = useMemo<Database>(() => {
    const transactions = db.transactions.filter((t) => wsOf(t) === workspace)
    const tripIds = new Set(transactions.map((t) => t.id))
    // Catatan keuangan trip batal tetap tersimpan sebagai arsip, tetapi tidak
    // ikut dihitung di mana pun. Arsipnya dibaca halaman trip lewat dbAll.
    const tripAktif = new Set(transactions.filter((t) => t.status !== 'batal').map((t) => t.id))
    return {
      ...db,
      transactions,
      // Anak dari trip ikut induknya, tidak perlu penanda workspace sendiri.
      ujPayments: db.ujPayments.filter((p) => tripAktif.has(p.trip_id)),
      expenses: db.expenses.filter((e) => tripAktif.has(e.trip_id)),
      internalCosts: db.internalCosts.filter((c) => tripAktif.has(c.trip_id)),
      tripNotes: db.tripNotes.filter((n) => tripIds.has(n.trip_id)),
      tripEvents: (db.tripEvents ?? []).filter((e) => tripIds.has(e.trip_id)),
      billings: db.billings.filter((b) => wsOf(b) === workspace),
      commissionSchemes: db.commissionSchemes.filter((s) => wsOf(s) === workspace),
      contracts: (db.contracts ?? []).filter((c) => wsOf(c) === workspace),
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
    const tol = new Map<string, number>()
    const tagih = new Map<string, number>()
    const prsh = new Map<string, number>()
    for (const e of scopedDb.expenses) {
      exp.set(e.trip_id, (exp.get(e.trip_id) ?? 0) + e.amount)
      if (e.expense_type === 'Tol') tol.set(e.trip_id, (tol.get(e.trip_id) ?? 0) + e.amount)
      if (biayaDitagihkan(e)) tagih.set(e.trip_id, (tagih.get(e.trip_id) ?? 0) + e.amount)
      if (dibayarPerusahaan(e)) prsh.set(e.trip_id, (prsh.get(e.trip_id) ?? 0) + e.amount)
    }
    // Kejadian perjalanan per trip, urut waktu: ATA dan posisi terakhir.
    const jalan = new Map<string, TripEvent[]>()
    const urutJalan = [...scopedDb.tripEvents].sort((a, b) => a.waktu.localeCompare(b.waktu) || a.created_at.localeCompare(b.created_at))
    for (const e of urutJalan) {
      const list = jalan.get(e.trip_id) ?? []
      list.push(e)
      jalan.set(e.trip_id, list)
    }
    const contracts = new Map(scopedDb.contracts.map((c) => [c.id, c]))
    // Trip yang sudah dilanjutkan backload / rute lanjutan: kendaraannya pindah ke trip lanjutan.
    const dilanjutkan = new Set(scopedDb.transactions.filter((t) => t.backload_dari && t.status !== 'batal').map((t) => t.backload_dari as string))
    const aturan = scopedDb.commissionSchemes
    const internal = new Map<string, number>()
    for (const c of scopedDb.internalCosts) internal.set(c.trip_id, (internal.get(c.trip_id) ?? 0) + c.amount)

    return scopedDb.transactions.map((t: CommissionTransaction) => {
      const ids = t.driver_ids?.length ? t.driver_ids : t.driver_id ? [t.driver_id] : []
      const d = drivers.get(ids[0] ?? t.driver_id)
      const v = vehicles.get(t.vehicle_id)
      const r = routes.get(t.route_id)
      const j = jobOrders.get(t.job_order_id)
      const pr = projects.get(t.project_id)
      const m = t.manager_id ? drivers.get(t.manager_id) : undefined
      const u = uj.get(t.id) ?? { uj: 0, kasbon: 0, n: 0 }
      const k = t.contract_id ? contracts.get(t.contract_id) : undefined
      // Komisi dari master Komisi. Penerimanya sopir utama; trip batal tidak dapat komisi.
      const dasar = {
        layanan: t.service_type ?? 'callout',
        konfigurasi: v?.configuration ?? '',
        cost_value: t.cost_value ?? 0,
        route_price: r?.price ?? 0,
        ujroute: r?.ujroute ?? 0,
        uj_total: u.uj,
      }
      const batal = t.status === 'batal'
      const kejadian = jalan.get(t.id) ?? []
      const lokasi = lokasiTrip(t, r?.route_name ?? '')
      const area = r ? kodeAreaRute(r) : { asal: normalKodeArea(lokasi.muat), tujuan: normalKodeArea(lokasi.bongkar) }
      const harga = hargaTrip({ cost_value: t.cost_value ?? 0, route_price: r?.price ?? 0 })
      const kSopir = batal ? null : hitungKomisiTrip(aturan, { ...dasar, role: 'sopir' })
      const kManager = batal || !(t.manager_id || t.manager_name) ? null : hitungKomisiTrip(aturan, { ...dasar, role: 'manager' })
      return {
        ...t,
        driver_ids: ids,
        driver_code: d?.driver_code ?? '',
        driver_name: d?.driver_name ?? '',
        driver_names: ids.map((i) => drivers.get(i)?.driver_name).filter(Boolean).join(', '),
        plate_number: v?.plate_number ?? '',
        sijo: j?.sijo ?? '',
        route_code: r?.route_code ?? '',
        route_name: r?.route_name ?? '',
        route_price: r?.price ?? 0,
        harga,
        // Harga trip = salinan Harga Rute saat trip dibuat; khusus bila memang berbeda dari Harga Rute.
        harga_khusus: (t.cost_value ?? 0) > 0 && t.cost_value !== (r?.price ?? 0),
        ujroute: r?.ujroute ?? 0,
        toll: r?.toll ?? 0,
        commissioner: r?.commissioner ?? 0,
        project_code: pr?.project_code ?? '',
        project_name: pr?.project_name ?? '',
        manager_label: m?.driver_name ?? t.manager_name ?? '',
        uj_total: u.uj,
        kasbon_total: u.kasbon,
        tf_total: u.uj - u.kasbon,
        termin_count: u.n,
        expense_total: exp.get(t.id) ?? 0,
        internal_total: internal.get(t.id) ?? 0,
        toll_paid: tol.get(t.id) ?? 0,
        vehicle_config: v?.configuration ?? '',
        contract_no: k?.contract_no ?? '',
        client_name: k ? projects.get(k.project_id)?.project_name ?? '' : '',
        tr_list: trTrip(t),
        muat: lokasi.muat,
        bongkar: lokasi.bongkar,
        ata: ataDari(kejadian),
        posisi: kejadian.at(-1) ?? null,
        biaya_ditagihkan: tagih.get(t.id) ?? 0,
        biaya_perusahaan: prsh.get(t.id) ?? 0,
        komisi_sopir: kSopir?.nilai ?? 0,
        komisi_manager: kManager?.nilai ?? 0,
        komisi_keterangan: batal ? 'Trip dibatalkan'
          : !kSopir?.aturan && !t.vehicle_id ? 'Kendaraan trip belum diisi, jadi aturan komisi belum bisa dipilih'
          : kSopir?.keterangan ?? '',
        id_tampil: idTampil(t),
        id_perjalanan: idPerjalanan(t),
        menahan_kendaraan: menahanKendaraan(t, kejadian.some((e) => e.jenis === 'pool'), dilanjutkan.has(t.id)),
        tagihan_total: batal ? t.cancel_fee ?? 0 : harga + (tagih.get(t.id) ?? 0),
        area_asal: area.asal,
        area_tujuan: area.tujuan,
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

  const saldoKasbon = useMemo(() => petaSaldoKasbon(db.kasbonEntries as KasbonEntry[]), [db.kasbonEntries])

  const value = useMemo<DataContextValue>(
    () => ({
      db: scopedDb, dbAll: db, loading, error, reload: runLoad, simulateError, muatUlangData, resetToSample,
      create, update, remove, transactionRows, billingRows, saldoKasbon,
      buatTrip, ubahTrip, simpanTermin, hapusTermin, isiTrip, batalkanTrip, tutupTrip, hapusTrip, tandaiDiPool, catatAudit, denganAudit,
    }),
    [scopedDb, db, loading, error, runLoad, simulateError, muatUlangData, resetToSample, create, update, remove,
      transactionRows, billingRows, saldoKasbon, buatTrip, ubahTrip, simpanTermin, hapusTermin, isiTrip, batalkanTrip, tutupTrip, hapusTrip,
      tandaiDiPool, catatAudit, denganAudit],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData harus dipakai di dalam <DataProvider>')
  return ctx
}
