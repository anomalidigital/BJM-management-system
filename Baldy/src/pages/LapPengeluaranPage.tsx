import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FaEye, FaPrint, FaXmark } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Field, DateInput, FieldError } from '../components/ui/Field'
import { StatCard } from '../components/ui/StatCard'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { tripDihitung } from '../lib/calculations'
import { formatDate, formatNumber, formatRupiah } from '../lib/format'
import { usePeriodeDefault } from '../lib/periode'
import { LapUangJalanPage } from './LapUangJalanPage'
import { LapBiayaPage } from './LapBiayaPage'

const TAB_IDS = ['trip', 'uj', 'biaya'] as const
type TabId = (typeof TAB_IDS)[number]

/**
 * Laporan -> Pengeluaran (susunan menu atasan): seluruh uang yang keluar untuk trip.
 * Tab Per trip = uang jalan + biaya yang dibayar perusahaan + biaya internal per trip;
 * tab Uang Jalan dan Biaya Operasional adalah rekap lama yang kini menjadi bagiannya.
 */
export function LapPengeluaranPage() {
  const [params, setParams] = useSearchParams()
  const awal = params.get('tab')
  const [tab, setTab] = useState<TabId>(TAB_IDS.includes(awal as TabId) ? (awal as TabId) : 'trip')

  function gantiTab(t: string) {
    setTab(t as TabId)
    const p = new URLSearchParams(params)
    if (t === 'trip') p.delete('tab')
    else p.set('tab', t)
    setParams(p, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Pengeluaran"
        crumbs={[{ label: 'Laporan' }, { label: 'Pengeluaran' }]}
        description="Uang yang keluar untuk trip: uang jalan ke sopir, biaya yang dibayar perusahaan langsung, dan biaya internal."
      />
      <Card className="mb-4">
        <Tabs
          value={tab}
          onChange={gantiTab}
          className="px-2"
          items={[{ id: 'trip', label: 'Per trip' }, { id: 'uj', label: 'Uang Jalan' }, { id: 'biaya', label: 'Biaya Operasional' }]}
        />
      </Card>
      {tab === 'trip' && <PengeluaranPerTrip />}
      {tab === 'uj' && <LapUangJalanPage tertanam />}
      {tab === 'biaya' && <LapBiayaPage tertanam />}
    </>
  )
}

/** Satu baris per trip: apa saja yang dikeluarkan perusahaan untuk trip itu. */
function PengeluaranPerTrip() {
  const { transactionRows } = useData()
  const toast = useToast()
  const { from, setFrom, to, setTo, reset } = usePeriodeDefault(transactionRows.map((t) => t.transaction_date))
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const rows = useMemo(
    () => transactionRows
      .filter((t) => tripDihitung(t) && t.transaction_date >= from && t.transaction_date <= to)
      .map((t) => ({
        ...t,
        // Biaya yang dibayar sopir dari uang jalan tidak dihitung lagi: sudah ada di uang jalan.
        biaya_sopir: t.expense_total - t.biaya_perusahaan,
        keluar: t.uj_total + t.biaya_perusahaan + t.internal_total,
      }))
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.transaction_no.localeCompare(b.transaction_no)),
    [transactionRows, from, to],
  )
  const total = useMemo(() => ({
    uj: rows.reduce((a, r) => a + r.uj_total, 0),
    biayaSopir: rows.reduce((a, r) => a + r.biaya_sopir, 0),
    perusahaan: rows.reduce((a, r) => a + r.biaya_perusahaan, 0),
    internal: rows.reduce((a, r) => a + r.internal_total, 0),
    keluar: rows.reduce((a, r) => a + r.keluar, 0),
  }), [rows])
  const periodeText = `${formatDate(from)} s/d ${formatDate(to)}`

  function openPreview() {
    if (from > to) { setError('Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.'); return }
    if (rows.length === 0) { setError('Tidak ada trip pada periode tersebut.'); toast.info('Tidak ada data untuk ditampilkan.'); return }
    setError(null); setPreview(true)
  }

  if (preview) {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()} orientasiAwal="lanskap">
        {(orientasi) => {
          const per = barisPerLembar(orientasi, 26)
          const pages = chunkRows(rows, per)
          return (
            <PrintDocument>
              {pages.map((isi, i) => (
                <PrintPage key={i} page={i + 1} totalPages={pages.length} title="Laporan Pengeluaran" subtitle="Per trip" periode={periodeText}
                  meta={[
                    { label: 'Jumlah trip', value: formatNumber(rows.length) },
                    { label: 'Uang jalan', value: formatRupiah(total.uj) },
                    { label: 'Total keluar', value: formatRupiah(total.keluar) },
                  ]}>
                  <PrintTable cols={[
                    { label: 'No.', align: 'right', width: '4%' }, { label: 'Tanggal', width: '9%' }, { label: 'No. Trip', width: '10%' },
                    { label: 'Mobil', width: '10%' }, { label: 'Sopir', width: '12%' }, { label: 'Rute' },
                    { label: 'Uang Jalan', align: 'right' }, { label: 'Biaya dari UJ', align: 'right' }, { label: 'Dibayar Prsh.', align: 'right' },
                    { label: 'Internal', align: 'right' }, { label: 'Total Keluar', align: 'right' },
                  ]}>
                    {isi.map((r, ri) => (
                      <PRow key={r.id}>
                        <PCell align="right">{i * per + ri + 1}</PCell>
                        <PCell>{formatDate(r.transaction_date)}</PCell>
                        <PCell>{r.transaction_no}</PCell>
                        <PCell>{r.plate_number || '-'}</PCell>
                        <PCell>{r.driver_names || '-'}</PCell>
                        <PCell>{r.route_name || r.destination_detail || '-'}</PCell>
                        <PCell align="right">{formatNumber(r.uj_total)}</PCell>
                        <PCell align="right">{formatNumber(r.biaya_sopir)}</PCell>
                        <PCell align="right">{formatNumber(r.biaya_perusahaan)}</PCell>
                        <PCell align="right">{formatNumber(r.internal_total)}</PCell>
                        <PCell align="right" bold>{formatNumber(r.keluar)}</PCell>
                      </PRow>
                    ))}
                    {i === pages.length - 1 && (
                      <PRow tone="total">
                        <PCell align="right" colSpan={6}>TOTAL</PCell>
                        <PCell align="right">{formatNumber(total.uj)}</PCell>
                        <PCell align="right">{formatNumber(total.biayaSopir)}</PCell>
                        <PCell align="right">{formatNumber(total.perusahaan)}</PCell>
                        <PCell align="right">{formatNumber(total.internal)}</PCell>
                        <PCell align="right">{formatNumber(total.keluar)}</PCell>
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader title="Periode" subtitle="Berdasarkan tanggal berangkat trip." />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal Awal" required>{(id) => <DateInput id={id} value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
            <Field label="Tanggal Akhir" required>{(id) => <DateInput id={id} value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Total keluar = uang jalan + biaya yang dibayar perusahaan langsung + biaya internal. Biaya yang dibayar sopir dari uang jalan
            hanya ditampilkan sebagai nota (sudah termasuk uang jalan).
          </p>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
            <Button variant="primary" icon={<FaEye size={15} />} onClick={openPreview}>Preview</Button>
            <Button icon={<FaPrint size={15} />} onClick={openPreview}>Cetak</Button>
            <Button variant="ghost" icon={<FaXmark size={14} />} onClick={() => { reset(); setError(null) }}>Batal</Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Uang Jalan" value={formatRupiah(total.uj, { compact: true })} hint={`${formatNumber(rows.length)} trip`} />
          <StatCard label="Dibayar Perusahaan" value={formatRupiah(total.perusahaan, { compact: true })} hint="solar / tol di luar uang jalan" />
          <StatCard label="Biaya Internal" value={formatRupiah(total.internal, { compact: true })} hint="servis, kernet, uang makan" />
          <StatCard label="Total Keluar" value={formatRupiah(total.keluar, { compact: true })} hint="periode terpilih" />
        </div>
        <Card>
          <CardHeader title="Per trip" subtitle={`${rows.length} trip pada periode ${periodeText}.`} />
          <div className="max-h-[480px] overflow-y-auto">
            {rows.length === 0 ? (
              <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada trip pada periode tersebut.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-sunken">
                  <tr className="border-b border-hairline">
                    {['Trip', 'Mobil · Sopir', 'Uang Jalan', 'Biaya dari UJ', 'Dibayar Prsh.', 'Internal', 'Total Keluar'].map((h, i) => (
                      <th key={h} className={`px-4 py-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                      <td className="px-4 py-2 leading-tight">
                        <Link to={`/transaksi/trip/${r.id}`} className="tnum font-semibold text-brand-700 hover:underline">{r.transaction_no}</Link>
                        <span className="tnum block text-xs text-ink-3">{formatDate(r.transaction_date)} · {r.route_name || r.destination_detail || '—'}</span>
                      </td>
                      <td className="px-4 py-2 leading-tight text-ink-2">
                        <span className="tnum block">{r.plate_number || '—'}</span>
                        <span className="block text-xs text-ink-3">{r.driver_names || '—'}</span>
                      </td>
                      <td className="tnum px-4 py-2 text-right text-ink-2">{formatRupiah(r.uj_total)}</td>
                      <td className="tnum px-4 py-2 text-right text-ink-3">{r.biaya_sopir ? formatRupiah(r.biaya_sopir) : '—'}</td>
                      <td className="tnum px-4 py-2 text-right text-ink-2">{r.biaya_perusahaan ? formatRupiah(r.biaya_perusahaan) : '—'}</td>
                      <td className="tnum px-4 py-2 text-right text-ink-2">{r.internal_total ? formatRupiah(r.internal_total) : '—'}</td>
                      <td className="tnum px-4 py-2 text-right font-semibold text-ink">{formatRupiah(r.keluar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
