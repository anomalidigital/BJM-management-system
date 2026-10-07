import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FaBan, FaCheckDouble, FaFlagCheckered, FaPen, FaPlus, FaPrint, FaTrashCan, FaXmark,
} from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, DetailButton, IconButton } from '../components/ui/Button'
import { OverflowMenu } from '../components/ui/Menu'
import { DateInput, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { ConfirmDialog } from '../components/ui/Modal'
import { SuratJalanPrintFlow } from '../components/report/SuratJalanPrintFlow'
import { KonfirmasiBatalTrip, KonfirmasiHapusTrip } from './trip/KonfirmasiTrip'
import { KonfirmasiTutupTrip } from './trip/TutupTrip'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import { formatDate, formatRupiah, startOfMonthISO, todayISO } from '../lib/format'
import type { TransactionRow } from '../types'
import { STATUS_LABEL, STATUS_TONE, STATUS_URUT } from './trip/status'

/**
 * Transaksi -> Trip (dulu Surat Jalan + Data Pengeluaran).
 * Satu baris = satu perjalanan beserta dokumen dan catatan keuangannya.
 */
export function TripListPage() {
  const { db, transactionRows, loading, error, reload, update, tutupTrip } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const karawang = workspace === 'karawang'
  /** Dokumen cetak Karawang = Berita Acara Serah Terima; Priok = Surat Jalan. */
  const namaDokumen = karawang ? 'Berita Acara' : 'Surat Jalan'
  /** Kata kunci dari kotak pencarian di baris atas (?q=), dan trip yang baru disimpan untuk dicetak (?cetak=). */
  const [params, setParams] = useSearchParams()
  const cariDariAtas = params.get('q') ?? ''
  const [menutup, setMenutup] = useState<TransactionRow | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')
  const [cetak, setCetak] = useState('')
  const [sopir, setSopir] = useState('')
  const [project, setProject] = useState('')
  const [layanan, setLayanan] = useState('')
  const [tandaiSelesai, setTandaiSelesai] = useState(false)
  const [printing, setPrinting] = useState<TransactionRow[] | null>(null)
  const [membatalkan, setMembatalkan] = useState<TransactionRow | null>(null)
  const [menghapus, setMenghapus] = useState<TransactionRow | null>(null)

  /** Seluruh sopir yang pernah tercatat di trip, termasuk sopir tambahan. */
  const daftarSopir = useMemo(() => {
    const nama = new Map(db.drivers.map((d) => [d.id, d.driver_name]))
    const m = new Map<string, string>()
    for (const t of transactionRows) {
      for (const id of t.driver_ids) if (nama.has(id)) m.set(id, nama.get(id)!)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [transactionRows, db.drivers])

  const search = useCallback(
    (t: TransactionRow, q: string) =>
      matchesQuery(q, t.transaction_no, t.sj_no, t.sijo, t.recipient_name, t.driver_code, t.driver_names, t.plate_number,
        t.route_code, t.route_name, t.destination_detail, (t.trip_ids ?? []).join(' '), t.tr_list.join(' '), t.pi_number, t.contract_no, t.client_name,
        t.muat, t.bongkar),
    [],
  )
  const extraFilter = useCallback(
    (t: TransactionRow) =>
      (!dateFrom || t.transaction_date >= dateFrom) &&
      (!dateTo || t.transaction_date <= dateTo) &&
      (!status || t.status === status) &&
      (!cetak || (cetak === 'tercetak' ? !!t.printed_at : !t.printed_at)) &&
      (!sopir || (t.driver_ids ?? []).includes(sopir)) &&
      (!project || t.project_id === project) &&
      (!layanan || (t.service_type ?? 'callout') === layanan),
    [dateFrom, dateTo, status, cetak, sopir, project, layanan],
  )
  const filterActive = Boolean(dateFrom || dateTo || status || cetak || sopir || project || layanan)
  const table = useTable(transactionRows, {
    search, extraFilter, extraFilterActive: filterActive,
    initialSortKey: 'transaction_date', initialSortDir: 'desc', tieBreakKey: 'transaction_no', pageSize: 10,
  })
  const { setQuery } = table
  useEffect(() => {
    if (cariDariAtas) setQuery(cariDariAtas)
  }, [cariDariAtas, setQuery])

  // Datang dari "Simpan & Cetak" order banyak mobil: buka cetak untuk seluruh trip barunya.
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

  function resetFilters() {
    table.reset(); setDateFrom(''); setDateTo(''); setStatus(''); setCetak(''); setSopir(''); setProject(''); setLayanan('')
  }

  /** Trip yang dibatalkan tidak ikut ditandai selesai. */
  const bisaSelesai = selectedRows.filter((t) => t.status !== 'batal' && t.status !== 'selesai')

  function doSelesai() {
    // Karawang: ditutup dengan dokumen fisik diterima; trip dengan backload ditutup dari detailnya.
    if (karawang) bisaSelesai.forEach((t) => tutupTrip(t.id, { podFisik: true, podFoto: t.pod_attachments ?? [], adaBackload: false }))
    else bisaSelesai.forEach((t) => update('transactions', t.id, { status: 'selesai' }))
    toast.success(`${bisaSelesai.length} trip ${karawang ? 'ditutup' : 'ditandai Selesai'}.`)
    setSelected(new Set()); setTandaiSelesai(false)
  }

  function markPrinted(ids: string[]) {
    ids.forEach((id) => update('transactions', id, { printed_at: todayISO() }))
  }

  const columns: Column<TransactionRow>[] = [
    { key: 'transaction_date', header: 'Berangkat', sortable: true, width: '92px', render: (t) => <span className="tnum text-ink-2">{formatDate(t.transaction_date)}</span> },
    {
      key: 'transaction_no', header: 'No. Trip', sortable: true, width: '130px',
      render: (t) => (
        <div className="leading-tight">
          <Link to={`/transaksi/trip/${t.id}`} className="tnum font-semibold text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
            {t.transaction_no}
          </Link>
          {t.sj_no && <div className="tnum text-xs text-ink-3" title="Nomor Surat Jalan">{t.sj_no}</div>}
          {t.service_type === 'dedicated' && <Badge tone="brand" className="mt-1" >Dedicated{t.contract_no ? ` · ${t.contract_no}` : ''}</Badge>}
        </div>
      ),
    },
    {
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
    { key: 'driver_names', header: 'Sopir', sortable: true, render: (t) => <span className="font-medium">{t.driver_names || '—'}</span> },
    { key: 'plate_number', header: 'No. Kendaraan', sortable: true, width: '118px', render: (t) => <span className="tnum text-ink-2">{t.plate_number || '—'}</span> },
    {
      key: 'route_code', header: 'Route', sortable: true, width: '170px',
      render: (t) => (
        <div className="leading-tight" title={t.route_name}>
          <div className="tnum">{t.route_code || '—'}</div>
          {t.destination_detail && <div className="text-xs text-ink-3">{t.destination_detail}</div>}
        </div>
      ),
    },
    {
      key: 'sijo', header: 'S / JO', sortable: true, width: '96px',
      render: (t) => (t.sijo
        ? <Link to={`/pencarian/sijo?sijo=${t.sijo}`} className="tnum text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{t.sijo}</Link>
        : <span className="text-ink-3">—</span>),
    },
    {
      key: 'uj_total', header: 'Uang Jalan', sortable: true, align: 'right', width: '140px',
      render: (t) => (
        <div className="tnum leading-tight">
          {t.termin_count > 0
            ? <span><span className="font-medium text-ink">{formatRupiah(t.uj_total)}</span><span className="ml-1.5 text-[11.5px] text-ink-3">{t.termin_count}×</span></span>
            : <span className="text-ink-3">—</span>}
          {/* Patokan dari route; termin dicatat saat dibayar. */}
          {t.ujroute > 0 && t.status !== 'batal' && <span className="block text-[11.5px] text-ink-3">patokan {formatRupiah(t.ujroute)}</span>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true, width: '118px',
      render: (t) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
          {t.printed_at && <span className="text-[11px] text-ink-3">Tercetak</span>}
        </div>
      ),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '120px',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <DetailButton label={`Lihat detail trip ${t.transaction_no}`} onClick={() => navigate(`/transaksi/trip/${t.id}`)} />
          <IconButton label="Edit" icon={<FaPen size={14} />} disabled={!bisa('trip') || t.status === 'batal'} onClick={() => navigate(`/transaksi/trip/${t.id}/edit`)} />
          <OverflowMenu
            actions={[
              { label: `Cetak ${namaDokumen}`, icon: <FaPrint size={14} />, onSelect: () => setPrinting([t]) },
              ...(karawang ? [{
                label: 'Tutup Trip', icon: <FaFlagCheckered size={14} />,
                disabled: !bisa('trip') || t.status !== 'aktif', onSelect: () => setMenutup(t),
              }] : []),
              { label: 'Batalkan Trip', icon: <FaBan size={14} />, tone: 'danger', disabled: !bisa('batal') || t.status === 'batal', onSelect: () => setMembatalkan(t) },
              { label: 'Hapus Trip', icon: <FaTrashCan size={14} />, tone: 'danger', disabled: !bisa('hapus'), onSelect: () => setMenghapus(t) },
            ]}
          />
        </div>
      ),
    },
  ]

  // Karawang tidak memakai nomor container & SI/JO: kolomnya diganti TR (beserta klien) dan No PI.
  const kolomKarawang: Record<string, Column<TransactionRow>> = {
    trip_ids: {
      key: 'tr_list', header: 'TR', sortable: true, width: '150px',
      render: (t) => (
        <div className="leading-tight" title={t.tr_list.join(', ')}>
          <div className="tnum flex items-center gap-1.5 text-ink-2">
            {t.tr_list[0] ?? '—'}
            {t.tr_list.length > 1 && <Badge tone="neutral">+{t.tr_list.length - 1}</Badge>}
          </div>
          {t.project_code && <div className="text-xs text-ink-3">{t.project_code}</div>}
        </div>
      ),
    },
    sijo: {
      key: 'pi_number', header: 'No PI', sortable: true, width: '96px',
      render: (t) => (t.pi_number ? <span className="tnum text-ink-2">{t.pi_number}</span> : <span className="text-ink-3">—</span>),
    },
  }
  const kolom = workspace === 'priok' ? columns : columns.map((c) => kolomKarawang[c.key] ?? c)

  return (
    <>
      <PageHeader
        title="Trip / Job Order"
        description={karawang
          ? 'Satu trip = satu mobil, dengan Berita Acara, perjalanan, uang jalan, biaya, dan PI-nya sendiri.'
          : 'Setiap trip memuat dokumen Surat Jalan beserta catatan uang jalan, biaya, dan lampirannya.'}
        actions={
          <>
            <Button variant="primary" icon={<FaPlus size={15} />} disabled={!bisa('trip')} onClick={() => navigate('/transaksi/trip/tambah')}>
              Tambah Trip
            </Button>
          </>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-80"
                placeholder={workspace === 'priok' ? 'Cari No. Trip, ID Perjalanan, sopir, route, S/JO...' : 'Cari No. Trip, TR, No PI, sopir, plat, rute...'} />
              <FilterField label="Berangkat">
                <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" aria-label="Berangkat dari" />
              </FilterField>
              <FilterField label="s/d">
                <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" aria-label="Berangkat sampai" />
              </FilterField>
              <Button size="sm" variant="ghost" onClick={() => { setDateFrom(startOfMonthISO()); setDateTo('') }}>Bulan ini</Button>
              <FilterField label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
                  <option value="">Semua</option>
                  {STATUS_URUT.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Cetak">
                <Select value={cetak} onChange={(e) => setCetak(e.target.value)} className="w-36">
                  <option value="">Semua</option>
                  <option value="tercetak">Sudah dicetak</option>
                  <option value="belum">Belum dicetak</option>
                </Select>
              </FilterField>
              <FilterField label="Sopir">
                <Select value={sopir} onChange={(e) => setSopir(e.target.value)} className="w-40">
                  <option value="">Semua</option>
                  {daftarSopir.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Klien">
                <Select value={project} onChange={(e) => setProject(e.target.value)} className="w-28">
                  <option value="">Semua</option>
                  {db.projects.map((p) => <option key={p.id} value={p.id}>{p.project_code}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Layanan">
                <Select value={layanan} onChange={(e) => setLayanan(e.target.value)} className="w-32">
                  <option value="">Semua</option>
                  <option value="callout">Callout</option>
                  <option value="dedicated">Dedicated</option>
                </Select>
              </FilterField>
              {(table.isFiltered || filterActive) && (
                <Button size="sm" variant="ghost" icon={<FaXmark size={14} />} onClick={resetFilters}>Reset</Button>
              )}
            </>
          }
        />

        {selected.size > 0 && (
          <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-brand-800">{selected.size} trip dipilih</p>
            <div className="flex items-center gap-2">
              <Button size="sm" icon={<FaPrint size={14} />} onClick={() => setPrinting(selectedRows)}>Cetak {namaDokumen}</Button>
              <Button size="sm" icon={<FaCheckDouble size={14} />} disabled={!bisa('trip') || bisaSelesai.length === 0} onClick={() => setTandaiSelesai(true)}>
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
          isFiltered={table.isFiltered || filterActive}
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

      <ConfirmDialog
        open={tandaiSelesai}
        title={karawang ? 'Tutup trip terpilih?' : 'Tandai Selesai?'}
        message={karawang
          ? `${bisaSelesai.length} trip akan ditutup dengan dokumen fisik POD diterima.${bisaSelesai.length < selectedRows.length ? ' Trip yang sudah selesai atau dibatalkan dilewati.' : ''} Trip yang punya backload tutup dari halaman detailnya, supaya backload langsung dibuat.`
          : `${bisaSelesai.length} trip akan ditandai Selesai.${bisaSelesai.length < selectedRows.length ? ' Trip yang sudah selesai atau dibatalkan dilewati.' : ''}`}
        confirmLabel={karawang ? 'Tutup Trip' : 'Tandai Selesai'}
        tone="primary"
        onCancel={() => setTandaiSelesai(false)}
        onConfirm={doSelesai}
      />

      <KonfirmasiBatalTrip trip={membatalkan} onClose={() => setMembatalkan(null)} />
      <KonfirmasiTutupTrip
        trip={menutup}
        onClose={() => setMenutup(null)}
        onClosed={(adaBackload) => { if (adaBackload && menutup) navigate(`/transaksi/trip/tambah?backload=${menutup.id}`) }}
      />
      <KonfirmasiHapusTrip
        trip={menghapus}
        onClose={() => setMenghapus(null)}
        onDeleted={(id) => setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })}
      />
    </>
  )
}
