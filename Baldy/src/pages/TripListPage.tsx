import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FaBan, FaCheckDouble, FaClipboardCheck, FaFlagCheckered, FaPen, FaPlus, FaPrint, FaRoute, FaTrashCan, FaWarehouse,
} from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, DetailButton, IconButton } from '../components/ui/Button'
import { OverflowMenu } from '../components/ui/Menu'
import type { MenuAction } from '../components/ui/Menu'
import { Checkbox, DateInput, Field, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { SuratJalanPrintFlow } from '../components/report/SuratJalanPrintFlow'
import { KonfirmasiBatalTrip, KonfirmasiHapusTrip } from './trip/KonfirmasiTrip'
import { KonfirmasiTutupTrip } from './trip/TutupTrip'
import { ModalRekapTrip } from './trip/RekapTrip'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import { endOfMonthISO, formatDate, formatRupiah, galatRentang, rentangTanggal, startOfMonthISO, todayISO } from '../lib/format'
import { useFilter } from '../lib/useFilter'
import { kunciTr } from '../lib/trip'
import { CLIENT_TYPE_LABEL, SERVICE_TYPES } from '../types'
import type { TransactionRow } from '../types'
import { STATUS_LABEL, STATUS_TONE, bisaDitutup, pilihanStatus } from './trip/status'

/**
 * Teks pencarian No. Referensi: dokumen SLB menulis "TR2600512595", rekap menulis
 * "2600512595". Keduanya dimasukkan supaya pencarian dengan cara tulis mana pun ketemu.
 */
const cariTr = (list: string[]) => list.flatMap((tr) => [tr, kunciTr(tr), `TR${kunciTr(tr)}`]).join(' ')

/** Trip selesai yang mobilnya belum tercatat kembali di pool (masih menahan kendaraan). */
const belumDiPool = (t: TransactionRow) => t.status === 'selesai' && t.menahan_kendaraan

/** Filter daftar trip; `pool` dari alamat halaman (?pool=belum, tautan Dashboard). */
interface FilterTrip {
  dari: string
  sampai: string
  status: string
  cetak: string
  supir: string
  klien: string
  layanan: string
  pool: boolean
}
const FILTER_KOSONG: FilterTrip = { dari: '', sampai: '', status: '', cetak: '', supir: '', klien: '', layanan: '', pool: false }

/** Bulan lalu: [awal, akhir] dalam yyyy-mm-dd. */
function bulanLalu(): [string, string] {
  const d = new Date()
  const awal = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return [startOfMonthISO(awal), endOfMonthISO(awal)]
}

/**
 * Trip / Job Order. Kolom mengikuti mock atasan 13 Okt 2026: Berangkat · ID Trip · No Referensi ·
 * Supir · No. Kendaraan · Rute · No PI · Uang Jalan · Status · Action. ID Trip = Kode Trip
 * (2026100001). Seluruh filter ada di satu tombol Filter. Menu ⋯: Cetak Berita Acara, Rekap Trip,
 * Tutup Trip, Ada Backload / Lanjutan (satu-satunya pintu backload), Batalkan, Hapus.
 */
export function TripListPage() {
  const { db, transactionRows, loading, error, reload, update, tutupTrip, tandaiDiPool } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const karawang = workspace === 'karawang'
  /** Dokumen cetak Karawang = Berita Acara Serah Terima; Priok = Surat Jalan. */
  const namaDokumen = karawang ? 'Berita Acara' : 'Surat Jalan'
  /**
   * Dari URL: kata kunci kotak pencarian di baris atas (?q=), trip yang baru disimpan
   * untuk dicetak (?cetak=), dan saringan "mobil belum di pool" dari Dashboard (?pool=belum).
   */
  const [params, setParams] = useSearchParams()
  const cariDariAtas = params.get('q') ?? ''
  const hanyaBelumPool = karawang && params.get('pool') === 'belum'
  const [menutup, setMenutup] = useState<TransactionRow | null>(null)
  const [rekap, setRekap] = useState<TransactionRow | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  /** Filter yang berlaku (selain pool, yang dibaca dari alamat halaman). */
  const [berlaku, setBerlaku] = useState<Omit<FilterTrip, 'pool'>>(FILTER_KOSONG)
  const filter = useFilter<FilterTrip>(FILTER_KOSONG, {
    nilai: { ...berlaku, pool: hanyaBelumPool },
    terapkan: ({ pool, ...sisa }) => { setBerlaku(sisa); if (karawang && pool !== hanyaBelumPool) aturParam('pool', pool ? 'belum' : null) },
  })
  const f = filter.nilai
  const d = filter.draf
  const [tandaiSelesai, setTandaiSelesai] = useState(false)
  /** Tutup massal Karawang: mobil-mobilnya sudah kembali ke pool? Bawaan ya. */
  const [massalDiPool, setMassalDiPool] = useState(true)
  const [printing, setPrinting] = useState<TransactionRow[] | null>(null)
  const [membatalkan, setMembatalkan] = useState<TransactionRow | null>(null)
  const [menghapus, setMenghapus] = useState<TransactionRow | null>(null)

  /** Seluruh supir yang pernah tercatat di trip, termasuk supir pendamping. */
  const daftarSupir = useMemo(() => {
    const nama = new Map(db.drivers.map((d) => [d.id, d.driver_name]))
    const m = new Map<string, string>()
    for (const t of transactionRows) {
      for (const id of t.driver_ids) if (nama.has(id)) m.set(id, nama.get(id)!)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [transactionRows, db.drivers])

  /** Draft tidak dipakai Karawang: pilihannya hanya muncul bila masih ada trip draft lama. */
  const opsiStatus = pilihanStatus(karawang, transactionRows.some((t) => t.status === 'draft'))

  const search = useCallback(
    (t: TransactionRow, q: string) =>
      matchesQuery(q, t.transaction_no, t.id_perjalanan, t.sj_no, t.sijo, t.recipient_name, t.driver_code, t.driver_names,
        t.plate_number, t.plate_number.replace(/\s+/g, ''), t.route_code, t.route_name, t.destination_detail, (t.trip_ids ?? []).join(' '),
        cariTr(t.tr_list), t.pi_number, t.contract_no, t.client_name, t.project_code, t.project_name, t.muat, t.bongkar, t.area_asal, t.area_tujuan,
        t.pengirim?.nama, t.penerima?.nama, (t.muatan ?? []).map((m) => m.keterangan).join(' ')),
    [],
  )
  const extraFilter = useCallback(
    (t: TransactionRow) =>
      (!f.dari || t.transaction_date >= f.dari) &&
      (!f.sampai || t.transaction_date <= f.sampai) &&
      (!f.status || t.status === f.status) &&
      (!f.cetak || (f.cetak === 'tercetak' ? !!t.printed_at : !t.printed_at)) &&
      (!f.supir || (t.driver_ids ?? []).includes(f.supir)) &&
      (!f.klien || t.project_id === f.klien) &&
      (!f.layanan || (t.service_type ?? 'callout') === f.layanan) &&
      (!f.pool || belumDiPool(t)),
    [f.dari, f.sampai, f.status, f.cetak, f.supir, f.klien, f.layanan, f.pool],
  )
  const jumlahFilter = [f.dari || f.sampai, f.status, f.cetak, f.supir, f.klien, f.layanan, f.pool].filter(Boolean).length
  const table = useTable(transactionRows, {
    search, extraFilter, extraFilterActive: jumlahFilter > 0,
    initialSortKey: 'transaction_date', initialSortDir: 'desc', tieBreakKey: 'transaction_no', pageSize: 10,
  })
  const { setQuery } = table
  useEffect(() => {
    if (cariDariAtas) setQuery(cariDariAtas)
  }, [cariDariAtas, setQuery])

  // Datang dari "Simpan & Cetak": buka cetak untuk seluruh trip barunya.
  const cetakBaru = params.get('cetak')
  useEffect(() => {
    if (!cetakBaru || loading) return
    const ids = new Set(cetakBaru.split(','))
    const rows = transactionRows.filter((t) => ids.has(t.id))
    if (rows.length) setPrinting(rows)
    const p = new URLSearchParams(params)
    p.delete('cetak')
    setParams(p, { replace: true })
  }, [cetakBaru, loading, transactionRows, params, setParams])

  const selectedRows = useMemo(() => transactionRows.filter((t) => selected.has(t.id)), [transactionRows, selected])

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const ids = table.pageRows.map((t) => t.id)
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }

  /** Pasang / lepas saringan dari URL (?q= dan ?pool=). */
  function aturParam(kunci: string, nilai: string | null) {
    const p = new URLSearchParams(params)
    if (nilai === null) p.delete(kunci)
    else p.set(kunci, nilai)
    setParams(p, { replace: true })
  }

  function resetFilters() {
    table.reset()
    filter.lepasSemua()
    if (params.has('q')) aturParam('q', null)
  }
  const namaSupir = new Map(daftarSupir)
  const chips = [
    (f.dari || f.sampai) && { label: `Berangkat ${rentangTanggal(f.dari, f.sampai)}`, lepas: () => filter.lepas('dari', 'sampai') },
    f.status && { label: `Status: ${STATUS_LABEL[f.status as keyof typeof STATUS_LABEL] ?? f.status}`, lepas: () => filter.lepas('status') },
    f.cetak && { label: f.cetak === 'tercetak' ? `${karawang ? 'Berita Acara' : 'Surat Jalan'} sudah dicetak` : `${karawang ? 'Berita Acara' : 'Surat Jalan'} belum dicetak`, lepas: () => filter.lepas('cetak') },
    f.supir && { label: `Supir: ${namaSupir.get(f.supir) ?? '—'}`, lepas: () => filter.lepas('supir') },
    f.klien && { label: `Klien: ${db.projects.find((p) => p.id === f.klien)?.project_code ?? '—'}`, lepas: () => filter.lepas('klien') },
    f.layanan && { label: `Layanan: ${CLIENT_TYPE_LABEL[f.layanan as keyof typeof CLIENT_TYPE_LABEL] ?? f.layanan}`, lepas: () => filter.lepas('layanan') },
    f.pool && { label: 'Mobil belum di pool', lepas: () => filter.lepas('pool') },
  ]

  /** Trip yang dibatalkan atau sudah selesai tidak ikut ditutup / ditandai selesai. */
  const bisaSelesai = selectedRows.filter((t) => t.status !== 'batal' && t.status !== 'selesai')

  function bukaTutupMassal() {
    setMassalDiPool(true)
    setTandaiSelesai(true)
  }

  function doSelesai() {
    if (karawang) {
      // Ditutup dengan dokumen fisik diterima. Pool hanya dicatat untuk trip yang memang masih menahan kendaraannya.
      bisaSelesai.forEach((t) => tutupTrip(t.id, {
        podFisik: true, podFoto: t.pod_attachments ?? [], diPool: massalDiPool && t.menahan_kendaraan,
      }))
      toast.success(`${bisaSelesai.length} trip ditutup${massalDiPool ? '.' : '. Mobilnya belum tercatat di pool: tandai dari menu ⋯ tiap trip setelah kembali.'}`)
    } else {
      bisaSelesai.forEach((t) => update('transactions', t.id, { status: 'selesai' }))
      toast.success(`${bisaSelesai.length} trip ditandai Selesai.`)
    }
    setSelected(new Set()); setTandaiSelesai(false)
  }

  function tandaiPool(t: TransactionRow) {
    tandaiDiPool(t.id)
    toast.success(`Mobil ${t.plate_number || `Trip ${t.id_tampil}`} tercatat kembali di pool dan bisa dipakai trip lain.`)
  }

  function markPrinted(ids: string[]) {
    ids.forEach((id) => update('transactions', id, { printed_at: todayISO() }))
  }

  /** Menu ⋯ tiap baris (mock atasan): Cetak BA, Rekap Trip, Tutup Trip, Ada Backload / Lanjutan, Batalkan, Hapus. */
  function aksiBaris(t: TransactionRow): MenuAction[] {
    const batal = t.status === 'batal'
    return [
      { label: `Cetak ${namaDokumen}`, icon: <FaPrint size={14} />, onSelect: () => setPrinting([t]) },
      ...(karawang ? [{ label: 'Rekap Trip', icon: <FaClipboardCheck size={14} />, onSelect: () => setRekap(t) }] : []),
      ...(karawang && bisaDitutup(t.status) ? [{
        label: 'Tutup Trip', icon: <FaFlagCheckered size={14} />, disabled: !bisa('trip'), onSelect: () => setMenutup(t),
      }] : []),
      ...(karawang ? [{
        label: 'Ada Backload / Lanjutan', icon: <FaRoute size={14} />,
        disabled: !bisa('trip') || batal || !t.vehicle_id, onSelect: () => navigate(`/transaksi/trip/tambah?backload=${t.id}`),
      }] : []),
      ...(karawang && belumDiPool(t) ? [{
        label: 'Tandai mobil di pool', icon: <FaWarehouse size={14} />, disabled: !bisa('trip'), onSelect: () => tandaiPool(t),
      }] : []),
      // Trip yang sudah ditagih (punya PI) tidak dibatalkan: PI-nya akan tertinggal tanpa trip yang berlaku.
      {
        label: 'Batalkan Trip', icon: <FaBan size={14} />, tone: 'danger', disabled: !bisa('batal') || batal || !!t.pi_number,
        alasan: t.pi_number && !batal ? `Sudah ditagih lewat PI ${t.pi_number}` : undefined, onSelect: () => setMembatalkan(t),
      },
      { label: 'Hapus Trip', icon: <FaTrashCan size={14} />, tone: 'danger', disabled: !bisa('hapus'), onSelect: () => setMenghapus(t) },
    ]
  }

  const kolom: Column<TransactionRow>[] = [
    { key: 'transaction_date', header: 'Berangkat', sortable: true, width: '96px', render: (t) => <span className="tnum text-ink-2">{formatDate(t.transaction_date)}</span> },
    {
      key: 'transaction_no', header: 'ID Trip', sortable: true, width: '124px',
      render: (t) => (
        <div className="leading-tight">
          <Link to={`/transaksi/trip/${t.id}`} className="tnum font-semibold whitespace-nowrap text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
            {t.transaction_no}
          </Link>
          {t.service_type === 'dedicated' && <Badge tone="brand" className="mt-1">Dedicated{t.contract_no ? ` · ${t.contract_no}` : ''}</Badge>}
          {!karawang && t.sj_no && <div className="tnum text-xs text-ink-3" title="Nomor Surat Jalan">{t.sj_no}</div>}
        </div>
      ),
    },
    karawang ? {
      // No. Referensi = nomor order klien (TR/OR DHL & SLB), dengan kode klien di bawahnya.
      key: 'tr_list', header: 'No Referensi', sortable: true, width: '140px',
      render: (t) => (
        <div className="leading-tight" title={t.tr_list.join(', ')}>
          <div className="tnum flex items-center gap-1.5 text-ink-2">
            {t.tr_list[0] ?? '—'}
            {t.tr_list.length > 1 && <Badge tone="neutral">+{t.tr_list.length - 1}</Badge>}
          </div>
          {t.project_code && <div className="text-xs text-ink-3">{t.project_code}</div>}
        </div>
      ),
    } : {
      key: 'trip_ids', header: 'ID Perjalanan/Trip', width: '160px',
      render: (t) => {
        const ids = t.trip_ids ?? []
        if (ids.length === 0) return <span className="text-ink-3">—</span>
        return (
          <span className="tnum inline-flex items-center gap-1.5 text-ink-2" title={ids.join(', ')}>
            {ids[0]}
            {ids.length > 1 && <Badge tone="neutral">+{ids.length - 1}</Badge>}
          </span>
        )
      },
    },
    { key: 'driver_names', header: 'Supir', sortable: true, render: (t) => <span className="font-medium">{t.driver_names || '—'}</span> },
    { key: 'plate_number', header: 'No. Kendaraan', sortable: true, width: '118px', render: (t) => <span className="tnum text-ink-2">{t.plate_number || '—'}</span> },
    {
      // Mock: No. Rute di atas, nama rute di bawah.
      key: 'route_code', header: 'Rute', sortable: true, width: '176px',
      render: (t) => (t.route_code || t.route_name ? (
        <div className="leading-tight">
          <div className="tnum font-medium">{t.route_code || '—'}</div>
          {t.route_name && <div className="text-xs text-ink-3">{t.route_name}</div>}
        </div>
      ) : <span className="text-ink-3">—</span>),
    },
    karawang ? {
      key: 'pi_number', header: 'No PI', sortable: true, width: '92px',
      render: (t) => (t.pi_number ? <span className="tnum text-ink-2">{t.pi_number}</span> : <span className="text-ink-3">—</span>),
    } : {
      key: 'sijo', header: 'S / JO', sortable: true, width: '96px',
      render: (t) => (t.sijo
        ? <Link to={`/pencarian/sijo?sijo=${t.sijo}`} className="tnum text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{t.sijo}</Link>
        : <span className="text-ink-3">—</span>),
    },
    {
      key: 'uj_total', header: 'Uang Jalan', sortable: true, align: 'right', width: '152px',
      render: (t) => (
        <div className="tnum leading-tight">
          {t.termin_count > 0
            ? <span><span className="font-medium text-ink">{formatRupiah(t.uj_total)}</span><span className="ml-1.5 text-[11.5px] text-ink-3">{t.termin_count}×</span></span>
            : <span className="text-ink-3">—</span>}
          {/* Patokan dari rute; termin dicatat saat dibayar. */}
          {t.ujroute > 0 && t.status !== 'batal' && <span className="block text-[11.5px] text-ink-3">patokan {formatRupiah(t.ujroute)}</span>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true, width: '108px',
      render: (t) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
          {karawang && belumDiPool(t) && <span className="text-[11px] font-medium whitespace-nowrap text-[#8a6100]" title="Mobil belum tercatat kembali di pool">Belum di pool</span>}
          {t.printed_at && <span className="text-[11px] text-ink-3">Tercetak</span>}
        </div>
      ),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '112px',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <DetailButton label={`Lihat detail trip ${t.id_tampil}`} onClick={() => navigate(`/transaksi/trip/${t.id}`)} />
          <IconButton label="Edit" icon={<FaPen size={14} />} disabled={!bisa('trip') || t.status === 'batal'} onClick={() => navigate(`/transaksi/trip/${t.id}/edit`)} />
          <OverflowMenu actions={aksiBaris(t)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Trip / Job Order"
        description={karawang
          ? 'Satu trip = satu mobil, dengan Berita Acara, perjalanan, uang jalan, biaya, dan PI-nya sendiri.'
          : 'Setiap trip memuat dokumen Surat Jalan beserta catatan uang jalan, biaya, dan lampirannya.'}
        actions={
          <Button variant="primary" icon={<FaPlus size={15} />} disabled={!bisa('trip')} onClick={() => navigate('/transaksi/trip/tambah')}>
            Tambah Trip
          </Button>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-80"
                placeholder={karawang ? 'Cari ID Trip, No. Referensi, supir, plat, rute...' : 'Cari No. Trip, ID Perjalanan, supir, rute, S/JO...'} />
              <PanelFilter filter={filter} chips={chips} galat={galatRentang(d.dari, d.sampai)} lebar={380}>
                <div>
                  <p className="form-label">Tanggal berangkat</p>
                  <div className="grid grid-cols-2 gap-2">
                    <DateInput value={d.dari} onChange={(e) => filter.ubah({ dari: e.target.value })} aria-label="Berangkat dari" />
                    <DateInput value={d.sampai} onChange={(e) => filter.ubah({ sampai: e.target.value })} aria-label="Berangkat sampai" />
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => filter.ubah({ dari: startOfMonthISO(), sampai: endOfMonthISO() })}>Bulan ini</Button>
                    <Button size="sm" variant="ghost" onClick={() => { const [a, b] = bulanLalu(); filter.ubah({ dari: a, sampai: b }) }}>Bulan lalu</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status">
                    {(id) => (
                      <Select id={id} value={d.status} onChange={(e) => filter.ubah({ status: e.target.value })}>
                        <option value="">Semua</option>
                        {opsiStatus.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label={`Cetak ${karawang ? 'Berita Acara' : 'Surat Jalan'}`}>
                    {(id) => (
                      <Select id={id} value={d.cetak} onChange={(e) => filter.ubah({ cetak: e.target.value })}>
                        <option value="">Semua</option>
                        <option value="tercetak">Sudah dicetak</option>
                        <option value="belum">Belum dicetak</option>
                      </Select>
                    )}
                  </Field>
                </div>
                <Field label="Supir">
                  {(id) => (
                    <Select id={id} value={d.supir} onChange={(e) => filter.ubah({ supir: e.target.value })}>
                      <option value="">Semua</option>
                      {daftarSupir.map(([sid, nama]) => <option key={sid} value={sid}>{nama}</option>)}
                    </Select>
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Klien">
                    {(id) => (
                      <Select id={id} value={d.klien} onChange={(e) => filter.ubah({ klien: e.target.value })}>
                        <option value="">Semua</option>
                        {db.projects.map((p) => <option key={p.id} value={p.id}>{p.project_code}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="Tipe Layanan">
                    {(id) => (
                      <Select id={id} value={d.layanan} onChange={(e) => filter.ubah({ layanan: e.target.value })}>
                        <option value="">Semua</option>
                        {SERVICE_TYPES.map((s) => <option key={s} value={s}>{CLIENT_TYPE_LABEL[s]}</option>)}
                      </Select>
                    )}
                  </Field>
                </div>
                {karawang && (
                  <Checkbox label="Hanya mobil yang belum kembali ke pool" checked={d.pool}
                    onChange={(e) => filter.ubah({ pool: e.target.checked })} />
                )}
              </PanelFilter>
            </>
          }
          right={jumlahFilter > 0 || table.isFiltered ? <span className="text-[12.5px] text-ink-3">{table.total} trip cocok</span> : undefined}
        />

        {selected.size > 0 && (
          <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-brand-800">{selected.size} trip dipilih</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" icon={<FaPrint size={14} />} onClick={() => setPrinting(selectedRows)}>Cetak {namaDokumen}</Button>
              <Button size="sm" icon={<FaCheckDouble size={14} />} disabled={!bisa('trip') || bisaSelesai.length === 0} onClick={bukaTutupMassal}>
                {karawang ? 'Tutup Trip' : 'Tandai Selesai'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan pilihan</Button>
            </div>
          </div>
        )}

        <DataTable
          columns={kolom}
          rows={table.pageRows}
          rowKey={(t) => t.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || jumlahFilter > 0}
          sort={table.sort}
          onSortChange={table.toggleSort}
          selectedKeys={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          empty={<EmptyState entity="trip" />}
          notFound={<NotFoundState onReset={resetFilters} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <SuratJalanPrintFlow notes={printing ?? []} open={!!printing} onClose={() => setPrinting(null)} onPrinted={markPrinted} />

      {karawang ? (
        <Modal
          open={tandaiSelesai}
          onClose={() => setTandaiSelesai(false)}
          title="Tutup trip terpilih?"
          size="sm"
          footer={
            <>
              <Button onClick={() => setTandaiSelesai(false)}>Batal</Button>
              <Button variant="primary" onClick={doSelesai}>Tutup Trip</Button>
            </>
          }
        >
          <div className="space-y-3 text-[13px] leading-relaxed text-ink-2">
            <p>
              {bisaSelesai.length} trip akan ditutup dengan dokumen fisik POD diterima.
              {bisaSelesai.length < selectedRows.length && ' Trip yang sudah selesai atau dibatalkan dilewati.'}
            </p>
            <p className="text-[12.5px] text-ink-3">
              Ingin memeriksa rekapnya dulu? Tutup satu per satu lewat menu ⋯ Tutup Trip.
            </p>
            <div className="rounded-lg border border-hairline bg-sunken px-3 py-2.5">
              <Checkbox label="Mobil sudah kembali ke pool" checked={massalDiPool} onChange={(e) => setMassalDiPool(e.target.checked)} />
              <p className="mt-1 pl-6 text-[12px] text-ink-3">
                {massalDiPool
                  ? 'Mobilnya langsung bisa dipakai trip lain.'
                  : 'Mobilnya tetap tertahan sampai ditandai sudah di pool lewat menu ⋯ tiap trip.'}
              </p>
            </div>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog
          open={tandaiSelesai}
          title="Tandai Selesai?"
          message={`${bisaSelesai.length} trip akan ditandai Selesai.${bisaSelesai.length < selectedRows.length ? ' Trip yang sudah selesai atau dibatalkan dilewati.' : ''}`}
          confirmLabel="Tandai Selesai"
          tone="primary"
          onCancel={() => setTandaiSelesai(false)}
          onConfirm={doSelesai}
        />
      )}

      <ModalRekapTrip trip={rekap} onClose={() => setRekap(null)} />
      <KonfirmasiBatalTrip trip={membatalkan} onClose={() => setMembatalkan(null)} />
      <KonfirmasiTutupTrip trip={menutup} onClose={() => setMenutup(null)} />
      <KonfirmasiHapusTrip
        trip={menghapus}
        onClose={() => setMenghapus(null)}
        onDeleted={(id) => setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })}
      />
    </>
  )
}
