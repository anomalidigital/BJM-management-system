import { useMemo, useState } from 'react'
import { Eye, Printer, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, DateInput, Radio, FieldError } from '../components/ui/Field'
import { StatCard } from '../components/ui/StatCard'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { nettoTransaksi, pendapatanTransaksi, ringkas } from '../lib/calculations'
import { endOfMonthISO, formatDate, formatNumber, formatRupiah, startOfMonthISO } from '../lib/format'
import { groupBy } from '../lib/utils'

type Mode = 'perMobil' | 'global'

export function LapNettoPage() {
  const { transactionRows } = useData()
  const toast = useToast()

  const [from, setFrom] = useState(startOfMonthISO())
  const [to, setTo] = useState(endOfMonthISO())
  const [mode, setMode] = useState<Mode>('perMobil')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const rows = useMemo(
    () => transactionRows.filter((t) => t.transaction_date >= from && t.transaction_date <= to),
    [transactionRows, from, to],
  )
  const totals = useMemo(() => ringkas(rows), [rows])

  /** Rekap per nomor polisi. */
  const perMobil = useMemo(() => {
    const grouped = groupBy(rows.filter((t) => t.plate_number), (t) => t.plate_number)
    return Object.entries(grouped)
      .map(([plate, group]) => ({
        plate,
        ritan: group.length,
        pendapatan: group.reduce((a, r) => a + pendapatanTransaksi(r), 0),
        ujroute: group.reduce((a, r) => a + r.ujroute, 0),
        komisi: group.reduce((a, r) => a + r.commissioner, 0),
        netto: group.reduce((a, r) => a + nettoTransaksi(r), 0),
      }))
      .sort((a, b) => b.netto - a.netto)
  }, [rows])

  function openPreview() {
    if (from > to) { setError('Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.'); return }
    if (rows.length === 0) {
      setError('Tidak ada transaksi pada periode tersebut.')
      toast.info('Tidak ada data untuk ditampilkan.')
      return
    }
    setError(null); setPreview(true)
  }

  const periodeText = `${formatDate(from)} s/d ${formatDate(to)}`
  const metaTotals = [
    { label: 'Jumlah transaksi', value: formatNumber(totals.transaksi) },
    { label: 'Total pendapatan', value: formatRupiah(totals.pendapatan) },
    { label: 'Total netto', value: formatRupiah(totals.netto) },
  ]

  if (preview && mode === 'perMobil') {
    const pages = chunkRows(perMobil, 26)
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        <PrintDocument>
          {pages.map((pageRows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={pages.length}
              title="Pendapatan Netto per Mobil" subtitle="Rekap per nomor polisi" periode={periodeText} meta={metaTotals}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '6%' },
                  { label: 'No. Mobil', width: '16%' },
                  { label: 'Ritan', align: 'right', width: '10%' },
                  { label: 'Pendapatan', align: 'right' },
                  { label: 'UjRoute', align: 'right' },
                  { label: 'Komisioner', align: 'right' },
                  { label: 'Netto (Rp)', align: 'right' },
                ]}
              >
                {pageRows.map((r, ri) => (
                  <PRow key={r.plate}>
                    <PCell align="right">{i * 26 + ri + 1}</PCell>
                    <PCell bold>{r.plate}</PCell>
                    <PCell align="right">{formatNumber(r.ritan)}</PCell>
                    <PCell align="right">{formatNumber(r.pendapatan)}</PCell>
                    <PCell align="right">{formatNumber(r.ujroute)}</PCell>
                    <PCell align="right">{formatNumber(r.komisi)}</PCell>
                    <PCell align="right" bold>{formatNumber(r.netto)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={2}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(totals.ritan)}</PCell>
                    <PCell align="right">{formatNumber(totals.pendapatan)}</PCell>
                    <PCell align="right">{formatNumber(totals.ujroute)}</PCell>
                    <PCell align="right">{formatNumber(totals.komisi)}</PCell>
                    <PCell align="right">{formatNumber(totals.netto)}</PCell>
                  </PRow>
                )}
              </PrintTable>
              {i === pages.length - 1 && (
                <p className="mt-3 text-[9px] text-neutral-600">
                  Netto memakai formula sementara TBD-03: Harga Route - UjRoute - Komisioner.
                </p>
              )}
            </PrintPage>
          ))}
        </PrintDocument>
      </ReportPreview>
    )
  }

  if (preview) {
    const perDay = Object.entries(groupBy(rows, (t) => t.transaction_date))
      .map(([date, group]) => ({
        date,
        ritan: group.length,
        pendapatan: group.reduce((a, r) => a + pendapatanTransaksi(r), 0),
        netto: group.reduce((a, r) => a + nettoTransaksi(r), 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const pages = chunkRows(perDay, 28)
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        <PrintDocument>
          {pages.map((pageRows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={pages.length}
              title="Pendapatan Netto GLOBAL" subtitle="Rekap harian seluruh armada" periode={periodeText} meta={metaTotals}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '8%' },
                  { label: 'Tanggal', width: '22%' },
                  { label: 'Jumlah Ritan', align: 'right' },
                  { label: 'Pendapatan (Rp)', align: 'right' },
                  { label: 'Netto (Rp)', align: 'right' },
                ]}
              >
                {pageRows.map((r, ri) => (
                  <PRow key={r.date}>
                    <PCell align="right">{i * 28 + ri + 1}</PCell>
                    <PCell>{formatDate(r.date)}</PCell>
                    <PCell align="right">{formatNumber(r.ritan)}</PCell>
                    <PCell align="right">{formatNumber(r.pendapatan)}</PCell>
                    <PCell align="right" bold>{formatNumber(r.netto)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={2}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(totals.ritan)}</PCell>
                    <PCell align="right">{formatNumber(totals.pendapatan)}</PCell>
                    <PCell align="right">{formatNumber(totals.netto)}</PCell>
                  </PRow>
                )}
              </PrintTable>
              {i === pages.length - 1 && (
                <p className="mt-3 text-[9px] text-neutral-600">
                  Netto memakai formula sementara TBD-03: Harga Route - UjRoute - Komisioner.
                </p>
              )}
            </PrintPage>
          ))}
        </PrintDocument>
      </ReportPreview>
    )
  }

  return (
    <>
      <PageHeader
        title="Pendapatan Netto Bulan Berjalan"
        legacyTitle="Pendapatan Netto Bulan Berjalan"
        crumbs={[{ label: 'Lap. Bulan Ini' }, { label: 'Netto Bulan Berjalan' }]}
        description="Pilih periode dan tipe laporan, buka preview, lalu cetak atau simpan sebagai PDF."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Periode" subtitle="Rentang tanggal transaksi." />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Awal" required>{(id) => <DateInput id={id} value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
              <Field label="Tanggal Akhir" required>{(id) => <DateInput id={id} value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Tipe Laporan</p>
              <div className="space-y-2">
                <Radio
                  name="netto-mode" label="Cetak Pendapatan Netto perMobil" description="Satu baris per nomor polisi."
                  checked={mode === 'perMobil'} onChange={() => { setMode('perMobil'); setError(null) }}
                />
                <Radio
                  name="netto-mode" label="Cetak Pendapatan Netto GLOBAL" description="Rekap harian seluruh armada."
                  checked={mode === 'global'} onChange={() => { setMode('global'); setError(null) }}
                />
              </div>
            </div>

            {error && <FieldError>{error}</FieldError>}

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button variant="primary" icon={<Eye size={15} />} onClick={openPreview}>Preview</Button>
              <Button icon={<Printer size={15} />} onClick={openPreview}>Cetak</Button>
              <Button variant="ghost" icon={<X size={14} />} onClick={() => { setFrom(startOfMonthISO()); setTo(endOfMonthISO()); setMode('perMobil'); setError(null) }}>Batal</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Pendapatan" value={formatRupiah(totals.pendapatan, { compact: true })} hint="TBD-02" />
            <StatCard label="Total UjRoute" value={formatRupiah(totals.ujroute, { compact: true })} hint="Master Route" />
            <StatCard label="Total Komisioner" value={formatRupiah(totals.komisi, { compact: true })} hint="TBD-01" />
            <StatCard label="Pendapatan Netto" value={formatRupiah(totals.netto, { compact: true })} hint="TBD-03" />
          </div>

          <Card>
            <CardHeader title="Rekap per Mobil" subtitle={`${perMobil.length} mobil aktif pada periode ${periodeText}.`} />
            <div className="max-h-[420px] overflow-y-auto">
              {perMobil.length === 0 ? (
                <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada transaksi pada periode tersebut.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-sunken">
                    <tr className="border-b border-hairline">
                      <th className="px-4 py-2 text-left text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">No. Mobil</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Ritan</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Pendapatan</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perMobil.map((r) => (
                      <tr key={r.plate} className="border-b border-grid last:border-0 hover:bg-sunken">
                        <td className="tnum px-4 py-2 font-medium text-ink">{r.plate}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{r.ritan}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{formatRupiah(r.pendapatan)}</td>
                        <td className="tnum px-4 py-2 text-right font-semibold text-ink">{formatRupiah(r.netto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
