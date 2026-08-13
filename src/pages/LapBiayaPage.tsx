import { useMemo, useState } from 'react'
import { Eye, Printer, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, DateInput, Select, FieldError } from '../components/ui/Field'
import { StatCard } from '../components/ui/StatCard'
import { Badge } from '../components/ui/Badge'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { endOfMonthISO, formatDate, formatNumber, formatRupiah, startOfMonthISO } from '../lib/format'
import { groupBy } from '../lib/utils'
import { EXPENSE_TYPES } from '../types'

export function LapBiayaPage() {
  const { db, transactionRows } = useData()
  const toast = useToast()
  const [from, setFrom] = useState(startOfMonthISO())
  const [to, setTo] = useState(endOfMonthISO())
  const [jenis, setJenis] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const tripById = useMemo(() => new Map(transactionRows.map((t) => [t.id, t])), [transactionRows])

  const rows = useMemo(
    () =>
      db.expenses
        .filter((e) => e.expense_date >= from && e.expense_date <= to)
        .filter((e) => (jenis ? e.expense_type === jenis : true))
        .map((e) => ({ ...e, trip: tripById.get(e.trip_id) }))
        .filter((e) => e.trip)
        .sort((a, b) => a.expense_date.localeCompare(b.expense_date)),
    [db.expenses, from, to, jenis, tripById],
  )

  const total = rows.reduce((a, e) => a + e.amount, 0)

  const perJenis = useMemo(() => {
    const g = groupBy(rows, (e) => e.expense_type)
    return Object.entries(g)
      .map(([tipe, items]) => ({ tipe, n: items.length, nominal: items.reduce((a, e) => a + e.amount, 0) }))
      .sort((a, b) => b.nominal - a.nominal)
  }, [rows])

  function openPreview() {
    if (from > to) { setError('Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.'); return }
    if (rows.length === 0) { setError('Tidak ada biaya pada periode tersebut.'); toast.info('Tidak ada data untuk ditampilkan.'); return }
    setError(null); setPreview(true)
  }

  const periodeText = `${formatDate(from)} s/d ${formatDate(to)}`

  if (preview) {
    const pages = chunkRows(rows, 24)
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        <PrintDocument>
          {pages.map((page, i) => (
            <PrintPage key={i} page={i + 1} totalPages={pages.length}
              title="Rekap Biaya Operasional"
              subtitle={jenis ? `Jenis biaya: ${jenis}` : 'Seluruh jenis biaya'}
              periode={periodeText}
              meta={[
                { label: 'Jumlah item', value: formatNumber(rows.length) },
                { label: 'Total biaya', value: formatRupiah(total) },
                { label: 'Jenis biaya', value: formatNumber(perJenis.length) },
              ]}
            >
              <PrintTable cols={[
                { label: 'No.', align: 'right', width: '5%' }, { label: 'Tanggal', width: '11%' },
                { label: 'NoTrans', width: '13%' }, { label: 'Sopir' }, { label: 'Mobil', width: '13%' },
                { label: 'Jenis Biaya', width: '13%' }, { label: 'Nominal (Rp)', align: 'right', width: '15%' },
              ]}>
                {page.map((e, ri) => (
                  <PRow key={e.id}>
                    <PCell align="right">{i * 24 + ri + 1}</PCell>
                    <PCell>{formatDate(e.expense_date)}</PCell>
                    <PCell>{e.trip!.transaction_no}</PCell>
                    <PCell>{e.trip!.driver_name}</PCell>
                    <PCell>{e.trip!.plate_number}</PCell>
                    <PCell>{e.expense_type}</PCell>
                    <PCell align="right" bold>{formatNumber(e.amount)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={6}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(total)}</PCell>
                  </PRow>
                )}
              </PrintTable>
              {i === pages.length - 1 && (
                <p className="mt-3 text-[9px] text-neutral-600">
                  Biaya operasional belum diperhitungkan sebagai pengurang pendapatan netto (TBD-03).
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
        title="Rekap Biaya Operasional"
        crumbs={[{ label: 'Lap. Bulan Ini' }, { label: 'Rekap Biaya Operasional' }]}
        description="Rekap DEX, tol, SPSI, nginap, dan biaya lain yang tercatat pada setiap trip."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Filter" subtitle="Berdasarkan tanggal biaya." />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Awal" required>{(id) => <DateInput id={id} value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
              <Field label="Tanggal Akhir" required>{(id) => <DateInput id={id} value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
            </div>
            <Field label="Jenis Biaya">
              {(id) => (
                <Select id={id} value={jenis} onChange={(e) => setJenis(e.target.value)}>
                  <option value="">Semua jenis</option>
                  {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              )}
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button variant="primary" icon={<Eye size={15} />} onClick={openPreview}>Preview</Button>
              <Button icon={<Printer size={15} />} onClick={openPreview}>Cetak</Button>
              <Button variant="ghost" icon={<X size={14} />} onClick={() => { setFrom(startOfMonthISO()); setTo(endOfMonthISO()); setJenis(''); setError(null) }}>Batal</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Biaya" value={formatRupiah(total, { compact: true })} hint={periodeText} />
            <StatCard label="Jumlah Item" value={formatNumber(rows.length)} hint={`${perJenis.length} jenis biaya`} />
            <StatCard
              label="Biaya Terbesar"
              value={perJenis[0]?.tipe ?? '—'}
              hint={perJenis[0] ? formatRupiah(perJenis[0].nominal) : 'belum ada data'}
            />
          </div>

          <Card>
            <CardHeader title="Rincian per Jenis Biaya" subtitle="Diurutkan dari nominal terbesar." />
            <div className="p-4">
              {perJenis.length === 0 ? (
                <p className="py-12 text-center text-[13px] text-ink-3">Tidak ada biaya pada periode tersebut.</p>
              ) : (
                <ul className="space-y-2.5">
                  {perJenis.map((r) => (
                    <li key={r.tipe} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <span className="min-w-0">
                        <span className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Badge tone="brand">{r.tipe}</Badge>
                            <span className="text-[11.5px] text-ink-3">{r.n} item</span>
                          </span>
                        </span>
                        <span className="block h-2 w-full overflow-hidden rounded-full bg-grid">
                          <span className="block h-full rounded-full bg-brand-500"
                            style={{ width: `${Math.max((r.nominal / (perJenis[0]?.nominal || 1)) * 100, 3)}%` }} />
                        </span>
                      </span>
                      <span className="tnum w-36 text-right text-[13px] font-semibold text-ink">{formatRupiah(r.nominal)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="border-t border-hairline px-4 py-2.5 text-[11.5px] text-ink-3">
              Jenis biaya disimpan sebagai data, bukan kolom tetap — menambah jenis baru tidak mengubah struktur database.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
