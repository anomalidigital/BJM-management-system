import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FaPrint } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Field, DateInput, FieldError } from '../components/ui/Field'
import { PanelFilter, Toolbar } from '../components/ui/Toolbar'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { StatCard } from '../components/ui/StatCard'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { useToast } from '../store/ToastProvider'
import { komisiTransaksi, ringkas, tripDihitung } from '../lib/calculations'
import { formatDate, formatNumber, formatRupiah, galatRentang, rentangTanggal } from '../lib/format'
import { useFilter } from '../lib/useFilter'
import { groupBy } from '../lib/utils'
import { usePeriodeDefault } from '../lib/periode'
import type { TransactionRow } from '../types'
import { KomisiPage } from './KomisiPage'

/** Jenis cetak: rincian satu supir, rincian seluruh supir, atau rekap satu baris per supir. */
type Mode = 'perSopir' | 'semuaSopir' | 'global'

const TAB_IDS = ['laporan', 'aturan'] as const
type TabId = (typeof TAB_IDS)[number]

/**
 * Laporan -> Komisi: laporan komisi supir dan aturan tarifnya di satu tempat.
 * Tab Laporan = cetak komisi per periode; tab Aturan = aturan komisi yang dipakai
 * menghitung komisi setiap trip (dulu menu Master Data -> Aturan Komisi).
 */
export function LapKomisiPage() {
  const [params, setParams] = useSearchParams()
  // Tab dibaca langsung dari alamat, supaya tautan ?tab=aturan (mis. dari alamat lama
  // Master Data -> Aturan Komisi) dan klik menu Komisi selalu cocok dengan isinya.
  const dariUrl = params.get('tab')
  const tab: TabId = TAB_IDS.includes(dariUrl as TabId) ? (dariUrl as TabId) : 'laporan'

  function gantiTab(t: string) {
    const p = new URLSearchParams(params)
    if (t === 'laporan') p.delete('tab')
    else p.set('tab', t)
    setParams(p, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Komisi"
        crumbs={[{ label: 'Laporan' }, { label: 'Komisi' }]}
        description="Perhitungan otomatis komisi berdasarkan formula pengaturan."
      />
      <Card className="mb-4">
        <Tabs
          value={tab}
          onChange={gantiTab}
          className="px-2"
          items={[{ id: 'laporan', label: 'Laporan' }, { id: 'aturan', label: 'Aturan' }]}
        />
      </Card>
      {tab === 'laporan' && <LaporanKomisi />}
      {tab === 'aturan' && <KomisiPage tertanam />}
    </>
  )
}

/** Tab Laporan: cetak komisi bulan berjalan (per supir, seluruh supir, atau rekap global). */
function LaporanKomisi() {
  const { db, transactionRows } = useData()
  // Penanda trip = Kode Trip (ID Trip Karawang, No. Trip / NoTrans Priok).
  const karawang = useWorkspace().workspace === 'karawang'
  const toast = useToast()

  const { from, setFrom, to, setTo, awal: awalBawaan, akhir: akhirBawaan } = usePeriodeDefault(transactionRows.map((t) => t.transaction_date))
  const [mode, setMode] = useState<Mode>('semuaSopir')
  const [driverId, setDriverId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const driverOptions = useMemo(
    () => db.drivers.map((d) => ({ value: d.id, label: `${d.driver_code} — ${d.driver_name}`, meta: `${d.address_2}, ${d.city}`, keywords: d.driver_name })),
    [db.drivers],
  )

  const rows = useMemo(
    () =>
      transactionRows
        .filter((t) => tripDihitung(t) && t.transaction_date >= from && t.transaction_date <= to)
        // Komisi trip diterima supir utama.
        .filter((t) => (driverId ? t.driver_id === driverId : true))
        .sort((a, b) => a.driver_name.localeCompare(b.driver_name) || a.transaction_date.localeCompare(b.transaction_date)),
    [transactionRows, from, to, driverId],
  )

  const totals = useMemo(() => ringkas(rows), [rows])
  const byDriver = useMemo(() => groupBy(rows, (t) => t.driver_id), [rows])

  /** Ringkasan satu baris per supir — dipakai mode Global. */
  const globalRows = useMemo(
    () =>
      Object.values(byDriver)
        .map((group) => ({
          // Trip yang belum diberi supir dikumpulkan di satu baris berlabel jelas, bukan "—".
          driver: group[0].driver_id ? `${group[0].driver_code} — ${group[0].driver_name}` : 'Belum ada supir (komisi menunggu supir diisi)',
          ritan: group.length,
          komisi: group.reduce((a, r) => a + komisiTransaksi(r), 0),
        }))
        .sort((a, b) => b.komisi - a.komisi),
    [byDriver],
  )

  /** Cetak: rekap per supir, rincian seluruh supir, atau rincian satu supir (bila disaring). */
  function bukaCetak(m: Mode) {
    setMode(m)
    if (m === 'perSopir' && !driverId) {
      setError('Pilih Supir wajib diisi untuk mode Cetak Komisi perSupir.')
      toast.error('Pilih supir terlebih dahulu.')
      return
    }
    if (from > to) {
      setError('Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.')
      return
    }
    if (rows.length === 0) {
      setError('Tidak ada transaksi pada periode tersebut.')
      toast.info('Tidak ada data untuk ditampilkan.')
      return
    }
    setError(null)
    setPreview(true)
  }

  const periodeDiubah = from !== awalBawaan || to !== akhirBawaan
  /** Periode & supir berdraf: baru berlaku setelah Terapkan. */
  const filter = useFilter({ dari: awalBawaan, sampai: akhirBawaan, supir: '' }, {
    nilai: { dari: from, sampai: to, supir: driverId ?? '' },
    terapkan: (v) => { setFrom(v.dari); setTo(v.sampai); setDriverId(v.supir || null); setError(null) },
  })
  const d = filter.draf

  const periodeText = `${formatDate(from)} s/d ${formatDate(to)}`
  const selectedDriver = db.drivers.find((d) => d.id === driverId)

  /* ── Preview: mode Global (ringkasan per supir) ────────────── */
  if (preview && mode === 'global') {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const per = barisPerLembar(orientasi, 28)
          const pages = chunkRows(globalRows, per)
          return (
        <PrintDocument>
          {pages.map((pageRows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={pages.length}
              title="Laporan Komisi Global" subtitle="Rekap komisi seluruh supir" periode={periodeText}
              meta={[
                { label: 'Jumlah supir', value: formatNumber(globalRows.length) },
                { label: 'Jumlah ritan', value: formatNumber(totals.ritan) },
                { label: 'Total komisi', value: formatRupiah(totals.komisi) },
              ]}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '8%' },
                  { label: 'Supir' },
                  { label: 'Jumlah Ritan', align: 'right', width: '18%' },
                  { label: 'Total Komisi (Rp)', align: 'right', width: '24%' },
                ]}
              >
                {pageRows.map((r, ri) => (
                  <PRow key={r.driver}>
                    <PCell align="right">{i * per + ri + 1}</PCell>
                    <PCell>{r.driver}</PCell>
                    <PCell align="right">{formatNumber(r.ritan)}</PCell>
                    <PCell align="right">{formatNumber(r.komisi)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={2}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(totals.ritan)}</PCell>
                    <PCell align="right">{formatNumber(totals.komisi)}</PCell>
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

  /* ── Preview: mode perSopir / semuaSopir (rincian transaksi) ─ */
  if (preview) {
    const title = mode === 'perSopir' ? 'Laporan Komisi per Supir' : 'Laporan Komisi Seluruh Supir'
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const per = barisPerLembar(orientasi, 24)
          const pages = chunkRows(rows, per)
          return (
        <PrintDocument>
          {pages.map((pageRows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={pages.length}
              title={title}
              subtitle={mode === 'perSopir' && selectedDriver ? `${selectedDriver.driver_code} — ${selectedDriver.driver_name}` : 'Rincian per transaksi'}
              periode={periodeText}
              meta={[
                { label: 'Jumlah transaksi', value: formatNumber(totals.transaksi) },
                { label: 'Jumlah ritan', value: formatNumber(totals.ritan) },
                { label: 'Total komisi', value: formatRupiah(totals.komisi) },
              ]}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '6%' },
                  karawang ? { label: 'ID Trip', width: '13%' } : { label: 'NoTrans', width: '13%' },
                  { label: 'Tanggal', width: '11%' },
                  { label: 'Supir' },
                  { label: 'No. Kendaraan', width: '13%' },
                  { label: 'Rute', width: karawang ? '14%' : '11%' },
                  { label: 'Komisi (Rp)', align: 'right', width: '15%' },
                ]}
              >
                {pageRows.map((t: TransactionRow, ri) => (
                  <PRow key={t.id}>
                    <PCell align="right">{i * per + ri + 1}</PCell>
                    <PCell>{t.id_tampil}</PCell>
                    <PCell>{formatDate(t.transaction_date)}</PCell>
                    <PCell>{t.driver_name}</PCell>
                    <PCell>{t.plate_number}</PCell>
                    {/* Kode rute Karawang bisa berupa kode acak panjang; nama rute lebih mudah dibaca. */}
                    <PCell>{karawang ? t.route_name || t.route_code : t.route_code}</PCell>
                    <PCell align="right">{formatNumber(komisiTransaksi(t))}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={6}>TOTAL KOMISI</PCell>
                    <PCell align="right">{formatNumber(totals.komisi)}</PCell>
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

  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Transaksi pada periode" value={formatNumber(totals.transaksi)} hint={periodeText} />
        <StatCard label="Jumlah Ritan" value={formatNumber(totals.ritan)} hint="1 transaksi = 1 ritan" />
        <StatCard label="Total Komisi" value={formatRupiah(totals.komisi)} hint={selectedDriver ? selectedDriver.driver_name : 'seluruh supir'} />
      </div>

      <Card>
        <Toolbar
          left={
            <>
              <PanelFilter filter={filter} galat={galatRentang(d.dari, d.sampai)} chips={[
                { label: `Periode ${rentangTanggal(from, to)}`, lepas: periodeDiubah ? () => filter.lepas('dari', 'sampai') : undefined },
                selectedDriver && { label: `Supir: ${selectedDriver.driver_name}`, lepas: () => filter.lepas('supir') },
              ]}>
                <div>
                  <p className="form-label">Periode (tanggal berangkat trip)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <DateInput value={d.dari} onChange={(e) => filter.ubah({ dari: e.target.value })} aria-label="Tanggal awal" />
                    <DateInput value={d.sampai} onChange={(e) => filter.ubah({ sampai: e.target.value })} aria-label="Tanggal akhir" />
                  </div>
                </div>
                <Field label="Supir" hint="Kosongkan untuk seluruh supir.">
                  {(id) => (
                    <SearchableSelect id={id} options={driverOptions} value={d.supir || null}
                      placeholder="Seluruh supir" searchPlaceholder="Cari kode atau nama supir..." onChange={(v) => filter.ubah({ supir: v ?? '' })} />
                  )}
                </Field>
              </PanelFilter>
            </>
          }
          right={
            // Supir dipilih: hanya satu laporan (komisi supir itu). Seluruh supir: rekap per supir atau rincian transaksi.
            driverId ? (
              <Button size="sm" icon={<FaPrint size={14} />} onClick={() => bukaCetak('perSopir')}>Cetak Komisi Supir</Button>
            ) : (
              <>
                <Button size="sm" icon={<FaPrint size={14} />} onClick={() => bukaCetak('global')}>Cetak Rekap</Button>
                <Button size="sm" icon={<FaPrint size={14} />} onClick={() => bukaCetak('semuaSopir')}>Cetak Rincian</Button>
              </>
            )
          }
        />
        {error && <div className="border-b border-hairline px-4 py-2"><FieldError>{error}</FieldError></div>}
        {globalRows.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada transaksi pada periode tersebut.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-hover">
              <thead>
                <tr><th>Supir</th><th className="text-right">Jumlah Ritan</th><th className="text-right">Total Komisi</th></tr>
              </thead>
              <tbody>
                {globalRows.map((r) => (
                  <tr key={r.driver}>
                    <td className="font-medium text-ink">{r.driver}</td>
                    <td className="tnum text-right text-ink-2">{formatNumber(r.ritan)}</td>
                    <td className="tnum text-right font-semibold text-ink">{formatRupiah(r.komisi)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total {formatNumber(globalRows.length)} supir</td>
                  <td className="tnum text-right">{formatNumber(totals.ritan)}</td>
                  <td className="tnum text-right">{formatRupiah(totals.komisi)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-hairline px-4 py-2.5 text-[12px] text-ink-3">
          Komisi dihitung otomatis dari tab Aturan untuk trip yang berangkat pada periode ini (trip batal tidak dihitung). Penerimanya supir utama.
        </p>
      </Card>
    </>
  )
}
