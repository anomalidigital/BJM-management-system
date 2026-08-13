import { useMemo, useState } from 'react'
import { Eye, Printer, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, DateInput, Radio, FieldError } from '../components/ui/Field'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { StatCard } from '../components/ui/StatCard'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { komisiTransaksi, ringkas } from '../lib/calculations'
import { formatDate, formatNumber, formatRupiah } from '../lib/format'
import { groupBy } from '../lib/utils'
import { periodeAktif } from '../lib/periode'
import type { TransactionRow } from '../types'

type Mode = 'perSopir' | 'semuaSopir' | 'global'

const MODE_LABEL: Record<Mode, string> = {
  perSopir: 'Cetak Komisi perSopir',
  semuaSopir: 'Cetak Komisi semuaSopir',
  global: 'Cetak Komisi Global',
}

export function LapKomisiPage() {
  const { db, transactionRows } = useData()
  const toast = useToast()

  const periodeDefault = useMemo(() => periodeAktif(transactionRows.map((t) => t.transaction_date)), [transactionRows])
  const [from, setFrom] = useState(periodeDefault.start)
  const [to, setTo] = useState(periodeDefault.end)
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
        .filter((t) => t.transaction_date >= from && t.transaction_date <= to)
        .filter((t) => (mode === 'perSopir' && driverId ? t.driver_id === driverId : true))
        .sort((a, b) => a.driver_name.localeCompare(b.driver_name) || a.transaction_date.localeCompare(b.transaction_date)),
    [transactionRows, from, to, mode, driverId],
  )

  const totals = useMemo(() => ringkas(rows), [rows])
  const byDriver = useMemo(() => groupBy(rows, (t) => t.driver_id), [rows])

  /** Ringkasan satu baris per sopir — dipakai mode Global. */
  const globalRows = useMemo(
    () =>
      Object.values(byDriver)
        .map((group) => ({
          driver: `${group[0].driver_code} — ${group[0].driver_name}`,
          ritan: group.length,
          komisi: group.reduce((a, r) => a + komisiTransaksi(r), 0),
        }))
        .sort((a, b) => b.komisi - a.komisi),
    [byDriver],
  )

  function openPreview() {
    if (mode === 'perSopir' && !driverId) {
      setError('Pilih Sopir wajib diisi untuk mode Cetak Komisi perSopir.')
      toast.error('Pilih sopir terlebih dahulu.')
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

  function resetFilter() {
    setFrom(periodeDefault.start); setTo(periodeDefault.end); setMode('semuaSopir'); setDriverId(null); setError(null)
  }

  const periodeText = `${formatDate(from)} s/d ${formatDate(to)}`
  const selectedDriver = db.drivers.find((d) => d.id === driverId)

  /* ── Preview: mode Global (ringkasan per sopir) ────────────── */
  if (preview && mode === 'global') {
    const pages = chunkRows(globalRows, 28)
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        <PrintDocument>
          {pages.map((pageRows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={pages.length}
              title="Laporan Komisi Global" subtitle="Rekap komisi seluruh sopir" periode={periodeText}
              meta={[
                { label: 'Jumlah sopir', value: formatNumber(globalRows.length) },
                { label: 'Jumlah ritan', value: formatNumber(totals.ritan) },
                { label: 'Total komisi', value: formatRupiah(totals.komisi) },
              ]}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '8%' },
                  { label: 'Sopir' },
                  { label: 'Jumlah Ritan', align: 'right', width: '18%' },
                  { label: 'Total Komisi (Rp)', align: 'right', width: '24%' },
                ]}
              >
                {pageRows.map((r, ri) => (
                  <PRow key={r.driver}>
                    <PCell align="right">{i * 28 + ri + 1}</PCell>
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
      </ReportPreview>
    )
  }

  /* ── Preview: mode perSopir / semuaSopir (rincian transaksi) ─ */
  if (preview) {
    const pages = chunkRows(rows, 24)
    const title = mode === 'perSopir' ? 'Laporan Komisi per Sopir' : 'Laporan Komisi Seluruh Sopir'
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
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
                  { label: 'NoTrans', width: '13%' },
                  { label: 'Tanggal', width: '11%' },
                  { label: 'Sopir' },
                  { label: 'No Mobil', width: '13%' },
                  { label: 'Route', width: '11%' },
                  { label: 'Komisi (Rp)', align: 'right', width: '15%' },
                ]}
              >
                {pageRows.map((t: TransactionRow, ri) => (
                  <PRow key={t.id}>
                    <PCell align="right">{i * 24 + ri + 1}</PCell>
                    <PCell>{t.transaction_no}</PCell>
                    <PCell>{formatDate(t.transaction_date)}</PCell>
                    <PCell>{t.driver_name}</PCell>
                    <PCell>{t.plate_number}</PCell>
                    <PCell>{t.route_code}</PCell>
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
      </ReportPreview>
    )
  }

  return (
    <>
      <PageHeader
        title="Cetak Komisi Bulan Berjalan"
        crumbs={[{ label: 'Lap. Bulan Ini' }, { label: 'Komisi Bulan Berjalan' }]}
        description="Pilih periode dan jenis laporan, lalu buka preview sebelum mencetak atau menyimpan sebagai PDF."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="PERIODE KOMISI" subtitle="Tentukan rentang tanggal transaksi." />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Awal" required>
                {(id) => <DateInput id={id} value={from} onChange={(e) => setFrom(e.target.value)} />}
              </Field>
              <Field label="Tanggal Akhir" required>
                {(id) => <DateInput id={id} value={to} onChange={(e) => setTo(e.target.value)} />}
              </Field>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Jenis Laporan</p>
              <div className="space-y-2">
                <Radio
                  name="mode" label={MODE_LABEL.perSopir} description="Rincian transaksi untuk satu sopir."
                  checked={mode === 'perSopir'} onChange={() => { setMode('perSopir'); setError(null) }}
                />
                {mode === 'perSopir' && (
                  <div className="pl-6">
                    <Field label="Pilih Sopir" required error={error && !driverId ? error : undefined}>
                      {(id) => (
                        <SearchableSelect
                          id={id} options={driverOptions} value={driverId} invalid={!!error && !driverId}
                          placeholder="Cari kode atau nama sopir..." onChange={(v) => { setDriverId(v); setError(null) }}
                        />
                      )}
                    </Field>
                  </div>
                )}
                <Radio
                  name="mode" label={MODE_LABEL.semuaSopir} description="Rincian transaksi seluruh sopir."
                  checked={mode === 'semuaSopir'} onChange={() => { setMode('semuaSopir'); setError(null) }}
                />
                <Radio
                  name="mode" label={MODE_LABEL.global} description="Rekap satu baris per sopir."
                  checked={mode === 'global'} onChange={() => { setMode('global'); setError(null) }}
                />
              </div>
            </div>

            {error && driverId !== null && <FieldError>{error}</FieldError>}
            {error && mode !== 'perSopir' && <FieldError>{error}</FieldError>}

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button variant="primary" icon={<Eye size={15} />} onClick={openPreview}>Preview Laporan</Button>
              <Button icon={<Printer size={15} />} onClick={openPreview}>Cetak</Button>
              <Button icon={<X size={14} />} variant="ghost" onClick={resetFilter}>Batal</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Transaksi pada periode" value={formatNumber(totals.transaksi)} hint={periodeText} />
            <StatCard label="Jumlah Ritan" value={formatNumber(totals.ritan)} hint="1 transaksi = 1 ritan" />
            <StatCard label="Total Komisi" value={formatRupiah(totals.komisi, { compact: true })} hint="periode terpilih" />
          </div>

          <Card>
            <CardHeader title="Ringkasan per Sopir" subtitle={`${globalRows.length} sopir memiliki transaksi pada periode ini.`} />
            <div className="max-h-[420px] overflow-y-auto">
              {globalRows.length === 0 ? (
                <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada transaksi pada periode tersebut.</p>
              ) : (
                <ul className="divide-y divide-grid">
                  {globalRows.map((r) => (
                    <li key={r.driver} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{r.driver}</span>
                      <span className="tnum shrink-0 text-[12.5px] text-ink-3">{r.ritan} ritan</span>
                      <span className="tnum w-32 shrink-0 text-right text-[13px] font-semibold text-ink">{formatRupiah(r.komisi)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
