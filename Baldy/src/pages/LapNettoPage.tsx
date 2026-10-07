import { useMemo, useState } from 'react'
import { FaEye, FaPrint, FaXmark } from '../components/ui/icons'
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
import { biayaPerusahaanTransaksi, ditagihkanTransaksi, komisiTransaksi, nettoTransaksi, pendapatanTransaksi, ringkas, tripDihitung, uangJalanTransaksi } from '../lib/calculations'
import { formatDate, formatNumber, formatRupiah } from '../lib/format'
import { groupBy } from '../lib/utils'
import { usePeriodeDefault } from '../lib/periode'

type Mode = 'perMobil' | 'global'

/** Baris untuk trip yang belum punya nomor kendaraan. */
const TANPA_MOBIL = '(tanpa No. Kendaraan)'

export function LapNettoPage() {
  const { transactionRows } = useData()
  const toast = useToast()

  const { from, setFrom, to, setTo, reset: resetPeriode } = usePeriodeDefault(transactionRows.map((t) => t.transaction_date))
  const [mode, setMode] = useState<Mode>('perMobil')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const rows = useMemo(
    () => transactionRows.filter((t) => tripDihitung(t) && t.transaction_date >= from && t.transaction_date <= to),
    [transactionRows, from, to],
  )
  const totals = useMemo(() => ringkas(rows), [rows])

  /**
   * Rekap per nomor polisi, seperti Laporan Pendapatan Netto sistem lama. Trip tanpa
   * kendaraan tetap dihitung di baris tersendiri (di laporan lama: baris tanpa No Mobil).
   * Kernet belum dicatat di data mana pun, jadi selalu 0 sampai aturannya ada (TBD-11).
   */
  const perMobil = useMemo(() => {
    const grouped = groupBy(rows, (t) => t.plate_number || TANPA_MOBIL)
    return Object.entries(grouped)
      .map(([plate, group]) => ({
        plate,
        ritan: group.length,
        pendapatan: group.reduce((a, r) => a + pendapatanTransaksi(r), 0),
        ditagihkan: group.reduce((a, r) => a + ditagihkanTransaksi(r), 0),
        ujroute: group.reduce((a, r) => a + uangJalanTransaksi(r) + biayaPerusahaanTransaksi(r), 0),
        komisi: group.reduce((a, r) => a + komisiTransaksi(r), 0),
        kernet: 0,
        netto: group.reduce((a, r) => a + nettoTransaksi(r), 0),
      }))
      .sort((a, b) => (a.plate === TANPA_MOBIL ? 1 : b.plate === TANPA_MOBIL ? -1 : b.netto - a.netto))
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
    { label: 'Biaya ditagihkan', value: formatRupiah(totals.ditagihkan) },
    { label: 'Biaya perjalanan', value: formatRupiah(totals.uangJalan + totals.biayaPerusahaan) },
    { label: 'Total netto', value: formatRupiah(totals.netto) },
  ]

  if (preview && mode === 'perMobil') {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const pages = chunkRows(perMobil, barisPerLembar(orientasi, 26))
          return (
        <PrintDocument>
          {pages.map((pageRows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={pages.length}
              title="Laporan Pendapatan Netto" subtitle="Per mobil" periode={periodeText} meta={metaTotals}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '5%' },
                  { label: 'No. Mobil', width: '13%' },
                  { label: 'Ritan', align: 'right', width: '6%' },
                  { label: 'Pendapatan Bruto', align: 'right' },
                  { label: 'Ditagihkan', align: 'right' },
                  { label: 'Biaya Perjalanan', align: 'right' },
                  { label: 'Komisi', align: 'right' },
                  { label: 'Kernet', align: 'right', width: '9%' },
                  { label: 'Pendapatan Netto', align: 'right' },
                ]}
              >
                {pageRows.map((r, ri) => (
                  <PRow key={r.plate}>
                    <PCell align="right">{i * 26 + ri + 1}</PCell>
                    <PCell bold>{r.plate}</PCell>
                    <PCell align="right">{formatNumber(r.ritan)}</PCell>
                    <PCell align="right">{formatNumber(r.pendapatan)}</PCell>
                    <PCell align="right">{formatNumber(r.ditagihkan)}</PCell>
                    <PCell align="right">{formatNumber(r.ujroute)}</PCell>
                    <PCell align="right">{formatNumber(r.komisi)}</PCell>
                    <PCell align="right">{formatNumber(r.kernet)}</PCell>
                    <PCell align="right" bold>{formatNumber(r.netto)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={2}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(totals.ritan)}</PCell>
                    <PCell align="right">{formatNumber(totals.pendapatan)}</PCell>
                    <PCell align="right">{formatNumber(totals.ditagihkan)}</PCell>
                    <PCell align="right">{formatNumber(totals.uangJalan + totals.biayaPerusahaan)}</PCell>
                    <PCell align="right">{formatNumber(totals.komisi)}</PCell>
                    <PCell align="right">0</PCell>
                    <PCell align="right">{formatNumber(totals.netto)}</PCell>
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
    const perDay = Object.entries(groupBy(rows, (t) => t.transaction_date))
      .map(([date, group]) => ({
        date,
        ritan: group.length,
        pendapatan: group.reduce((a, r) => a + pendapatanTransaksi(r), 0),
        ditagihkan: group.reduce((a, r) => a + ditagihkanTransaksi(r), 0),
        ujroute: group.reduce((a, r) => a + uangJalanTransaksi(r) + biayaPerusahaanTransaksi(r), 0),
        komisi: group.reduce((a, r) => a + komisiTransaksi(r), 0),
        netto: group.reduce((a, r) => a + nettoTransaksi(r), 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const pages = chunkRows(perDay, barisPerLembar(orientasi, 28))
          return (
        <PrintDocument>
          {pages.map((pageRows, i) => (
            <PrintPage
              key={i} page={i + 1} totalPages={pages.length}
              title="Laporan Pendapatan Netto" subtitle="GLOBAL, rekap harian seluruh armada" periode={periodeText} meta={metaTotals}
            >
              <PrintTable
                cols={[
                  { label: 'No.', align: 'right', width: '5%' },
                  { label: 'Tanggal', width: '12%' },
                  { label: 'Ritan', align: 'right', width: '6%' },
                  { label: 'Pendapatan Bruto', align: 'right' },
                  { label: 'Ditagihkan', align: 'right' },
                  { label: 'Biaya Perjalanan', align: 'right' },
                  { label: 'Komisi', align: 'right' },
                  { label: 'Kernet', align: 'right', width: '9%' },
                  { label: 'Pendapatan Netto', align: 'right' },
                ]}
              >
                {pageRows.map((r, ri) => (
                  <PRow key={r.date}>
                    <PCell align="right">{i * 28 + ri + 1}</PCell>
                    <PCell>{formatDate(r.date)}</PCell>
                    <PCell align="right">{formatNumber(r.ritan)}</PCell>
                    <PCell align="right">{formatNumber(r.pendapatan)}</PCell>
                    <PCell align="right">{formatNumber(r.ditagihkan)}</PCell>
                    <PCell align="right">{formatNumber(r.ujroute)}</PCell>
                    <PCell align="right">{formatNumber(r.komisi)}</PCell>
                    <PCell align="right">0</PCell>
                    <PCell align="right" bold>{formatNumber(r.netto)}</PCell>
                  </PRow>
                ))}
                {i === pages.length - 1 && (
                  <PRow tone="total">
                    <PCell align="right" colSpan={2}>TOTAL</PCell>
                    <PCell align="right">{formatNumber(totals.ritan)}</PCell>
                    <PCell align="right">{formatNumber(totals.pendapatan)}</PCell>
                    <PCell align="right">{formatNumber(totals.ditagihkan)}</PCell>
                    <PCell align="right">{formatNumber(totals.uangJalan + totals.biayaPerusahaan)}</PCell>
                    <PCell align="right">{formatNumber(totals.komisi)}</PCell>
                    <PCell align="right">0</PCell>
                    <PCell align="right">{formatNumber(totals.netto)}</PCell>
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
        title="Pendapatan Netto Bulan Berjalan"
        crumbs={[{ label: 'Laporan' }, { label: 'Netto' }]}
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
              <Button variant="primary" icon={<FaEye size={15} />} onClick={openPreview}>Preview</Button>
              <Button icon={<FaPrint size={15} />} onClick={openPreview}>Cetak</Button>
              <Button variant="ghost" icon={<FaXmark size={14} />} onClick={() => { resetPeriode(); setMode('perMobil'); setError(null) }}>Batal</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pendapatan Bruto" value={formatRupiah(totals.pendapatan, { compact: true })} hint={`harga trip · + ${formatRupiah(totals.ditagihkan, { compact: true })} ditagihkan ke klien`} />
            <StatCard label="Biaya Perjalanan" value={formatRupiah(totals.uangJalan + totals.biayaPerusahaan, { compact: true })} hint={`uang jalan ${formatRupiah(totals.uangJalan, { compact: true })} + dibayar perusahaan ${formatRupiah(totals.biayaPerusahaan, { compact: true })}`} />
            <StatCard label="Komisi" value={formatRupiah(totals.komisi, { compact: true })} hint="kernet belum dicatat (0)" />
            <StatCard label="Pendapatan Netto" value={formatRupiah(totals.netto, { compact: true })} hint="periode terpilih" />
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
                      <th className="px-4 py-2 text-left text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">No. Kendaraan</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Ritan</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Bruto</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Ditagihkan</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Biaya Perjalanan</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Komisi</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Kernet</th>
                      <th className="px-4 py-2 text-right text-[11.5px] font-semibold tracking-wide text-ink-2 uppercase">Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perMobil.map((r) => (
                      <tr key={r.plate} className="border-b border-grid last:border-0 hover:bg-sunken">
                        <td className="tnum px-4 py-2 font-medium text-ink">{r.plate}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{r.ritan}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{formatRupiah(r.pendapatan)}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{formatRupiah(r.ditagihkan)}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{formatRupiah(r.ujroute)}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-2">{formatRupiah(r.komisi)}</td>
                        <td className="tnum px-4 py-2 text-right text-ink-3">{formatRupiah(r.kernet)}</td>
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
