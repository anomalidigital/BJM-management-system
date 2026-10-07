import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaFileExport, FaFileInvoiceDollar, FaPrint, FaXmark } from '../../components/ui/icons'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { Button, DetailButton } from '../../components/ui/Button'
import { OverflowMenu } from '../../components/ui/Menu'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { Pagination } from '../../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../../components/ui/Toolbar'
import { DateInput, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, NotFoundState } from '../../components/ui/States'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { PrintDocument, PrintPage, chunkRows } from '../../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../../components/report/ReportPreview'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { useTable } from '../../lib/useTable'
import { downloadFile, matchesQuery } from '../../lib/utils'
import { formatDate, formatNumber, formatRupiah, todayISO } from '../../lib/format'
import { biayaDitagihkan, formatWaktu, nomorPiBerikut } from '../../lib/trip'
import { PI_TAHAP, PI_TAHAP_LABEL } from '../../types'
import type { PiTahap, TransactionRow } from '../../types'
import { PesanGalat } from '../trip/bagian'

type TabId = 'siap' | PiTahap | 'semua'

const TONE: Record<PiTahap, 'neutral' | 'brand' | 'warning' | 'good'> = {
  tercetak: 'neutral', dikirim: 'brand', revisi: 'warning', disetujui: 'good', lunas: 'good',
}

/** Nama biaya di Summary Submission PI (OVERNIGHT, ESCORT, ...). */
const NAMA_PI: Record<string, string> = { Nginap: 'OVERNIGHT', Tol: 'TOL', Escort: 'ESCORT' }

/** Trip yang bisa ditagihkan: selesai, atau batal dengan biaya cancel. */
const bisaDitagih = (t: TransactionRow) => t.status === 'selesai' || (t.status === 'batal' && (t.cancel_fee ?? 0) > 0)
const nilaiPokok = (t: TransactionRow) => (t.status === 'batal' ? t.cancel_fee ?? 0 : t.harga)
const tambahanTrip = (t: TransactionRow) => (t.status === 'batal' ? 0 : t.biaya_ditagihkan)
const totalTrip = (t: TransactionRow) => nilaiPokok(t) + tambahanTrip(t)

/**
 * Tagihan Karawang (alur atasan): trip selesai dan POD-nya diterima dibuatkan PI,
 * lalu diikuti tahapnya sampai lunas: PI Tercetak -> PI Dikirim -> (PI Revisi) ->
 * Disetujui -> Lunas. Satu PI per trip, seperti Summary Submission PI; tabelnya
 * bisa diexport untuk dikirim ke finance klien dan dicetak sebagai ringkasan.
 */
export function TagihanPiPage() {
  const { dbAll, transactionRows, loading, error, reload, update } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const boleh = bisa('tagihan')

  const [tab, setTab] = useState<TabId>('siap')
  const [klien, setKlien] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [buatPi, setBuatPi] = useState<TransactionRow[] | null>(null)
  const [ubah, setUbah] = useState<{ rows: TransactionRow[]; tahap: PiTahap } | null>(null)
  const [cetak, setCetak] = useState<TransactionRow[] | null>(null)

  /** Biaya ditagihkan per trip, dirinci per jenis untuk export & cetak. */
  const rincian = useMemo(() => {
    const m = new Map<string, Array<[string, number]>>()
    for (const e of dbAll.expenses) {
      if (!biayaDitagihkan(e)) continue
      const list = m.get(e.trip_id) ?? []
      list.push([NAMA_PI[e.expense_type] ?? e.expense_type.toUpperCase(), e.amount])
      m.set(e.trip_id, list)
    }
    return m
  }, [dbAll.expenses])

  // Klien tanpa alur dokumen (CASH, order tunai) dibayar langsung, jadi tidak dibuatkan PI.
  // Trip Dedicated ditagihkan lewat kontraknya, bukan PI per trip (TBD-20).
  const tanpaPi = useMemo(() => new Set(dbAll.projects.filter((p) => p.requires_document === false).map((p) => p.id)), [dbAll.projects])
  const semua = useMemo(
    () => transactionRows.filter((t) => !!t.pi_tahap || (bisaDitagih(t) && !tanpaPi.has(t.project_id) && t.service_type !== 'dedicated')),
    [transactionRows, tanpaPi],
  )
  const tahapTrip = (t: TransactionRow): TabId => (t.pi_tahap ?? 'siap')
  const jumlahTab = useMemo(() => {
    const m: Record<string, number> = { semua: semua.length, siap: 0 }
    for (const p of PI_TAHAP) m[p] = 0
    for (const t of semua) m[tahapTrip(t)] = (m[tahapTrip(t)] ?? 0) + 1
    return m
  }, [semua])

  const search = useCallback(
    (t: TransactionRow, q: string) => matchesQuery(q, t.transaction_no, t.tr_list.join(' '), t.pi_number, t.plate_number, t.muat, t.bongkar, t.route_name, t.project_code, t.driver_names),
    [],
  )
  const extraFilter = useCallback(
    (t: TransactionRow) => (tab === 'semua' || tahapTrip(t) === tab) && (!klien || t.project_id === klien),
    [tab, klien],
  )
  const table = useTable(semua, {
    search, extraFilter, extraFilterActive: !!klien,
    initialSortKey: 'transaction_date', initialSortDir: 'desc', tieBreakKey: 'transaction_no', pageSize: 10,
  })
  const terpilih = useMemo(() => semua.filter((t) => selected.has(t.id)), [semua, selected])

  function gantiTab(t: string) { setTab(t as TabId); setSelected(new Set()) }
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    const ids = table.pageRows.map((t) => t.id)
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }

  /** Langkah berikutnya yang wajar dari tiap tahap. */
  const lanjut: Record<PiTahap, PiTahap[]> = {
    tercetak: ['dikirim'], dikirim: ['revisi', 'disetujui'], revisi: ['dikirim', 'disetujui'], disetujui: ['lunas'], lunas: [],
  }
  const AKSI: Record<PiTahap, string> = {
    tercetak: 'Tandai PI Tercetak', dikirim: 'Tandai PI Dikirim', revisi: 'Minta revisi PI', disetujui: 'Tandai Disetujui', lunas: 'Tandai Lunas',
  }

  function exportTabel(rows: TransactionRow[]) {
    const kolom = ['No.', 'TR/OR', 'No.Pol', 'Service type shipment', 'Detail Origin', 'Detail Address', 'Buying Trucking',
      'Additional Cost', 'Additional Cost Buying', 'Total Buying', 'Vendor Name', 'Proforma Invoice No.', 'Date submit PI',
      'ATA (Actual Time Arrive) Date', 'Tahap', 'No. Trip']
    const sel = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const baris = rows.map((t, i) => [
      i + 1, t.tr_list.join(', '), t.plate_number, t.status === 'batal' ? 'Cancel Fee' : t.service_type === 'dedicated' ? 'Dedicated' : 'Call-Out',
      t.muat, t.bongkar, nilaiPokok(t),
      (rincian.get(t.id) ?? []).map(([k, v]) => `${k} ${v}`).join('; '), tambahanTrip(t), totalTrip(t),
      'PT. BIMA JAYA MANGGALA', t.pi_number, t.pi_date ? formatDate(t.pi_date) : '', t.ata ? formatWaktu(t.ata).slice(0, 10) : '',
      t.pi_tahap ? PI_TAHAP_LABEL[t.pi_tahap] : 'Siap PI', t.transaction_no,
    ].map(sel).join(';'))
    // BOM supaya Excel membaca huruf dengan benar; pemisah titik koma untuk Excel berbahasa Indonesia.
    downloadFile(`summary-pi-${todayISO()}.csv`, '﻿' + [kolom.map(sel).join(';'), ...baris].join('\r\n'), 'text/csv;charset=utf-8')
    toast.success(`${rows.length} baris diexport. Kirim berkasnya ke finance klien.`)
  }

  const columns: Column<TransactionRow>[] = [
    {
      key: 'transaction_no', header: 'No. Trip', sortable: true, width: '120px',
      render: (t) => (
        <div className="leading-tight">
          <Link to={`/transaksi/trip/${t.id}`} className="tnum font-semibold text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{t.transaction_no}</Link>
          <div className="tnum text-xs text-ink-3">{formatDate(t.transaction_date)}</div>
        </div>
      ),
    },
    {
      key: 'tr_list', header: 'TR', sortable: true, width: '140px',
      render: (t) => (
        <div className="leading-tight" title={t.tr_list.join(', ')}>
          <div className="tnum flex items-center gap-1.5 text-ink-2">{t.tr_list[0] ?? '—'}{t.tr_list.length > 1 && <Badge tone="neutral">+{t.tr_list.length - 1}</Badge>}</div>
          {t.project_code && <div className="text-xs text-ink-3">{t.project_code}</div>}
        </div>
      ),
    },
    { key: 'plate_number', header: 'No. Pol', sortable: true, width: '108px', render: (t) => <span className="tnum text-ink-2">{t.plate_number || '—'}</span> },
    {
      key: 'bongkar', header: 'Muat → Bongkar', sortable: true,
      render: (t) => (
        <div className="leading-tight">
          <span className="text-ink-2">{t.muat || '?'} → {t.bongkar || '?'}</span>
          <span className="tnum block text-xs text-ink-3">{t.ata ? `ATA ${formatWaktu(t.ata).slice(0, 10)}` : 'ATA belum dicatat'}</span>
        </div>
      ),
    },
    {
      key: 'harga', header: 'Harga', sortable: true, align: 'right', width: '124px',
      render: (t) => (
        <div className="tnum leading-tight">
          <span className="font-medium text-ink">{formatRupiah(nilaiPokok(t))}</span>
          {t.status === 'batal' && <span className="block text-[11.5px] text-ink-3">cancel fee</span>}
        </div>
      ),
    },
    {
      key: 'biaya_ditagihkan', header: 'Tambahan', sortable: true, align: 'right', width: '120px',
      render: (t) => (tambahanTrip(t)
        ? <span className="tnum text-ink-2" title={(rincian.get(t.id) ?? []).map(([k, v]) => `${k} ${formatRupiah(v)}`).join(', ')}>{formatRupiah(tambahanTrip(t))}</span>
        : <span className="text-ink-3">—</span>),
    },
    { key: 'total', header: 'Total', align: 'right', width: '128px', render: (t) => <span className="tnum font-semibold text-ink">{formatRupiah(totalTrip(t))}</span> },
    {
      key: 'pi_tahap', header: 'PI', sortable: true, width: '150px',
      render: (t) => (t.pi_tahap ? (
        <div className="flex flex-col items-start gap-1 leading-tight">
          <span className="tnum text-[12.5px] text-ink">{t.pi_number || '—'}</span>
          <Badge tone={TONE[t.pi_tahap]}>{PI_TAHAP_LABEL[t.pi_tahap]}{t.pi_tahap_date ? ` · ${formatDate(t.pi_tahap_date)}` : ''}</Badge>
        </div>
      ) : <Badge tone="warning">Siap dibuatkan PI</Badge>),
    },
    {
      key: 'bukti', header: 'Bukti', width: '110px',
      render: (t) => ((t.pi_attachments?.length ?? 0) > 0 ? <LampiranThumbs ids={t.pi_attachments!} ukuran={28} /> : <span className="text-ink-3">—</span>),
    },
    {
      key: 'pod', header: 'POD', width: '96px',
      render: (t) => (t.pod_fisik === false ? <Badge tone="warning">Fisik menyusul</Badge> : t.pod_fisik ? <Badge tone="good">Fisik</Badge> : <span className="text-ink-3">—</span>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <DetailButton label={`Lihat trip ${t.transaction_no}`} onClick={() => navigate(`/transaksi/trip/${t.id}`)} />
          <OverflowMenu
            actions={[
              ...(!t.pi_tahap
                ? [{ label: 'Buat PI', disabled: !boleh, onSelect: () => setBuatPi([t]) }]
                : [...lanjut[t.pi_tahap].map((p) => ({ label: AKSI[p], disabled: !boleh, onSelect: () => setUbah({ rows: [t], tahap: p }) })),
                  { label: 'Cetak ringkasan', disabled: false, onSelect: () => setCetak([t]) }]),
              // Hardcopy POD yang menyusul: dibutuhkan untuk berkas tagihan fisik.
              ...(t.pod_fisik === false ? [{ label: 'Tandai fisik diterima', disabled: !bisa('trip'), onSelect: () => {
                update('transactions', t.id, { pod_fisik: true, pod_fisik_at: todayISO() })
                toast.success(`Dokumen fisik POD Trip ${t.transaction_no} diterima.`)
              } }] : []),
            ]}
          />
        </div>
      ),
    },
  ]

  const tabs = [
    { id: 'siap', label: 'Siap PI', badge: jumlahTab.siap },
    ...PI_TAHAP.map((p) => ({ id: p, label: PI_TAHAP_LABEL[p], badge: jumlahTab[p] })),
    { id: 'semua', label: 'Semua', badge: jumlahTab.semua },
  ]
  const tahapPilihan = tab !== 'siap' && tab !== 'semua' ? lanjut[tab] : []

  if (cetak) {
    return <CetakRingkasan rows={cetak} rincian={rincian} onClose={() => setCetak(null)} />
  }

  return (
    <>
      <PageHeader
        title="Tagihan"
        crumbs={[{ label: 'Laporan' }, { label: 'Tagihan' }]}
        description="Trip yang sudah ditutup dibuatkan PI, lalu diikuti sampai lunas: PI Tercetak, PI Dikirim, PI Revisi, Disetujui, Lunas. Satu PI untuk satu trip."
      />

      <Card>
        <Tabs items={tabs} value={tab} onChange={gantiTab} className="px-2" />
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-80" placeholder="Cari No. Trip, TR, No PI, plat, lokasi..." />
              <FilterField label="Klien">
                <Select value={klien} onChange={(e) => setKlien(e.target.value)} className="w-32">
                  <option value="">Semua</option>
                  {dbAll.projects.map((p) => <option key={p.id} value={p.id}>{p.project_code}</option>)}
                </Select>
              </FilterField>
              {(table.isFiltered || klien) && (
                <Button size="sm" variant="ghost" icon={<FaXmark size={14} />} onClick={() => { table.reset(); setKlien('') }}>Reset</Button>
              )}
            </>
          }
          right={
            <>
              <Button size="sm" icon={<FaFileExport size={14} />} disabled={table.total === 0} onClick={() => exportTabel(table.filtered)}>Export tabel</Button>
              <Button size="sm" icon={<FaPrint size={14} />} disabled={table.total === 0} onClick={() => setCetak(table.filtered)}>Cetak ringkasan</Button>
            </>
          }
        />

        {selected.size > 0 && (
          <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-brand-800">
              {selected.size} trip dipilih · {formatRupiah(terpilih.reduce((a, t) => a + totalTrip(t), 0))}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {tab === 'siap' && (
                <Button size="sm" variant="primary" icon={<FaFileInvoiceDollar size={14} />} disabled={!boleh} onClick={() => setBuatPi(terpilih)}>Buat PI</Button>
              )}
              {tahapPilihan.map((p) => (
                <Button key={p} size="sm" disabled={!boleh} onClick={() => setUbah({ rows: terpilih, tahap: p })}>{AKSI[p]}</Button>
              ))}
              <Button size="sm" icon={<FaFileExport size={14} />} onClick={() => exportTabel(terpilih)}>Export</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan pilihan</Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(t) => t.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || !!klien || tab !== 'semua'}
          sort={table.sort}
          onSortChange={table.toggleSort}
          selectedKeys={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          empty={<EmptyState entity="trip selesai" />}
          notFound={!table.isFiltered && !klien
            ? (
              <p className="px-6 py-14 text-center text-[13px] text-ink-3">
                {tab === 'siap' ? 'Semua trip yang sudah ditutup sudah dibuatkan PI.' : `Belum ada PI di tahap ${PI_TAHAP_LABEL[tab as PiTahap] ?? tab}.`}
              </p>
            )
            : <NotFoundState onReset={() => { table.reset(); setKlien('') }} />}
        />
        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <ModalBuatPi
        rows={buatPi}
        nomorAda={dbAll.transactions.map((t) => t.pi_number).filter(Boolean)}
        onClose={() => setBuatPi(null)}
        onSimpan={(isi, bukti) => {
          isi.forEach(({ id, nomor, tanggal }) => {
            const t = transactionRows.find((x) => x.id === id)
            update('transactions', id, { pi_number: nomor, pi_tahap: 'tercetak', pi_date: tanggal, pi_tahap_date: tanggal, pi_attachments: [...(t?.pi_attachments ?? []), ...bukti] })
          })
          toast.success(`${isi.length} PI dibuat dengan tahap PI Tercetak.`)
          setBuatPi(null); setSelected(new Set()); setTab('tercetak')
        }}
      />
      <ModalUbahTahap
        isi={ubah}
        onClose={() => setUbah(null)}
        onSimpan={(rows, tahap, tanggal, catatan, bukti) => {
          rows.forEach((t) => update('transactions', t.id, {
            pi_tahap: tahap, pi_tahap_date: tanggal,
            ...(catatan ? { pi_note: [t.pi_note, `${PI_TAHAP_LABEL[tahap]} ${formatDate(tanggal)}: ${catatan}`].filter(Boolean).join('\n') } : {}),
            ...(bukti.length ? { pi_attachments: [...(t.pi_attachments ?? []), ...bukti] } : {}),
          }))
          toast.success(`${rows.length} PI menjadi ${PI_TAHAP_LABEL[tahap]}.`)
          setUbah(null); setSelected(new Set())
        }}
      />
    </>
  )
}

/** Buat PI untuk trip terpilih: nomor berurutan mengikuti format Summary Submission PI. */
function ModalBuatPi({ rows, nomorAda, onClose, onSimpan }: {
  rows: TransactionRow[] | null
  nomorAda: string[]
  onClose: () => void
  onSimpan: (isi: Array<{ id: string; nomor: string; tanggal: string }>, bukti: string[]) => void
}) {
  const [tanggal, setTanggal] = useState(todayISO())
  const [nomor, setNomor] = useState<Record<string, string>>({})
  const [bukti, setBukti] = useState<string[]>([])
  const [galat, setGalat] = useState<string | null>(null)
  if (!rows) return null
  const usulan = (t: TransactionRow, i: number) => nomor[t.id] ?? nomorPiBerikut(nomorAda, t.project_code, tanggal, i)

  function simpan() {
    if (!rows) return
    const isi = rows.map((t, i) => ({ id: t.id, nomor: usulan(t, i).trim(), tanggal }))
    if (!tanggal) { setGalat('Tanggal PI wajib diisi.'); return }
    if (isi.some((x) => !x.nomor)) { setGalat('Nomor PI tidak boleh kosong.'); return }
    const semua = [...nomorAda, ...isi.map((x) => x.nomor)].map((x) => x.toUpperCase())
    if (new Set(semua).size < semua.length) { setGalat('Ada nomor PI yang sama dengan PI lain.'); return }
    setNomor({}); setGalat(null); setBukti([])
    onSimpan(isi, bukti)
  }

  return (
    <Modal
      open
      onClose={() => { setNomor({}); setGalat(null); setBukti([]); onClose() }}
      title={`Buat PI untuk ${rows.length} trip`}
      subtitle="Satu PI per trip. Nomor terisi otomatis dan boleh diganti."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={simpan}>Buat PI</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tanggal PI" required>
          {(fid) => <DateInput id={fid} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />}
        </Field>
        <ul className="max-h-72 divide-y divide-grid overflow-y-auto rounded-lg border border-hairline">
          {rows.map((t, i) => (
            <li key={t.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0 text-[12.5px]">
                <p className="font-semibold text-ink">Trip {t.transaction_no} · {t.plate_number || 'tanpa mobil'}</p>
                <p className="truncate text-ink-3">{t.tr_list.join(', ') || 'tanpa TR'} · {formatRupiah(totalTrip(t))}</p>
              </div>
              <Input aria-label={`Nomor PI trip ${t.transaction_no}`} value={usulan(t, i)} className="tnum sm:w-60"
                onChange={(e) => setNomor((n) => ({ ...n, [t.id]: e.target.value }))} />
            </li>
          ))}
        </ul>
        <Field label="Bukti PI" hint={rows.length > 1 ? 'Scan / PDF PI. Dilampirkan ke semua trip yang dipilih.' : 'Scan / PDF PI yang dicetak.'}>
          {(fid) => <LampiranInput id={fid} label="Tambah bukti" value={bukti} onChange={setBukti} />}
        </Field>
        <PesanGalat>{galat}</PesanGalat>
      </div>
    </Modal>
  )
}

/** Bukti yang biasanya menyertai tiap tahap PI. */
const BUKTI_TAHAP: Record<PiTahap, string> = {
  tercetak: 'Scan / PDF PI.',
  dikirim: 'Tanda terima atau email pengiriman PI ke klien.',
  revisi: 'Email / catatan revisi dari klien.',
  disetujui: 'Email konfirmasi atau approval sheet dari klien.',
  lunas: 'Bukti transfer dari klien.',
}

/** Pindah tahap PI: tanggal wajib, catatan wajib untuk revisi. */
function ModalUbahTahap({ isi, onClose, onSimpan }: {
  isi: { rows: TransactionRow[]; tahap: PiTahap } | null
  onClose: () => void
  onSimpan: (rows: TransactionRow[], tahap: PiTahap, tanggal: string, catatan: string, bukti: string[]) => void
}) {
  const [tanggal, setTanggal] = useState(todayISO())
  const [catatan, setCatatan] = useState('')
  const [bukti, setBukti] = useState<string[]>([])
  const [galat, setGalat] = useState<string | null>(null)
  if (!isi) return null
  const { rows, tahap } = isi

  function simpan() {
    if (!tanggal) { setGalat('Tanggal wajib diisi.'); return }
    if (tahap === 'revisi' && !catatan.trim()) { setGalat('Tulis apa yang perlu direvisi, mis. selisih harga atau biaya tambahan.'); return }
    onSimpan(rows, tahap, tanggal, catatan.trim(), bukti)
    setCatatan(''); setGalat(null); setBukti([])
  }

  return (
    <Modal
      open
      onClose={() => { setCatatan(''); setGalat(null); setBukti([]); onClose() }}
      title={`${PI_TAHAP_LABEL[tahap]}: ${rows.length} PI`}
      subtitle={rows.map((t) => t.pi_number || t.transaction_no).slice(0, 4).join(', ') + (rows.length > 4 ? ', ...' : '')}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={simpan}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tanggal" required>
          {(fid) => <DateInput id={fid} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />}
        </Field>
        <Field label={tahap === 'revisi' ? 'Yang direvisi' : 'Catatan'} required={tahap === 'revisi'}
          hint={tahap === 'disetujui' ? 'mis. dikonfirmasi lewat email finance klien.' : tahap === 'lunas' ? 'mis. nomor bukti transfer.' : undefined}>
          {(fid) => <Textarea id={fid} rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} />}
        </Field>
        <Field label="Bukti" hint={BUKTI_TAHAP[tahap] + (rows.length > 1 ? ' Dilampirkan ke semua PI yang dipilih.' : '')}>
          {(fid) => <LampiranInput id={fid} label="Tambah bukti" value={bukti} onChange={setBukti} />}
        </Field>
        <PesanGalat>{galat}</PesanGalat>
      </div>
    </Modal>
  )
}

/** Ringkasan PI (gabungan PI / shipment summary) dalam format tabel Summary Submission. */
function CetakRingkasan({ rows, rincian, onClose }: {
  rows: TransactionRow[]
  rincian: Map<string, Array<[string, number]>>
  onClose: () => void
}) {
  const total = rows.reduce((a, t) => a + totalTrip(t), 0)
  return (
    <ReportPreview onClose={onClose} onPrint={() => window.print()} orientasiAwal="lanskap">
      {(orientasi) => {
        const per = barisPerLembar(orientasi, 22)
        const pages = chunkRows(rows, per)
        return (
          <PrintDocument>
            {pages.map((isi, i) => (
              <PrintPage key={i} page={i + 1} totalPages={pages.length} title="Summary Submission PI" subtitle="PT Bima Jaya Manggala"
                meta={[{ label: 'Jumlah PI', value: formatNumber(rows.length) }, { label: 'Total', value: formatRupiah(total) }]}>
                <PrintTable cols={[
                  { label: 'No.', align: 'right', width: '4%' }, { label: 'TR/OR', width: '13%' }, { label: 'No.Pol', width: '9%' },
                  { label: 'Origin' }, { label: 'Destination' }, { label: 'Trucking', align: 'right' },
                  { label: 'Additional Cost', width: '16%' }, { label: 'Total', align: 'right' }, { label: 'No. PI', width: '15%' }, { label: 'ATA', width: '8%' },
                ]}>
                  {isi.map((t, ri) => (
                    <PRow key={t.id}>
                      <PCell align="right">{i * per + ri + 1}</PCell>
                      <PCell>{t.tr_list.join(', ') || '-'}</PCell>
                      <PCell>{t.plate_number || '-'}</PCell>
                      <PCell>{t.muat || '-'}</PCell>
                      <PCell>{t.bongkar || '-'}</PCell>
                      <PCell align="right">{formatNumber(nilaiPokok(t))}</PCell>
                      <PCell>{(rincian.get(t.id) ?? []).map(([k, v]) => `${k} ${formatNumber(v)}`).join(', ') || '-'}</PCell>
                      <PCell align="right" bold>{formatNumber(totalTrip(t))}</PCell>
                      <PCell>{t.pi_number || '-'}</PCell>
                      <PCell>{t.ata ? formatWaktu(t.ata).slice(0, 10) : '-'}</PCell>
                    </PRow>
                  ))}
                  {i === pages.length - 1 && (
                    <PRow tone="total">
                      <PCell align="right" colSpan={7}>TOTAL</PCell>
                      <PCell align="right">{formatNumber(total)}</PCell>
                      <PCell colSpan={2} />
                    </PRow>
                  )}
                </PrintTable>
              </PrintPage>
            ))}
          </PrintDocument>
        )
      }}
    </ReportPreview>
  )
}
