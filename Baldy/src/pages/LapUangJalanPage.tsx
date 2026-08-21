import { useMemo, useState } from 'react'
import { Eye, Printer, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, DateInput, Radio, FieldError } from '../components/ui/Field'
import { StatCard } from '../components/ui/StatCard'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { formatDate, formatNumber, formatRupiah } from '../lib/format'
import { groupBy } from '../lib/utils'
import { usePeriodeDefault } from '../lib/periode'

type Mode = 'perSopir' | 'perTermin'

export function LapUangJalanPage() {
  const { db, transactionRows } = useData()
  const toast = useToast()
  const { from, setFrom, to, setTo, reset: resetPeriode } = usePeriodeDefault(db.ujPayments.map((p) => p.payment_date))
  const [mode, setMode] = useState<Mode>('perSopir')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const tripById = useMemo(() => new Map(transactionRows.map((t) => [t.id, t])), [transactionRows])

  /** Termin dalam periode, sudah digabung dengan data trip-nya. */
  const termin = useMemo(
    () =>
      db.ujPayments
        .filter((p) => p.payment_date >= from && p.payment_date <= to)
        .map((p) => ({ ...p, trip: tripById.get(p.trip_id) }))
        .filter((p) => p.trip)
        .sort((a, b) => a.payment_date.localeCompare(b.payment_date)),
    [db.ujPayments, from, to, tripById],
  )

  const total = useMemo(() => ({
    uj: termin.reduce((a, p) => a + p.uj_amount, 0),
    kasbon: termin.reduce((a, p) => a + p.kasbon_deduction, 0),
    tf: termin.reduce((a, p) => a + p.uj_amount - p.kasbon_deduction, 0),
    n: termin.length,
  }), [termin])

  const perSopir = useMemo(() => {
    const g = groupBy(termin, (p) => p.trip!.driver_id || 'tanpa')
    return Object.values(g)
      .map((rows) => ({
        sopir: rows[0].trip!.driver_name ? `${rows[0].trip!.driver_code} — ${rows[0].trip!.driver_name}` : 'Tanpa sopir',
        termin: rows.length,
        trip: new Set(rows.map((r) => r.trip_id)).size,
        uj: rows.reduce((a, r) => a + r.uj_amount, 0),
        kasbon: rows.reduce((a, r) => a + r.kasbon_deduction, 0),
        tf: rows.reduce((a, r) => a + r.uj_amount - r.kasbon_deduction, 0),
      }))
      .sort((a, b) => b.uj - a.uj)
  }, [termin])

  function openPreview() {
    if (from > to) { setError('Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.'); return }
    if (termin.length === 0) { setError('Tidak ada pembayaran uang jalan pada periode tersebut.'); toast.info('Tidak ada data untuk ditampilkan.'); return }
    setError(null); setPreview(true)
  }

  const periodeText = `${formatDate(from)} s/d ${formatDate(to)}`
  const meta = [
    { label: 'Jumlah termin', value: formatNumber(total.n) },
    { label: 'Total UJ', value: formatRupiah(total.uj) },
    { label: 'Total TF ke sopir', value: formatRupiah(total.tf) },
  ]

  if (preview && mode === 'perSopir') {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const pages = chunkRows(perSopir, barisPerLembar(orientasi, 26))
          return (
        <PrintDocument>
          {pages.map((rows, i) => (
            <PrintPage key={i} page={i + 1} totalPages={pages.length}
              title="Rekap Uang Jalan per Sopir" subtitle="Berdasarkan tanggal pembayaran termin" periode={periodeText} meta={meta}>
              <PrintTable cols={[
                { label: 'No.', align: 'right', width: '6%' }, { label: 'Sopir' },
                { label: 'Trip', align: 'right', width: '9%' }, { label: 'Termin', align: 'right', width: '9%' },
                { label: 'UJ (Rp)', align: 'right' }, { label: 'Potong Kasbon (Rp)', align: 'right' }, { label: 'TF (Rp)', align: 'right' },
              ]}>
                {rows.map((r, ri) => (
                  <PRow key={r.sopir}>
                    <PCell align="right">{i * 26 + ri + 1}</PCell>
                    <PCell>{r.sopir}</PCell>
                    <PCell align="right">{formatNumber(r.trip)}</PCell>
                    <PCell align="right">{formatNumber(r.termin)}</PCell>
                    <PCell align="right">{formatNumber(r.uj)}</PCell>
                    <PCell align="right">{formatNumber(r.kasbon)}</PCell>
                    <PCell align="right" bold>{formatNumber(r.tf)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={3}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(total.n)}</PCell>
                    <PCell align="right">{formatNumber(total.uj)}</PCell>
                    <PCell align="right">{formatNumber(total.kasbon)}</PCell>
                    <PCell align="right">{formatNumber(total.tf)}</PCell>
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

  if (preview) {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const pages = chunkRows(termin, barisPerLembar(orientasi, 24))
          return (
        <PrintDocument>
          {pages.map((rows, i) => (
            <PrintPage key={i} page={i + 1} totalPages={pages.length}
              title="Rincian Termin Uang Jalan" subtitle="Satu baris per pembayaran" periode={periodeText} meta={meta}>
              <PrintTable cols={[
                { label: 'No.', align: 'right', width: '5%' }, { label: 'Tanggal', width: '10%' },
                { label: 'NoTrans', width: '12%' }, { label: 'Sopir' }, { label: 'Mobil', width: '12%' },
                { label: 'Ke-', align: 'right', width: '6%' },
                { label: 'UJ (Rp)', align: 'right' }, { label: 'Kasbon (Rp)', align: 'right' }, { label: 'TF (Rp)', align: 'right' },
              ]}>
                {rows.map((p, ri) => (
                  <PRow key={p.id}>
                    <PCell align="right">{i * 24 + ri + 1}</PCell>
                    <PCell>{formatDate(p.payment_date)}</PCell>
                    <PCell>{p.trip!.transaction_no}</PCell>
                    <PCell>{p.trip!.driver_name}</PCell>
                    <PCell>{p.trip!.plate_number}</PCell>
                    <PCell align="right">{p.sequence}</PCell>
                    <PCell align="right">{formatNumber(p.uj_amount)}</PCell>
                    <PCell align="right">{p.kasbon_deduction ? formatNumber(p.kasbon_deduction) : '-'}</PCell>
                    <PCell align="right" bold>{formatNumber(p.uj_amount - p.kasbon_deduction)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={6}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(total.uj)}</PCell>
                    <PCell align="right">{formatNumber(total.kasbon)}</PCell>
                    <PCell align="right">{formatNumber(total.tf)}</PCell>
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
      <PageHeader
        title="Rekap Uang Jalan"
        crumbs={[{ label: 'Lap. Bulan Ini' }, { label: 'Rekap Uang Jalan' }]}
        description="Rekap pembayaran uang jalan beserta potongan kasbon dan nilai transfer ke sopir."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Periode" subtitle="Berdasarkan tanggal pembayaran termin." />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Awal" required>{(id) => <DateInput id={id} value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
              <Field label="Tanggal Akhir" required>{(id) => <DateInput id={id} value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Tipe Laporan</p>
              <div className="space-y-2">
                <Radio name="uj-mode" label="Rekap per Sopir" description="Satu baris per sopir."
                  checked={mode === 'perSopir'} onChange={() => { setMode('perSopir'); setError(null) }} />
                <Radio name="uj-mode" label="Rincian per Termin" description="Satu baris per pembayaran."
                  checked={mode === 'perTermin'} onChange={() => { setMode('perTermin'); setError(null) }} />
              </div>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button variant="primary" icon={<Eye size={15} />} onClick={openPreview}>Preview</Button>
              <Button icon={<Printer size={15} />} onClick={openPreview}>Cetak</Button>
              <Button variant="ghost" icon={<X size={14} />} onClick={() => { resetPeriode(); setError(null) }}>Batal</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Jumlah Termin" value={formatNumber(total.n)} hint={periodeText} />
            <StatCard label="Total UJ" value={formatRupiah(total.uj, { compact: true })} hint="sebelum potongan" />
            <StatCard label="Potong Kasbon" value={formatRupiah(total.kasbon, { compact: true })} hint="pengurang UJ" />
            <StatCard label="TF ke Sopir" value={formatRupiah(total.tf, { compact: true })} hint="UJ − Potong Kasbon" />
          </div>

          <Card>
            <CardHeader title="Rekap per Sopir" subtitle={`${perSopir.length} sopir menerima uang jalan pada periode ini.`} />
            <div className="max-h-[440px] overflow-y-auto">
              {perSopir.length === 0 ? (
                <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada pembayaran pada periode tersebut.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-sunken">
                    <tr className="border-b border-hairline">
                      {['Sopir', 'Trip', 'Termin', 'UJ', 'Kasbon', 'TF'].map((h, i) => (
                        <th key={h} className={`px-4 py-2 text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perSopir.map((r) => (
                      <tr key={r.sopir} className="border-b border-grid last:border-0 hover:bg-sunken">
                        <td className="px-4 py-2 font-medium text-ink">{r.sopir}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{r.trip}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{r.termin}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{formatRupiah(r.uj)}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{r.kasbon ? formatRupiah(r.kasbon) : '—'}</td>
                        <td className="tnum px-4 py-2 text-right font-semibold text-ink">{formatRupiah(r.tf)}</td>
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
