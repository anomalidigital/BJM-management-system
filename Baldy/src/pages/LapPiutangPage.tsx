import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FaFileExport, FaLink, FaPen, FaPlus, FaPrint, FaTrashCan, FaTriangleExclamation } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Tabs } from '../components/ui/Tabs'
import { DateInput, Field, FieldError, Input, Radio, Select } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import type { Option } from '../components/ui/SearchableSelect'
import { LampiranInput, LampiranThumbs } from '../components/ui/Lampiran'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { NilaiPiutang, teksPiutang } from '../components/ui/NilaiPiutang'
import { NotFoundState } from '../components/ui/States'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { hapusLampiran } from '../lib/lampiran'
import { jenisPiutang, saldoKasbon, sisiKaryawan } from '../lib/kasbon'
import { cn, downloadFile, matchesQuery, sum } from '../lib/utils'
import { endOfMonthISO, formatDate, formatNumber, formatRupiah, galatRentang, rentangTanggal, startOfMonthISO, todayISO } from '../lib/format'
import { useFilter } from '../lib/useFilter'
import { periodeAktif } from '../lib/periode'
import { JENIS_PIUTANG_LABEL, KASBON_LABEL, ROLE_LABEL } from '../types'
import type { Driver, JenisPiutang, KasbonEntry } from '../types'

const ISO = /^\d{4}-\d{2}-\d{2}$/

type Status = 'ada' | 'tidak' | 'semua'
const STATUS_LABEL: Record<Status, string> = { ada: 'Masih punya piutang', tidak: 'Tidak punya piutang', semua: 'Semua' }

/** Satu baris per karyawan; seluruh angka dari sisi karyawan (piutang minus, pelunasan plus). */
interface BarisPiutang {
  /** id karyawan (employee_id mutasi). */
  id: string
  kode: string
  nama: string
  peran: string
  /** false = karyawan sudah dihapus, tetapi mutasinya masih tersimpan. */
  terdaftar: boolean
  nonaktif: boolean
  /** Saldo dari seluruh mutasi sebelum tanggal awal periode. */
  awal: number
  /** Piutang dalam periode (bertanda minus). */
  piutang: number
  /** Pelunasan dalam periode (bertanda plus). */
  lunas: number
  akhir: number
  mutasi: number
  /** Saldo pernah plus (lebih bayar) menurut urutan tanggal: tanda tanggal mutasi terbalik. */
  lebihBayar: string
}

/** Tanggal pertama saldo karyawan menjadi plus (lebih bayar) bila mutasi diurutkan per hari. */
function cekLebihBayar(list: KasbonEntry[]): string {
  const perHari = new Map<string, number>()
  for (const e of list) perHari.set(e.entry_date, (perHari.get(e.entry_date) ?? 0) + sisiKaryawan(e.amount))
  let saldo = 0
  for (const tanggal of [...perHari.keys()].sort()) {
    saldo += perHari.get(tanggal) ?? 0
    if (saldo > 0) return tanggal
  }
  return ''
}

/** Rekap per karyawan untuk periode awal..akhir; karyawan tanpa saldo & tanpa mutasi tidak ikut. */
function susunPiutang(drivers: Driver[], entries: KasbonEntry[], awal: string, akhir: string): BarisPiutang[] {
  const orang = new Map(drivers.map((d) => [d.id, d]))
  const per = new Map<string, KasbonEntry[]>()
  for (const e of entries) per.set(e.employee_id, [...(per.get(e.employee_id) ?? []), e])
  const out: BarisPiutang[] = []
  for (const [id, list] of per) {
    let sAwal = 0
    let piutang = 0
    let lunas = 0
    let mutasi = 0
    for (const e of list) {
      const n = sisiKaryawan(e.amount)
      if (e.entry_date < awal) sAwal += n
      else if (e.entry_date <= akhir) {
        mutasi += 1
        if (n < 0) piutang += n
        else lunas += n
      }
    }
    if (sAwal === 0 && mutasi === 0) continue
    const d = orang.get(id)
    out.push({
      id, kode: d?.driver_code ?? '—', nama: d?.driver_name ?? 'Karyawan sudah dihapus',
      peran: d ? ROLE_LABEL[d.role ?? 'sopir'] ?? d.role : '—', terdaftar: !!d, nonaktif: d?.status === 'nonaktif',
      awal: sAwal, piutang, lunas, akhir: sAwal + piutang + lunas, mutasi, lebihBayar: cekLebihBayar(list),
    })
  }
  // Piutang terbesar (paling minus) dulu, lalu kode karyawan.
  return out.sort((a, b) => a.akhir - b.akhir || a.kode.localeCompare(b.kode, 'id', { numeric: true }))
}

const cocokStatus = (r: BarisPiutang, s: Status) => s === 'semua' || (s === 'ada' ? r.akhir < 0 : r.akhir >= 0)
const bulanDari = (ref: Date) => ({ awal: startOfMonthISO(ref), akhir: endOfMonthISO(ref) })

/** Isian modal Tambah / Ubah Transaksi. */
interface FormTransaksi {
  karyawan: string
  jenis: JenisPiutang
  jumlah: number
  tanggal: string
  catatan: string
  bukti: string[]
}

/**
 * Laporan -> Piutang Karyawan. Revisi atasan 13 Okt 2026: transaksi piutang karyawan dicatat di
 * sini (dipindah dari halaman karyawan), jenisnya hanya Piutang dan Lunas. Angka dari sisi karyawan:
 * piutang minus (merah), pelunasan plus (hijau), saldo minus = masih punya piutang. Potongan uang
 * jalan di trip tercatat otomatis sebagai Lunas. Tab Per Karyawan = rekap periode, tab Transaksi =
 * daftar mutasinya. Periode, status, dan tab disimpan di alamat halaman.
 */
export function LapPiutangPage() {
  const { dbAll, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [preview, setPreview] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  // Periode bawaan sama dengan "Periode" di topbar dan laporan lain: bulan terakhir yang punya trip
  // (14 Okt 2026: tiap laporan dulu memakai periodenya sendiri sehingga angkanya tidak cocok satu sama lain).
  const bawaan = useMemo(() => periodeAktif(transactionRows.map((t) => t.transaction_date)), [transactionRows])
  const awalUrl = params.get('awal') ?? ''
  const akhirUrl = params.get('akhir') ?? ''
  const awal = ISO.test(awalUrl) ? awalUrl : bawaan.start
  const akhir = ISO.test(akhirUrl) ? akhirUrl : bawaan.end
  const statusUrl = params.get('status') as Status | null
  const status: Status = statusUrl === 'ada' || statusUrl === 'tidak' ? statusUrl : 'semua'
  const tab = params.get('tab') === 'transaksi' ? 'transaksi' : 'karyawan'
  const jenisFilter = (params.get('jenis') ?? '') as JenisPiutang | ''
  const periodeSalah = awal > akhir

  function ubahUrl(ubah: (p: URLSearchParams) => void) {
    setParams((lama) => {
      const p = new URLSearchParams(lama)
      ubah(p)
      return p
    }, { replace: true })
  }
  const aturParam = (k: string, v: string) => ubahUrl((p) => (v ? p.set(k, v) : p.delete(k)))

  const semua = useMemo(
    () => (periodeSalah ? [] : susunPiutang(dbAll.drivers, dbAll.kasbonEntries, awal, akhir)),
    [dbAll.drivers, dbAll.kasbonEntries, awal, akhir, periodeSalah],
  )
  const search = useCallback((r: BarisPiutang, q: string) => matchesQuery(q, r.kode, r.nama, r.peran), [])
  const extraFilter = useCallback((r: BarisPiutang) => cocokStatus(r, status), [status])
  const table = useTable(semua, { search, extraFilter, extraFilterActive: status !== 'semua', pageSize: 25 })
  const rows = table.filtered

  /* ── Tab Transaksi: seluruh mutasi dalam periode ── */
  const orangMap = useMemo(() => new Map(dbAll.drivers.map((d) => [d.id, d])), [dbAll.drivers])
  const tripMap = useMemo(() => new Map(dbAll.transactions.map((t) => [t.id, t])), [dbAll.transactions])
  type BarisMutasi = KasbonEntry & { nama: string; kode: string; nilai: number; jenis: JenisPiutang }
  const mutasi = useMemo<BarisMutasi[]>(() => (periodeSalah ? [] : dbAll.kasbonEntries
    .filter((e) => e.entry_date >= awal && e.entry_date <= akhir)
    .map((e) => {
      const o = orangMap.get(e.employee_id)
      return { ...e, nama: o?.driver_name ?? 'Karyawan sudah dihapus', kode: o?.driver_code ?? '—', nilai: sisiKaryawan(e.amount), jenis: jenisPiutang(e) }
    })), [dbAll.kasbonEntries, orangMap, awal, akhir, periodeSalah])
  const cariMutasi = useCallback((e: BarisMutasi, q: string) => matchesQuery(q, e.nama, e.kode, e.notes, KASBON_LABEL[e.kind], tripMap.get(e.trip_id)?.transaction_no), [tripMap])
  const saringMutasi = useCallback((e: BarisMutasi) => !jenisFilter || e.jenis === jenisFilter, [jenisFilter])
  const tabelMutasi = useTable(mutasi, {
    search: cariMutasi, extraFilter: saringMutasi, extraFilterActive: !!jenisFilter,
    initialSortKey: 'entry_date', initialSortDir: 'desc', tieBreakKey: 'created_at', pageSize: 25,
  })

  const ringkas = useMemo(() => ({
    saldo: sum(semua, (r) => Math.min(0, r.akhir)),
    berpiutang: semua.filter((r) => r.akhir < 0).length,
    piutang: sum(semua, (r) => r.piutang),
    lunas: sum(semua, (r) => r.lunas),
    lebihBayar: semua.filter((r) => r.lebihBayar).length,
  }), [semua])
  const total = useMemo(() => ({
    awal: sum(rows, (r) => r.awal), piutang: sum(rows, (r) => r.piutang), lunas: sum(rows, (r) => r.lunas), akhir: sum(rows, (r) => r.akhir),
  }), [rows])

  const hariIni = new Date()
  const bulanIni = bulanDari(hariIni)
  const bulanLalu = bulanDari(new Date(hariIni.getFullYear(), hariIni.getMonth() - 1, 1))
  const rentangData = useMemo(() => {
    const t = dbAll.kasbonEntries.map((e) => e.entry_date).filter((d) => ISO.test(d)).sort()
    return { pertama: t[0] ?? '', terakhir: t.at(-1) ?? '' }
  }, [dbAll.kasbonEntries])
  const sejakAwal = {
    awal: rentangData.pertama && rentangData.pertama < bulanIni.awal ? rentangData.pertama : bulanIni.awal,
    akhir: rentangData.terakhir > bulanIni.akhir ? rentangData.terakhir : bulanIni.akhir,
  }
  const periodeText = `${formatDate(awal)} s/d ${formatDate(akhir)}`
  /** Periode, status, dan jenis berdraf (baru berlaku setelah Terapkan); yang berlaku disimpan di alamat halaman. */
  const filter = useFilter({ awal: bawaan.start, akhir: bawaan.end, status: 'semua' as Status, jenis: '' as JenisPiutang | '' }, {
    nilai: { awal, akhir, status, jenis: jenisFilter },
    terapkan: (v) => {
      setGalat(null)
      ubahUrl((p) => {
        if (v.awal === bawaan.start && v.akhir === bawaan.end) { p.delete('awal'); p.delete('akhir') } else { p.set('awal', v.awal); p.set('akhir', v.akhir) }
        if (v.status !== 'semua') p.set('status', v.status); else p.delete('status')
        if (v.jenis) p.set('jenis', v.jenis); else p.delete('jenis')
      })
    },
  })
  const d = filter.draf
  const periodeBawaan = awal === bawaan.start && akhir === bawaan.end
  const chips = [
    { label: `Periode ${rentangTanggal(awal, akhir)}`, lepas: periodeBawaan ? undefined : () => filter.lepas('awal', 'akhir') },
    status !== 'semua' && { label: STATUS_LABEL[status], lepas: () => filter.lepas('status') },
    jenisFilter && { label: jenisFilter === 'piutang' ? 'Piutang saja' : 'Lunas saja', lepas: () => filter.lepas('jenis') },
  ]

  /* ── Tambah / Ubah transaksi ── */
  const [form, setForm] = useState<FormTransaksi | null>(null)
  const [editing, setEditing] = useState<KasbonEntry | null>(null)
  const [galatForm, setGalatForm] = useState<Partial<Record<'karyawan' | 'jumlah' | 'tanggal', string>>>({})
  const [menghapus, setMenghapus] = useState<KasbonEntry | null>(null)
  const kosong = (karyawan = ''): FormTransaksi => ({ karyawan, jenis: 'piutang', jumlah: 0, tanggal: todayISO(), catatan: '', bukti: [] })

  // Dari halaman karyawan: ?karyawan=<id>&tambah=1 langsung membuka form untuk karyawan itu.
  const tambahDariUrl = params.get('tambah') === '1'
  const karyawanUrl = params.get('karyawan') ?? ''
  useEffect(() => {
    if (!tambahDariUrl || loading) return
    setEditing(null); setGalatForm({}); setForm(kosong(orangMap.has(karyawanUrl) ? karyawanUrl : ''))
    ubahUrl((p) => { p.delete('tambah'); p.delete('karyawan') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tambahDariUrl, loading])

  const opsiKaryawan = useMemo<Option[]>(() => dbAll.drivers
    .filter((d) => d.status === 'aktif' || d.id === form?.karyawan)
    .map((d) => {
      const s = sisiKaryawan(saldoKasbon(dbAll.kasbonEntries, d.id))
      return { value: d.id, label: `${d.driver_code} — ${d.driver_name}`, keywords: d.driver_name, meta: `${ROLE_LABEL[d.role ?? 'sopir']} · saldo ${teksPiutang(s)}` }
    }), [dbAll.drivers, dbAll.kasbonEntries, form?.karyawan])

  function bukaTambah() { setEditing(null); setGalatForm({}); setForm(kosong()) }
  function bukaUbah(e: KasbonEntry) {
    setEditing(e); setGalatForm({})
    setForm({ karyawan: e.employee_id, jenis: jenisPiutang(e), jumlah: Math.abs(e.amount), tanggal: e.entry_date, catatan: e.notes, bukti: e.attachments ?? [] })
  }

  /** Saldo karyawan terpilih (sisi karyawan) tanpa transaksi yang sedang diubah, dan sesudah disimpan. */
  const saldoSebelum = form?.karyawan ? sisiKaryawan(saldoKasbon(dbAll.kasbonEntries, form.karyawan)) - (editing ? sisiKaryawan(editing.amount) : 0) : 0
  const saldoSesudah = form ? saldoSebelum + (form.jenis === 'piutang' ? -form.jumlah : form.jumlah) : 0

  function simpan() {
    if (!form) return
    const g: typeof galatForm = {}
    if (!form.karyawan) g.karyawan = 'Pilih karyawan.'
    if (form.jumlah <= 0) g.jumlah = 'Jumlah harus lebih dari 0.'
    if (!form.tanggal) g.tanggal = 'Tanggal wajib diisi.'
    // Pelunasan tidak boleh melebihi piutang: saldo karyawan tidak boleh menjadi plus.
    if (!g.jumlah && form.jenis === 'lunas' && saldoSesudah > 0) {
      g.jumlah = saldoSebelum < 0 ? `Pelunasan melebihi sisa piutang (${formatRupiah(-saldoSebelum)}).` : 'Karyawan ini tidak punya piutang untuk dilunasi.'
    }
    setGalatForm(g)
    if (Object.keys(g).length) return
    const isi = {
      employee_id: form.karyawan, entry_date: form.tanggal,
      // Sumber: Piutang = kasbon, Lunas = pelunasan langsung. Jenis lama (penyesuaian) tetap jenisnya.
      kind: editing?.kind === 'manual' ? 'manual' as const : form.jenis === 'piutang' ? 'admin' as const : 'lunas' as const,
      amount: form.jenis === 'piutang' ? form.jumlah : -form.jumlah, notes: form.catatan.trim(), attachments: form.bukti,
    }
    const nama = orangMap.get(form.karyawan)?.driver_name ?? 'karyawan'
    if (editing) {
      update('kasbonEntries', editing.id, isi)
      toast.success('Transaksi berhasil diperbarui.')
    } else {
      create('kasbonEntries', { ...isi, trip_id: '', uj_payment_id: '' })
      toast.success(`${JENIS_PIUTANG_LABEL[form.jenis]} ${formatRupiah(form.jumlah)} untuk ${nama} tersimpan.`)
    }
    setForm(null)
  }

  function hapus() {
    if (!menghapus) return
    const s = sisiKaryawan(saldoKasbon(dbAll.kasbonEntries, menghapus.employee_id)) - sisiKaryawan(menghapus.amount)
    if (s > 0) {
      toast.error(`Tidak bisa dihapus: piutang ini sudah dilunasi, saldo karyawan akan menjadi lebih bayar ${formatRupiah(s)}.`)
      setMenghapus(null)
      return
    }
    remove('kasbonEntries', menghapus.id)
    void hapusLampiran(menghapus.attachments ?? [])
    toast.success('Transaksi berhasil dihapus.')
    setMenghapus(null)
  }

  function cekSiap(): boolean {
    if (periodeSalah) { setGalat('Tanggal awal tidak boleh lebih besar dari tanggal akhir.'); return false }
    if (rows.length === 0) { setGalat('Tidak ada karyawan yang cocok dengan periode dan filter ini.'); toast.info('Tidak ada data untuk ditampilkan.'); return false }
    setGalat(null)
    return true
  }

  function exportCsv() {
    if (!cekSiap()) return
    const kolom = ['No.', 'Kode', 'Nama', 'Peran', 'Saldo Awal', 'Piutang', 'Lunas', 'Saldo Akhir', 'Keterangan']
    const sel = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const baris = rows.map((r, i) => [
      i + 1, r.kode, r.nama, r.peran, r.awal, r.piutang, r.lunas, r.akhir,
      [!r.terdaftar ? 'Karyawan sudah dihapus' : '', r.nonaktif ? 'Nonaktif' : '', r.lebihBayar ? `Pernah lebih bayar sejak ${formatDate(r.lebihBayar)}` : ''].filter(Boolean).join('; '),
    ].map(sel).join(';'))
    const jumlah = ['', '', `Total ${rows.length} karyawan`, '', total.awal, total.piutang, total.lunas, total.akhir, ''].map(sel).join(';')
    // BOM supaya Excel membaca huruf dengan benar; pemisah titik koma untuk Excel berbahasa Indonesia.
    downloadFile(`piutang-karyawan-${awal}-sd-${akhir}.csv`, '﻿' + [kolom.map(sel).join(';'), ...baris, jumlah].join('\r\n'), 'text/csv;charset=utf-8')
    toast.success(`${rows.length} karyawan diexport (${periodeText}).`)
  }

  if (preview) return <CetakPiutang rows={rows} total={total} periodeText={periodeText} akhir={akhir} status={status} onClose={() => setPreview(false)} />

  const kolomKaryawan: Column<BarisPiutang>[] = [
    { key: 'kode', header: 'Kode', sortable: true, width: '96px', render: (r) => <span className="tnum font-semibold text-ink">{r.kode}</span> },
    {
      key: 'nama', header: 'Nama', sortable: true,
      render: (r) => (
        <div className="leading-tight">
          {r.terdaftar
            ? <Link to={`/master/karyawan/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-700 hover:underline">{r.nama}</Link>
            : <span className="font-medium text-ink-3">{r.nama}</span>}
          {(r.nonaktif || r.lebihBayar) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {r.nonaktif && <Badge tone="neutral">Nonaktif</Badge>}
              {r.lebihBayar && (
                <span title={`Saldo sempat plus (lebih bayar) sejak ${formatDate(r.lebihBayar)} menurut urutan tanggal. Biasanya tanggal pelunasan lebih awal dari kasbonnya.`}>
                  <Badge tone="warning" icon={<FaTriangleExclamation size={11} />}>Cek tanggal</Badge>
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    { key: 'peran', header: 'Peran', sortable: true, width: '96px', render: (r) => <span className="text-ink-2">{r.peran}</span> },
    { key: 'awal', header: 'Saldo Awal', sortable: true, align: 'right', width: '130px', render: (r) => <NilaiPiutang nilai={r.awal} /> },
    { key: 'piutang', header: 'Piutang', sortable: true, align: 'right', width: '130px', render: (r) => (r.piutang ? <NilaiPiutang nilai={r.piutang} /> : <span className="text-ink-3">—</span>) },
    { key: 'lunas', header: 'Lunas', sortable: true, align: 'right', width: '130px', render: (r) => (r.lunas ? <NilaiPiutang nilai={r.lunas} /> : <span className="text-ink-3">—</span>) },
    { key: 'akhir', header: 'Saldo Akhir', sortable: true, align: 'right', width: '140px', render: (r) => <NilaiPiutang nilai={r.akhir} tebal /> },
  ]

  const bisaUbahMutasi = (e: KasbonEntry) => canEdit && !e.uj_payment_id && !e.trip_id
  const kolomMutasi: Column<BarisMutasi>[] = [
    { key: 'entry_date', header: 'Tanggal', sortable: true, width: '100px', render: (e) => <span className="tnum text-ink-2">{formatDate(e.entry_date)}</span> },
    {
      key: 'nama', header: 'Karyawan', sortable: true,
      render: (e) => (
        <span className="block leading-tight">
          <Link to={`/master/karyawan/${e.employee_id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">{e.nama}</Link>
          <span className="tnum block text-[11.5px] text-ink-3">{e.kode}</span>
        </span>
      ),
    },
    { key: 'jenis', header: 'Jenis', sortable: true, width: '96px', render: (e) => <Badge tone={e.jenis === 'piutang' ? 'critical' : 'good'}>{JENIS_PIUTANG_LABEL[e.jenis]}</Badge> },
    {
      key: 'notes', header: 'Keterangan',
      render: (e) => {
        const t = e.trip_id ? tripMap.get(e.trip_id) : undefined
        return (
          <span className="block max-w-[360px] leading-snug">
            <span className="text-ink-2">{KASBON_LABEL[e.kind] ?? e.kind}</span>
            {t && <> · <Link to={`/transaksi/trip/${t.id}${e.kind === 'trip' ? '?tab=uj' : ''}`} className="tnum font-medium text-brand-700 hover:underline">Trip {t.transaction_no}</Link></>}
            {e.notes && <span className="block text-[12px] text-ink-3">{e.notes}</span>}
          </span>
        )
      },
    },
    { key: 'piutang', header: 'Piutang', align: 'right', width: '128px', render: (e) => (e.nilai < 0 ? <NilaiPiutang nilai={e.nilai} /> : '') },
    { key: 'lunas', header: 'Lunas', align: 'right', width: '128px', render: (e) => (e.nilai > 0 ? <NilaiPiutang nilai={e.nilai} /> : '') },
    { key: 'attachments', header: 'Bukti', width: '96px', render: (e) => <LampiranThumbs ids={e.attachments ?? []} ukuran={28} /> },
    {
      key: 'action', header: 'Action', align: 'right', width: '96px',
      render: (e) => (e.trip_id ? (
        <IconButton label={e.kind === 'trip' ? 'Otomatis dari termin uang jalan trip' : 'Otomatis dari pembatalan trip'} icon={<FaLink size={13} />}
          onClick={() => navigate(`/transaksi/trip/${e.trip_id}${e.kind === 'trip' ? '?tab=uj' : ''}`)} />
      ) : (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!bisaUbahMutasi(e)} onClick={() => bukaUbah(e)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!bisaUbahMutasi(e)} onClick={() => setMenghapus(e)} />
        </div>
      )),
    },
  ]

  const angka = (label: string, nilai: ReactNode, ket: string) => (
    <div className="shadow-card min-w-0 rounded-xl border border-hairline bg-surface p-3.5 sm:p-4">
      <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
      <p className="mt-1.5 text-[16px] leading-tight font-semibold tracking-tight sm:text-[19px]">{nilai}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{ket}</p>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Piutang Karyawan"
        crumbs={[{ label: 'Laporan' }, { label: 'Piutang Karyawan' }]}
        description="Piutang (kasbon) karyawan ke perusahaan. Piutang tercatat minus, pelunasan plus; potongan uang jalan dari trip tercatat otomatis sebagai Lunas."
        actions={
          <>
            <Button icon={<FaPrint size={15} />} onClick={() => cekSiap() && setPreview(true)}>Cetak</Button>
            <Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={bukaTambah}>Tambah Transaksi</Button>
          </>
        }
      />
      {galat && <div className="no-print mb-3"><FieldError>{galat}</FieldError></div>}

      {loading ? (
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[92px] rounded-xl" />)}</div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {angka('Saldo Piutang', <NilaiPiutang nilai={ringkas.saldo} />, `sisa piutang seluruh karyawan per ${formatDate(akhir)}`)}
          {angka('Karyawan Berpiutang', <span className="text-ink">{formatNumber(ringkas.berpiutang)}</span>, `dari ${formatNumber(semua.length)} karyawan ber-transaksi di periode ini`)}
          {angka('Piutang Periode', <NilaiPiutang nilai={ringkas.piutang} />, 'kasbon & pembatalan trip')}
          {angka('Pelunasan Periode', <NilaiPiutang nilai={ringkas.lunas} />, 'potong uang jalan & dibayar langsung')}
        </div>
      )}

      {!loading && ringkas.lebihBayar > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#8a6100]" role="note">
          <FaTriangleExclamation size={15} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Temuan data: </span>
            {formatNumber(ringkas.lebihBayar)} karyawan saldonya sempat plus (lebih bayar) menurut urutan tanggal (tanda “Cek tanggal”).
            Biasanya potongan uang jalan atau pelunasan tercatat dengan tanggal lebih awal dari kasbonnya.
          </p>
        </div>
      )}

      <Card>
        <Tabs
          items={[{ id: 'karyawan', label: 'Per Karyawan', badge: semua.length }, { id: 'transaksi', label: 'Transaksi', badge: mutasi.length }]}
          value={tab} onChange={(t) => aturParam('tab', t === 'transaksi' ? 'transaksi' : '')} className="px-2"
        />
        <Toolbar
          left={
            <>
              {tab === 'karyawan'
                ? <SearchInput value={table.query} onChange={table.setQuery} width="w-64" placeholder="Cari kode atau nama karyawan..." />
                : <SearchInput value={tabelMutasi.query} onChange={tabelMutasi.setQuery} width="w-64" placeholder="Cari karyawan, keterangan, trip..." />}
              <PanelFilter filter={filter} chips={chips} galat={galatRentang(d.awal, d.akhir)} lebar={360}>
                <div>
                  <p className="form-label">Periode</p>
                  <div className="grid grid-cols-2 gap-2">
                    <DateInput aria-label="Tanggal awal" value={d.awal} onChange={(e) => e.target.value && filter.ubah({ awal: e.target.value })} />
                    <DateInput aria-label="Tanggal akhir" value={d.akhir} onChange={(e) => e.target.value && filter.ubah({ akhir: e.target.value })} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => filter.ubah({ awal: bulanIni.awal, akhir: bulanIni.akhir })}>Bulan ini</Button>
                    <Button size="sm" variant="ghost" onClick={() => filter.ubah({ awal: bulanLalu.awal, akhir: bulanLalu.akhir })}>Bulan lalu</Button>
                    <Button size="sm" variant="ghost" onClick={() => filter.ubah({ awal: sejakAwal.awal, akhir: sejakAwal.akhir })}>Semua waktu</Button>
                  </div>
                </div>
                <Field label="Status (tab Per Karyawan)">
                  {(id) => (
                    <Select id={id} value={d.status} onChange={(e) => filter.ubah({ status: e.target.value as Status })}>
                      {(['semua', 'ada', 'tidak'] as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Jenis (tab Transaksi)">
                  {(id) => (
                    <Select id={id} value={d.jenis} onChange={(e) => filter.ubah({ jenis: e.target.value as JenisPiutang | '' })}>
                      <option value="">Piutang & Lunas</option>
                      <option value="piutang">Piutang saja</option>
                      <option value="lunas">Lunas saja</option>
                    </Select>
                  )}
                </Field>
              </PanelFilter>
            </>
          }
          right={tab === 'karyawan' ? (
            <Button size="sm" icon={<FaFileExport size={14} />} disabled={rows.length === 0} onClick={exportCsv}>Export CSV</Button>
          ) : undefined}
        />

        {tab === 'karyawan' ? (
          <>
            <DataTable
              columns={kolomKaryawan}
              rows={table.pageRows}
              rowKey={(r) => r.id}
              loading={loading}
              error={error}
              onRetry={reload}
              isFiltered={table.isFiltered}
              sort={table.sort}
              onSortChange={table.toggleSort}
              onRowClick={(r) => { if (r.terdaftar) navigate(`/master/karyawan/${r.id}`) }}
              footer={(
                <tr className="text-[13px]">
                  <td colSpan={3} className="px-3 py-2.5 text-ink-2">Total · {formatNumber(rows.length)} karyawan{rows.length > table.pageSize ? ' (semua halaman)' : ''}</td>
                  <td className="px-3 py-2.5 text-right"><NilaiPiutang nilai={total.awal} /></td>
                  <td className="px-3 py-2.5 text-right"><NilaiPiutang nilai={total.piutang} /></td>
                  <td className="px-3 py-2.5 text-right"><NilaiPiutang nilai={total.lunas} /></td>
                  <td className="px-3 py-2.5 text-right"><NilaiPiutang nilai={total.akhir} tebal /></td>
                </tr>
              )}
              empty={<p className="px-6 py-14 text-center text-[13px] text-ink-3">Belum ada piutang karyawan pada {periodeText}.</p>}
              notFound={<NotFoundState onReset={() => { table.reset(); filter.lepas('status') }} />}
            />
            {table.total > 0 && <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />}
            <p className="border-t border-hairline px-4 py-2.5 text-[12px] leading-relaxed text-ink-3">
              Saldo Akhir = Saldo Awal + Piutang + Lunas (piutang bertanda minus, pelunasan plus). Saldo minus = karyawan masih punya piutang.
              Klik baris untuk membuka transaksi karyawannya.
            </p>
          </>
        ) : (
          <>
            <DataTable
              columns={kolomMutasi}
              rows={tabelMutasi.pageRows}
              rowKey={(e) => e.id}
              loading={loading}
              error={error}
              onRetry={reload}
              isFiltered={tabelMutasi.isFiltered}
              sort={tabelMutasi.sort}
              onSortChange={tabelMutasi.toggleSort}
              footer={tabelMutasi.total > 0 ? (
                <tr className="text-[13px]">
                  <td colSpan={4} className="px-3 py-2.5 text-ink-2">Total {formatNumber(tabelMutasi.total)} transaksi</td>
                  <td className="px-3 py-2.5 text-right"><NilaiPiutang nilai={sum(tabelMutasi.filtered.filter((e) => e.nilai < 0), (e) => e.nilai)} /></td>
                  <td className="px-3 py-2.5 text-right"><NilaiPiutang nilai={sum(tabelMutasi.filtered.filter((e) => e.nilai > 0), (e) => e.nilai)} /></td>
                  <td colSpan={2} />
                </tr>
              ) : undefined}
              empty={<p className="px-6 py-14 text-center text-[13px] text-ink-3">Belum ada transaksi pada {periodeText}.</p>}
              notFound={<NotFoundState onReset={() => { tabelMutasi.reset(); filter.lepas('jenis') }} />}
            />
            {tabelMutasi.total > 0 && <Pagination page={tabelMutasi.page} pageSize={tabelMutasi.pageSize} total={tabelMutasi.total} onPageChange={tabelMutasi.setPage} onPageSizeChange={tabelMutasi.setPageSize} />}
          </>
        )}
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={editing ? 'Ubah Transaksi' : 'Tambah Transaksi'}
        subtitle="Piutang menambah utang karyawan (minus). Lunas mencatat pelunasan (plus)."
        size="md"
        footer={
          <>
            <Button onClick={() => setForm(null)}>Batal</Button>
            <Button variant="primary" onClick={simpan}>Simpan</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <Field label="Karyawan" required error={galatForm.karyawan}>
              {(fid) => (
                <SearchableSelect id={fid} options={opsiKaryawan} value={form.karyawan || null} invalid={!!galatForm.karyawan} disabled={!!editing}
                  placeholder="Pilih karyawan..." searchPlaceholder="Ketik kode atau nama..." onChange={(v) => { setForm({ ...form, karyawan: v ?? '' }); setGalatForm((g) => ({ ...g, karyawan: undefined })) }} />
              )}
            </Field>
            <Field label="Jenis" required>
              {() => (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Radio name="jenis-piutang" checked={form.jenis === 'piutang'} onChange={() => setForm({ ...form, jenis: 'piutang' })} label="Piutang"
                    description="Karyawan menambah utang, mis. kasbon. Tercatat minus." />
                  <Radio name="jenis-piutang" checked={form.jenis === 'lunas'} onChange={() => setForm({ ...form, jenis: 'lunas' })} label="Lunas"
                    description="Karyawan membayar / mencicil piutangnya. Tercatat plus." />
                </div>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jumlah" required error={galatForm.jumlah}>
                {(fid) => <CurrencyInput id={fid} value={form.jumlah} invalid={!!galatForm.jumlah} onValueChange={(v) => { setForm({ ...form, jumlah: v }); setGalatForm((g) => ({ ...g, jumlah: undefined })) }} />}
              </Field>
              <Field label="Tanggal" required error={galatForm.tanggal}>
                {(fid) => <DateInput id={fid} value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />}
              </Field>
            </div>
            <Field label="Catatan" hint="mis. kasbon keperluan keluarga, cicilan ke-2, dibayar tunai di kantor.">
              {(fid) => <Input id={fid} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />}
            </Field>
            <Field label="Bukti" hint="Foto kuitansi, bukti transfer, dan sejenisnya.">
              {(fid) => <LampiranInput id={fid} value={form.bukti} onChange={(v) => setForm((f) => (f ? { ...f, bukti: v } : f))} />}
            </Field>
            {form.karyawan && (
              <div className="rounded-lg border border-hairline bg-sunken px-3.5 py-3 text-[12.5px]">
                <p className="flex items-center justify-between gap-3 text-ink-2"><span>Saldo sekarang</span><NilaiPiutang nilai={saldoSebelum} /></p>
                <p className={cn('mt-1 flex items-center justify-between gap-3 font-semibold text-ink')}><span>Setelah transaksi</span><NilaiPiutang nilai={saldoSesudah} tebal /></p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus transaksi?"
        message={`${menghapus ? JENIS_PIUTANG_LABEL[jenisPiutang(menghapus)] : ''} senilai ${formatRupiah(Math.abs(menghapus?.amount ?? 0))} akan dihapus dan saldo karyawan ikut menyesuaikan.`}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </>
  )
}

/** Preview cetak: rekap per karyawan yang sedang tampil. */
function CetakPiutang({ rows, total, periodeText, akhir, status, onClose }: {
  rows: BarisPiutang[]
  total: { awal: number; piutang: number; lunas: number; akhir: number }
  periodeText: string
  akhir: string
  status: Status
  onClose: () => void
}) {
  const angka = (n: number) => (n ? teksPiutang(n).replace('Rp ', '') : '-')
  return (
    <ReportPreview onClose={onClose} onPrint={() => window.print()} orientasiAwal="potret">
      {(orientasi) => {
        const per = barisPerLembar(orientasi, 28)
        const pages = chunkRows(rows, per)
        return (
          <PrintDocument>
            {pages.map((isi, i) => (
              <PrintPage key={i} page={i + 1} totalPages={pages.length} title="Rekap Piutang Karyawan" subtitle="Piutang minus, pelunasan plus; saldo minus = masih punya piutang" periode={periodeText}
                meta={[
                  { label: 'Jumlah karyawan', value: formatNumber(rows.length) },
                  { label: `Saldo piutang per ${formatDate(akhir)}`, value: teksPiutang(sum(rows.filter((r) => r.akhir < 0), (r) => r.akhir)) },
                  { label: 'Ditampilkan', value: STATUS_LABEL[status] },
                ]}>
                <PrintTable cols={[
                  { label: 'No.', align: 'right', width: '5%' }, { label: 'Kode', width: '9%' }, { label: 'Nama' }, { label: 'Peran', width: '9%' },
                  { label: 'Saldo Awal', align: 'right', width: '12%' }, { label: 'Piutang', align: 'right', width: '12%' },
                  { label: 'Lunas', align: 'right', width: '12%' }, { label: 'Saldo Akhir', align: 'right', width: '12%' },
                ]}>
                  {isi.map((r, ri) => (
                    <PRow key={r.id}>
                      <PCell align="right">{i * per + ri + 1}</PCell>
                      <PCell>{r.kode}</PCell>
                      <PCell>{r.nama}</PCell>
                      <PCell>{r.peran}</PCell>
                      <PCell align="right">{angka(r.awal)}</PCell>
                      <PCell align="right">{angka(r.piutang)}</PCell>
                      <PCell align="right">{angka(r.lunas)}</PCell>
                      <PCell align="right" bold>{angka(r.akhir)}</PCell>
                    </PRow>
                  ))}
                  {i === pages.length - 1 && (
                    <PRow tone="total">
                      <PCell align="right" colSpan={4}>TOTAL</PCell>
                      <PCell align="right">{angka(total.awal)}</PCell>
                      <PCell align="right">{angka(total.piutang)}</PCell>
                      <PCell align="right">{angka(total.lunas)}</PCell>
                      <PCell align="right">{angka(total.akhir)}</PCell>
                    </PRow>
                  )}
                </PrintTable>
                {i === pages.length - 1 && (
                  <p className="mt-2 text-[9.5px] text-neutral-600">Saldo Akhir = Saldo Awal + Piutang + Lunas. Angka dalam Rupiah.</p>
                )}
              </PrintPage>
            ))}
          </PrintDocument>
        )
      }}
    </ReportPreview>
  )
}
