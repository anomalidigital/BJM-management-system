import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FaEye, FaPrint, FaReceipt, FaTruckFast, FaWallet } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { DateInput, Field, FieldError, Select } from '../components/ui/Field'
import { DaftarChipFilter, PanelFilter } from '../components/ui/Toolbar'
import { PanelTab, TabKartu } from '../components/ui/TabKartu'
import { LineChart } from '../components/charts/LineChart'
import { VIZ } from '../components/charts/chartUtils'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { tripDihitung } from '../lib/calculations'
import { endOfMonthISO, formatDate, formatNumber, formatRupiah, galatRentang, rentangTanggal, startOfMonthISO } from '../lib/format'
import { useFilter } from '../lib/useFilter'
import { periodeAktif } from '../lib/periode'
import { cn, sum } from '../lib/utils'
import { labelBiaya } from '../types'
import type { TransactionRow } from '../types'
import { GARIS_TOTAL, JudulDiagram, KELAS_TH, LapUangJalanPage, deretTanggal, terminPeriode } from './LapUangJalanPage'
import type { TampilUj } from './LapUangJalanPage'
import { LapBiayaPage, notaPeriode } from './LapBiayaPage'

const TAB_IDS = ['trip', 'uj', 'biaya'] as const
type TabId = (typeof TAB_IDS)[number]
const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Tab detail trip yang dibuka dari tiap tab: Per Trip & Uang Jalan -> Uang Jalan, Biaya -> Biaya Operasional. */
const TAB_DETAIL: Record<TabId, 'uj' | 'biaya'> = { trip: 'uj', uj: 'uj', biaya: 'biaya' }

const PESAN_KOSONG: Record<TabId, string> = {
  trip: 'Tidak ada trip pada periode tersebut.',
  uj: 'Tidak ada pembayaran uang jalan pada periode tersebut.',
  biaya: 'Tidak ada biaya pada periode tersebut.',
}

/**
 * Warna bagian pengeluaran, dari palet data dengan urutan tetap (lolos uji buta warna untuk
 * bagian yang bersebelahan). "Ditagihkan ke klien" hijau seperti lencana "Ke klien" di detail trip.
 */
const WARNA = { uj: VIZ.series1, perusahaan: VIZ.series2, internal: VIZ.series3, tagih: '#008300' }

interface BarisTrip extends TransactionRow {
  /** Biaya yang dibayar supir dari uang jalan: hanya keterangan, sudah termasuk di uang jalan. */
  biaya_sopir: number
  /** Total keluar = uang jalan + dibayar perusahaan langsung + biaya internal. */
  keluar: number
}

/** Trip yang berangkat dalam periode (trip batal tidak dihitung). */
function tripPeriode(rows: TransactionRow[], awal: string, akhir: string): BarisTrip[] {
  return rows
    .filter((t) => tripDihitung(t) && t.transaction_date >= awal && t.transaction_date <= akhir)
    .map((t) => ({ ...t, biaya_sopir: t.expense_total - t.biaya_perusahaan, keluar: t.uj_total + t.biaya_perusahaan + t.internal_total }))
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.transaction_no.localeCompare(b.transaction_no))
}

const bulanDari = (ref: Date) => ({ awal: startOfMonthISO(ref), akhir: endOfMonthISO(ref) })

/**
 * Laporan -> Pengeluaran ("Rekap Pengeluaran", catatan atasan 12 Okt 2026). Revisi 13 Okt 2026:
 * seluruh filter (periode, jenis biaya) di satu tombol Filter di kepala halaman, lalu daftarnya.
 * Periode berlaku untuk ketiga bagian; tiap bagian tetap memakai tanggalnya sendiri (berangkat
 * trip / bayar termin / tanggal nota). Bagian dipilih lewat kartu tombol besar, dan tab, periode,
 * serta pilihan tabel disimpan di alamat halaman supaya kembali dari detail trip membuka
 * tampilan yang sama.
 */
export function LapPengeluaranPage() {
  const { db, transactionRows, loading } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [preview, setPreview] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const tabUrl = params.get('tab')
  const tab: TabId = TAB_IDS.includes(tabUrl as TabId) ? (tabUrl as TabId) : 'trip'
  const tampilUj: TampilUj = params.get('tampil') === 'termin' ? 'termin' : 'supir'
  const jenis = params.get('jenis') ?? ''

  // Periode bawaan sama dengan "Periode" di topbar dan laporan lain: bulan terakhir yang punya trip.
  const bawaan = useMemo(() => periodeAktif(transactionRows.map((t) => t.transaction_date)), [transactionRows])
  const awalUrl = params.get('awal') ?? ''
  const akhirUrl = params.get('akhir') ?? ''
  const awal = ISO.test(awalUrl) ? awalUrl : bawaan.start
  const akhir = ISO.test(akhirUrl) ? akhirUrl : bawaan.end

  /**
   * Ubah parameter alamat. Dasarnya dibaca dari window.location, bukan `params` render ini:
   * React Router menjalankan pergantian alamat sebagai transisi, jadi perubahan sebelumnya
   * (mis. Tanggal awal yang baru diisi) bisa belum ikut ter-render dan akan tertimpa.
   */
  function ubahUrl(ubah: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(window.location.search)
    ubah(p)
    setParams(p, { replace: true })
  }
  const gantiTab = (t: string) => { setGalat(null); ubahUrl((p) => p.set('tab', t)) }

  const tripById = useMemo(() => new Map(transactionRows.map((t) => [t.id, t])), [transactionRows])
  const trips = useMemo(() => tripPeriode(transactionRows, awal, akhir), [transactionRows, awal, akhir])
  const termin = useMemo(() => terminPeriode(db.ujPayments, tripById, db.drivers, awal, akhir), [db.ujPayments, db.drivers, tripById, awal, akhir])
  const nota = useMemo(() => notaPeriode(db.expenses, tripById, awal, akhir), [db.expenses, tripById, awal, akhir])

  const total = {
    keluar: sum(trips, (t) => t.keluar),
    uj: sum(termin, (p) => p.uj_amount),
    biaya: sum(nota, (e) => e.amount),
  }

  const hariIni = new Date()
  const bulanIni = bulanDari(hariIni)
  const bulanLalu = bulanDari(new Date(hariIni.getFullYear(), hariIni.getMonth() - 1, 1))
  /** Jenis biaya yang ada di periode ini (pilihan filter tab Biaya Operasional). */
  const daftarJenis = useMemo(() => [...new Set(nota.map((e) => e.expense_type))].sort((a, b) => labelBiaya(a).localeCompare(labelBiaya(b), 'id')), [nota])
  const gantiJenis = (j: string) => { setGalat(null); ubahUrl((p) => (j ? p.set('jenis', j) : p.delete('jenis'))) }
  /** Periode & jenis biaya berdraf (baru berlaku setelah Terapkan); yang berlaku disimpan di alamat halaman. */
  const periodeBawaan = awal === bawaan.start && akhir === bawaan.end
  const filter = useFilter({ awal: bawaan.start, akhir: bawaan.end, jenis: '' }, {
    nilai: { awal, akhir, jenis },
    terapkan: (v) => {
      setGalat(null)
      ubahUrl((p) => {
        if (v.awal === bawaan.start && v.akhir === bawaan.end) { p.delete('awal'); p.delete('akhir') } else { p.set('awal', v.awal); p.set('akhir', v.akhir) }
        if (v.jenis) p.set('jenis', v.jenis); else p.delete('jenis')
      })
    },
  })
  const d = filter.draf
  const chips = [
    { label: `Periode ${rentangTanggal(awal, akhir)}`, lepas: periodeBawaan ? undefined : () => filter.lepas('awal', 'akhir') },
    jenis && { label: `Jenis biaya: ${labelBiaya(jenis)}`, lepas: () => filter.lepas('jenis') },
  ]

  /** Alamat detail trip yang membawa asal (tab & periode) supaya bisa kembali ke tampilan ini. */
  const tautan = (dari: TabId) => (tripId: string) =>
    `/transaksi/trip/${tripId}?${new URLSearchParams({ dari: 'pengeluaran', dari_tab: dari, awal, akhir, tab: TAB_DETAIL[dari] }).toString()}`

  /** Periode terbalik langsung diberi tahu, tidak menunggu tombol Preview. */
  const galatPeriode = awal > akhir ? 'Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.' : null

  function bukaPreview() {
    if (galatPeriode) { setGalat(galatPeriode); return }
    const n = tab === 'trip' ? trips.length : tab === 'uj' ? termin.length : jenis ? nota.filter((e) => e.expense_type === jenis).length : nota.length
    if (n === 0) {
      setGalat(tab === 'biaya' && jenis ? `Tidak ada biaya jenis ${labelBiaya(jenis)} pada periode tersebut.` : PESAN_KOSONG[tab])
      toast.info('Tidak ada data untuk ditampilkan.')
      return
    }
    setGalat(null)
    setPreview(true)
  }
  const tutupPreview = () => setPreview(false)

  const kartu = [
    {
      id: 'trip', label: 'Per Trip', ikon: FaTruckFast,
      nilai: formatRupiah(total.keluar, { compact: true }), judul: `Total keluar ${formatRupiah(total.keluar)}`,
      keterangan: `${formatNumber(trips.length)} trip berangkat`,
    },
    {
      id: 'uj', label: 'Uang Jalan', ikon: FaWallet,
      nilai: formatRupiah(total.uj, { compact: true }), judul: `Uang jalan dibayar ${formatRupiah(total.uj)}`,
      keterangan: `${formatNumber(termin.length)} termin dibayar`,
    },
    {
      id: 'biaya', label: 'Biaya Operasional', ikon: FaReceipt,
      nilai: formatRupiah(total.biaya, { compact: true }), judul: `Biaya operasional ${formatRupiah(total.biaya)}`,
      keterangan: `${formatNumber(nota.length)} nota biaya`,
    },
  ]

  return (
    <>
      <PageHeader
        title="Rekap Pengeluaran"
        crumbs={[{ label: 'Laporan' }, { label: 'Pengeluaran' }]}
        description="Semua biaya terkait pengeluaran karena trip, dapat ditagihkan ke klien / perihal internal (terkait catatan kasbon/piutang, biaya lainnya)."
        actions={
          <>
            <PanelFilter filter={filter} chips={chips} tampilChips={false} galat={galatRentang(d.awal, d.akhir)} lebar={360}>
              <div>
                <p className="form-label">Periode</p>
                <div className="grid grid-cols-2 gap-2">
                  <DateInput aria-label="Tanggal awal" value={d.awal} onChange={(e) => e.target.value && filter.ubah({ awal: e.target.value })} />
                  <DateInput aria-label="Tanggal akhir" value={d.akhir} onChange={(e) => e.target.value && filter.ubah({ akhir: e.target.value })} />
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => filter.ubah(bulanIni)}>Bulan ini</Button>
                  <Button size="sm" variant="ghost" onClick={() => filter.ubah(bulanLalu)}>Bulan lalu</Button>
                </div>
              </div>
              <Field label="Jenis biaya (bagian Biaya Operasional)">
                {(id) => (
                  <Select id={id} value={d.jenis} onChange={(e) => filter.ubah({ jenis: e.target.value })}>
                    <option value="">Semua jenis</option>
                    {daftarJenis.map((t) => <option key={t} value={t}>{labelBiaya(t)}</option>)}
                  </Select>
                )}
              </Field>
            </PanelFilter>
            <Button icon={<FaEye size={15} />} onClick={bukaPreview} title="Preview cetak bagian yang sedang dibuka">Preview</Button>
            <Button variant="primary" icon={<FaPrint size={15} />} onClick={bukaPreview} title="Cetak bagian yang sedang dibuka">Cetak</Button>
          </>
        }
      />
      <DaftarChipFilter filter={filter} chips={chips} className="no-print -mt-1 mb-3" />
      {(galatPeriode ?? galat) && <div className="no-print mb-3"><FieldError>{galatPeriode ?? galat}</FieldError></div>}

      {loading ? (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-4">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
          <div className="skeleton h-64 rounded-xl" />
        </>
      ) : (
        <>
          <TabKartu awalan="pengeluaran" label="Bagian Rekap Pengeluaran" items={kartu} value={tab} onChange={gantiTab} className="no-print mb-3" />
          {/* key: panel dipasang ulang saat tab berganti, jadi isinya memudar masuk (penanda pindah halaman).
              Animasi tanpa fill-mode: setelah selesai tidak meninggalkan stacking context, sehingga
              layar Preview (position: fixed) tetap tampil di atas topbar & sidebar. */}
          <PanelTab key={tab} awalan="pengeluaran" id={tab} style={{ animation: 'inFade .16s ease-out' }}>
            {tab === 'trip' && (
              <PengeluaranPerTrip rows={trips} awal={awal} akhir={akhir} preview={preview} onTutupPreview={tutupPreview} tautanTrip={tautan('trip')} />
            )}
            {tab === 'uj' && (
              <LapUangJalanPage
                tertanam
                periode={{ awal, akhir }}
                tampil={tampilUj}
                onTampil={(t) => ubahUrl((p) => (t === 'termin' ? p.set('tampil', t) : p.delete('tampil')))}
                preview={preview}
                onTutupPreview={tutupPreview}
                tautanTrip={tautan('uj')}
              />
            )}
            {tab === 'biaya' && (
              <LapBiayaPage
                tertanam
                periode={{ awal, akhir }}
                jenis={jenis}
                onJenis={gantiJenis}
                preview={preview}
                onTutupPreview={tutupPreview}
                tautanTrip={tautan('biaya')}
              />
            )}
          </PanelTab>
        </>
      )}
    </>
  )
}

/** Satu baris per trip: apa saja yang dikeluarkan perusahaan untuk trip itu. */
function PengeluaranPerTrip({
  rows,
  awal,
  akhir,
  preview,
  onTutupPreview,
  tautanTrip,
}: {
  rows: BarisTrip[]
  awal: string
  akhir: string
  preview: boolean
  onTutupPreview: () => void
  tautanTrip: (tripId: string) => string
}) {
  const { workspace } = useWorkspace()
  const total = useMemo(() => ({
    uj: sum(rows, (r) => r.uj_total),
    termin: sum(rows, (r) => r.termin_count),
    kasbon: sum(rows, (r) => r.kasbon_total),
    biayaSopir: sum(rows, (r) => r.biaya_sopir),
    perusahaan: sum(rows, (r) => r.biaya_perusahaan),
    internal: sum(rows, (r) => r.internal_total),
    keluar: sum(rows, (r) => r.keluar),
    tagih: sum(rows, (r) => r.biaya_ditagihkan),
  }), [rows])
  const harian = useMemo(() => deretTanggal(awal, akhir, rows.map((r) => ({ tanggal: r.transaction_date, nilai: r.keluar }))), [awal, akhir, rows])

  const karawang = workspace === 'karawang'
  const periodeText = `${formatDate(awal)} s/d ${formatDate(akhir)}`
  const angka = (n: number) => (n ? formatRupiah(n) : '—')

  if (preview) {
    return (
      <ReportPreview onClose={onTutupPreview} onPrint={() => window.print()} orientasiAwal="lanskap">
        {(orientasi) => {
          const per = barisPerLembar(orientasi, 26)
          const pages = chunkRows(rows, per)
          return (
            <PrintDocument>
              {pages.map((isi, i) => (
                <PrintPage key={i} page={i + 1} totalPages={pages.length} title="Rekap Pengeluaran" subtitle="Per Trip · berdasarkan tanggal berangkat trip" periode={periodeText}
                  meta={[
                    { label: 'Jumlah trip', value: formatNumber(rows.length) },
                    { label: 'Total keluar', value: formatRupiah(total.keluar) },
                    { label: 'Ditagihkan ke klien', value: formatRupiah(total.tagih) },
                  ]}>
                  <PrintTable cols={[
                    { label: 'No.', align: 'right', width: '4%' }, { label: 'Tanggal', width: '8%' },
                    { label: karawang ? 'ID Trip' : 'No. Trip', width: karawang ? '11%' : '9%' },
                    { label: 'Mobil / Supir', width: '12%' }, { label: 'Rute' },
                    { label: 'Uang Jalan', align: 'right' }, { label: 'Potong Kasbon', align: 'right' }, { label: 'Biaya dari UJ', align: 'right' },
                    { label: 'Dibayar Prsh.', align: 'right' }, { label: 'Internal', align: 'right' }, { label: 'Total Keluar', align: 'right' },
                    { label: 'Ditagihkan', align: 'right' },
                  ]}>
                    {isi.map((r, ri) => (
                      <PRow key={r.id}>
                        <PCell align="right">{i * per + ri + 1}</PCell>
                        <PCell>{formatDate(r.transaction_date)}</PCell>
                        <PCell>{r.id_tampil}</PCell>
                        <PCell>{[r.plate_number, r.driver_names].filter(Boolean).join(' / ') || '-'}</PCell>
                        <PCell>{r.route_name || r.destination_detail || '-'}</PCell>
                        <PCell align="right">{r.uj_total ? formatNumber(r.uj_total) : '-'}</PCell>
                        <PCell align="right">{r.kasbon_total ? formatNumber(r.kasbon_total) : '-'}</PCell>
                        <PCell align="right">{r.biaya_sopir ? formatNumber(r.biaya_sopir) : '-'}</PCell>
                        <PCell align="right">{r.biaya_perusahaan ? formatNumber(r.biaya_perusahaan) : '-'}</PCell>
                        <PCell align="right">{r.internal_total ? formatNumber(r.internal_total) : '-'}</PCell>
                        <PCell align="right" bold>{formatNumber(r.keluar)}</PCell>
                        <PCell align="right">{r.biaya_ditagihkan ? formatNumber(r.biaya_ditagihkan) : '-'}</PCell>
                      </PRow>
                    ))}
                    {i === pages.length - 1 && (
                      <PRow tone="total">
                        <PCell align="right" colSpan={5}>TOTAL</PCell>
                        <PCell align="right">{formatNumber(total.uj)}</PCell>
                        <PCell align="right">{formatNumber(total.kasbon)}</PCell>
                        <PCell align="right">{formatNumber(total.biayaSopir)}</PCell>
                        <PCell align="right">{formatNumber(total.perusahaan)}</PCell>
                        <PCell align="right">{formatNumber(total.internal)}</PCell>
                        <PCell align="right">{formatNumber(total.keluar)}</PCell>
                        <PCell align="right">{formatNumber(total.tagih)}</PCell>
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

  const adaHarian = harian.values.some((v) => v > 0)
  const kolom = ['Trip', 'Mobil · Supir', 'Uang Jalan', 'Potong Kasbon', 'Biaya dari UJ', 'Dibayar Prsh.', 'Biaya Internal', 'Total Keluar', 'Ditagihkan ke Klien']

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><FaTruckFast size={15} className="text-brand-600" />Per Trip</span>}
        subtitle={`${formatNumber(rows.length)} trip berangkat pada ${periodeText}. Dihitung dari tanggal berangkat trip.`}
      />

      <div className="grid gap-6 border-b border-hairline p-4 lg:grid-cols-2">
        <Komposisi total={total} />
        <section aria-label="Grafik total keluar">
          <JudulDiagram
            judul={harian.perBulan ? 'Total keluar per bulan' : 'Total keluar per hari'}
            keterangan="Uang jalan + dibayar perusahaan + biaya internal, menurut tanggal berangkat trip."
          />
          {adaHarian
            ? <LineChart labels={harian.labels} series={[{ name: 'Total keluar', color: VIZ.ink2, values: harian.values }]} height={190} />
            : <p className="py-10 text-center text-[12.5px] text-ink-3">Belum ada pengeluaran pada periode ini.</p>}
        </section>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada trip pada periode tersebut.</p>
      ) : (
        <>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-sunken">
                <tr>
                  {kolom.map((h, i) => <th key={h} className={cn(KELAS_TH, i >= 2 ? 'text-right' : 'text-left')}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                    <td className="px-4 py-2 leading-tight">
                      <Link to={tautanTrip(r.id)} className="tnum font-semibold whitespace-nowrap text-brand-700 hover:underline">{r.id_tampil}</Link>
                      <span className="tnum block text-xs text-ink-3">{formatDate(r.transaction_date)} · {r.route_name || r.destination_detail || '—'}</span>
                    </td>
                    <td className="px-4 py-2 leading-tight text-ink-2">
                      <span className="tnum block whitespace-nowrap">{r.plate_number || '—'}</span>
                      <span className="block text-xs text-ink-3">{r.driver_names || '—'}</span>
                    </td>
                    <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">
                      {r.uj_total ? <>{formatRupiah(r.uj_total)}<span className="ml-1 text-[11px] text-ink-3">{r.termin_count}×</span></> : '—'}
                    </td>
                    <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-3">{angka(r.kasbon_total)}</td>
                    <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-3">{angka(r.biaya_sopir)}</td>
                    <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">{angka(r.biaya_perusahaan)}</td>
                    <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">{angka(r.internal_total)}</td>
                    <td className="tnum px-4 py-2 text-right font-semibold whitespace-nowrap text-ink">{formatRupiah(r.keluar)}</td>
                    <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">{angka(r.biaya_ditagihkan)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-sunken">
                <tr className="font-semibold text-ink">
                  <td colSpan={2} className="px-4 py-2 whitespace-nowrap" style={GARIS_TOTAL}>Total · {formatNumber(rows.length)} trip</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>
                    {formatRupiah(total.uj)}<span className="ml-1 text-[11px] font-normal text-ink-3">{formatNumber(total.termin)}×</span>
                  </td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.kasbon)}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.biayaSopir)}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.perusahaan)}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.internal)}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.keluar)}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.tagih)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="border-t border-hairline px-4 py-2.5 text-[12px] leading-relaxed text-ink-3">
            Total Keluar = Uang Jalan + Dibayar Prsh. + Biaya Internal. Potong Kasbon dan Biaya dari UJ hanya keterangan (sudah termasuk
            di Uang Jalan); angka “×” = jumlah termin. Ditagihkan ke Klien = biaya di jalan yang ditagih kembali lewat PI.
          </p>
        </>
      )}
    </Card>
  )
}

/** Komposisi uang keluar periode ini, dan bagian yang ditagih kembali ke klien. */
function Komposisi({ total }: { total: { uj: number; perusahaan: number; internal: number; keluar: number; tagih: number } }) {
  const bagian = [
    { kunci: 'uj', label: 'Uang Jalan', nilai: total.uj, warna: WARNA.uj },
    { kunci: 'perusahaan', label: 'Dibayar Perusahaan', nilai: total.perusahaan, warna: WARNA.perusahaan },
    { kunci: 'internal', label: 'Biaya Internal', nilai: total.internal, warna: WARNA.internal },
  ]
  const persen = (n: number) => (total.keluar > 0 ? (n / total.keluar) * 100 : 0)
  const tulis = (n: number) => { const p = persen(n); return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%` }

  return (
    <section aria-label="Komposisi pengeluaran">
      <JudulDiagram judul="Komposisi pengeluaran" keterangan="Total keluar = Uang Jalan + Dibayar Perusahaan + Biaya Internal." />
      {total.keluar <= 0 ? (
        <p className="py-10 text-center text-[12.5px] text-ink-3">Belum ada pengeluaran pada periode ini.</p>
      ) : (
        <>
          {/* Batang 100%: tiap bagian dipisah celah 2px, bukan garis. */}
          <div className="flex gap-[2px] overflow-hidden" style={{ height: 14, borderRadius: 4 }} role="img"
            aria-label={`Komposisi: ${bagian.map((b) => `${b.label} ${tulis(b.nilai)}`).join(', ')}`}>
            {bagian.filter((b) => b.nilai > 0).map((b) => (
              <span key={b.kunci} title={`${b.label}: ${formatRupiah(b.nilai)} (${tulis(b.nilai)})`}
                style={{ width: `${persen(b.nilai)}%`, minWidth: 3, background: b.warna }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-[12.5px]">
            {bagian.map((b) => (
              <li key={b.kunci} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-ink-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: b.warna }} aria-hidden="true" />
                  {b.label}
                </span>
                <span className="tnum shrink-0 whitespace-nowrap text-ink">
                  <span className="font-semibold">{formatRupiah(b.nilai)}</span>
                  <span className="ml-1.5 inline-block w-9 text-right text-ink-3">{tulis(b.nilai)}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-hairline pt-1.5 font-semibold text-ink">
              <span>Total keluar</span>
              <span className="tnum whitespace-nowrap">{formatRupiah(total.keluar)}<span className="ml-1.5 inline-block w-9" /></span>
            </li>
          </ul>

          <div className="mt-4 rounded-lg border border-hairline bg-sunken px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px]">
              <span className="flex items-center gap-2 text-ink-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: WARNA.tagih }} aria-hidden="true" />
                Ditagihkan ke klien
              </span>
              <span className="tnum whitespace-nowrap text-ink">
                <span className="font-semibold">{formatRupiah(total.tagih)}</span>
                <span className="ml-1.5 text-ink-3">{tulis(total.tagih)} dari total keluar</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-grid" role="img" aria-label={`Ditagihkan ke klien ${tulis(total.tagih)} dari total keluar`}>
              <span className="block h-full rounded-full" style={{ width: `${Math.min(100, persen(total.tagih))}%`, background: WARNA.tagih }} />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">
              Biaya di jalan yang ditagih kembali ke klien lewat PI (Additional Cost); sisanya ditanggung perusahaan.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
