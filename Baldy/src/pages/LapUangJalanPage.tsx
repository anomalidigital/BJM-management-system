import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FaEye, FaPrint, FaWallet, FaXmark } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, DateInput, Radio, FieldError } from '../components/ui/Field'
import { TombolSegmen } from '../components/ui/TabKartu'
import { LineChart } from '../components/charts/LineChart'
import { RankingBars } from '../components/charts/RankingBars'
import { VIZ } from '../components/charts/chartUtils'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { addDaysISO, formatDate, formatDateShort, formatNumber, formatRupiah } from '../lib/format'
import { cn, groupBy } from '../lib/utils'
import { usePeriodeDefault } from '../lib/periode'
import { JENIS_TERMIN_LABEL } from '../types'
import type { Driver, TransactionRow, UjPayment } from '../types'

/** Tabel tab Uang Jalan: satu baris per supir, atau satu baris per pembayaran termin. */
export type TampilUj = 'supir' | 'termin'

/** Termin uang jalan dalam periode, digabung dengan trip dan supir penerimanya. */
export interface TerminTrip extends UjPayment {
  trip: TransactionRow
  /** Supir penerima termin; termin lama tanpa penerima memakai supir utama trip. */
  supir_id: string
  supir_nama: string
  supir_kode: string
  /** Transfer ke supir = uang jalan - potong kasbon. */
  tf: number
}

/**
 * Termin yang dibayar dalam periode (berdasarkan tanggal bayar termin). Termin trip batal
 * sudah tidak ada di `db.ujPayments`, jadi otomatis tidak terhitung.
 */
export function terminPeriode(
  ujPayments: UjPayment[],
  tripById: Map<string, TransactionRow>,
  drivers: Driver[],
  awal: string,
  akhir: string,
): TerminTrip[] {
  const supir = new Map(drivers.map((d) => [d.id, d]))
  const hasil: TerminTrip[] = []
  for (const p of ujPayments) {
    if (p.payment_date < awal || p.payment_date > akhir) continue
    const trip = tripById.get(p.trip_id)
    if (!trip) continue
    const id = p.driver_id || trip.driver_id || ''
    const d = supir.get(id)
    hasil.push({
      ...p, trip, supir_id: id, supir_nama: d?.driver_name ?? '', supir_kode: d?.driver_code ?? '',
      tf: p.uj_amount - p.kasbon_deduction,
    })
  }
  return hasil.sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.trip.transaction_no.localeCompare(b.trip.transaction_no) || a.sequence - b.sequence)
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const bulanBerikut = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/**
 * Jumlah nilai per hari untuk grafik garis. Periode lebih dari 62 hari dijumlah per bulan
 * supaya garisnya tetap terbaca.
 */
export function deretTanggal(awal: string, akhir: string, isi: Array<{ tanggal: string; nilai: number }>) {
  if (!ISO.test(awal) || !ISO.test(akhir) || awal > akhir) return { labels: [] as string[], values: [] as number[], perBulan: false }
  const hari = Math.round((Date.parse(akhir) - Date.parse(awal)) / 86_400_000) + 1
  const perBulan = hari > 62
  const kunci: string[] = []
  if (perBulan) for (let k = awal.slice(0, 7); k <= akhir.slice(0, 7) && kunci.length < 240; k = bulanBerikut(k)) kunci.push(k)
  else for (let k = awal; k <= akhir && kunci.length < 62; k = addDaysISO(k, 1)) kunci.push(k)
  const urut = new Map(kunci.map((k, i) => [k, i]))
  const values = kunci.map(() => 0)
  for (const x of isi) {
    const i = urut.get(perBulan ? x.tanggal.slice(0, 7) : x.tanggal.slice(0, 10))
    if (i !== undefined) values[i] += x.nilai
  }
  const labels = kunci.map((k) => (perBulan ? `${formatDateShort(`${k}-01`).split(' ')[1]} ${k.slice(0, 4)}` : formatDateShort(k)))
  return { labels, values, perBulan }
}

/** Kepala kolom tabel laporan: menempel saat digulir, garis bawah ikut menempel. */
export const KELAS_TH = 'px-4 py-2 text-[11.5px] font-semibold tracking-wide whitespace-nowrap text-ink-2 uppercase shadow-[inset_0_-1px_0_var(--color-hairline)]'
/** Garis atas baris total di kaki tabel (ikut menempel di bawah saat digulir). */
export const GARIS_TOTAL = { boxShadow: 'inset 0 1px 0 var(--color-hairline)' } as const

/** Deretan angka berhubungan, mis. Uang jalan - Potong kasbon = Transfer ke supir. */
export function RumusAngka({ suku }: { suku: Array<{ label: string; nilai: number; operator?: '+' | '−' | '='; tebal?: boolean }> }) {
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5">
      {suku.map((s) => (
        <div key={s.label} className="flex items-end gap-x-3">
          {s.operator && <span aria-hidden="true" className="pb-0.5 text-[18px] leading-none text-ink-3">{s.operator}</span>}
          <div>
            <p className="text-[11.5px] text-ink-3">{s.label}</p>
            <p className={cn('mt-0.5 text-[16px] leading-tight whitespace-nowrap text-ink', s.tebal ? 'font-bold' : 'font-semibold')}>{formatRupiah(s.nilai)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Judul kecil di atas diagram. */
export function JudulDiagram({ judul, keterangan }: { judul: string; keterangan?: ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-[13px] font-semibold text-ink">{judul}</h3>
      {keterangan && <p className="mt-0.5 text-[12px] text-ink-3">{keterangan}</p>}
    </div>
  )
}

const tautanBawaan = (tripId: string) => `/transaksi/trip/${tripId}?tab=uj`

interface Props {
  /** Dirender sebagai tab di halaman Rekap Pengeluaran: tanpa kepala halaman & kartu Periode sendiri. */
  tertanam?: boolean
  /** Periode dari kepala halaman Rekap Pengeluaran (mode tertanam). */
  periode?: { awal: string; akhir: string }
  /** Tampilan tabel; saat tertanam diatur halaman induk (disimpan di URL). */
  tampil?: TampilUj
  onTampil?: (t: TampilUj) => void
  /** Saat tertanam, preview cetak dibuka dari tombol di kepala halaman induk. */
  preview?: boolean
  onTutupPreview?: () => void
  /** Alamat detail trip dari baris tabel; bawaan membuka tab Uang Jalan trip itu. */
  tautanTrip?: (tripId: string) => string
}

/**
 * Laporan Uang Jalan: rekap pembayaran termin beserta potongan kasbon dan transfer ke supir.
 * Kini tampil sebagai tab di Rekap Pengeluaran; dibuka sendiri tetap berkartu Periode.
 */
export function LapUangJalanPage({
  tertanam = false,
  periode,
  tampil: tampilInduk,
  onTampil,
  preview: previewInduk,
  onTutupPreview,
  tautanTrip = tautanBawaan,
}: Props = {}) {
  const { db, transactionRows } = useData()
  const toast = useToast()
  const { workspace } = useWorkspace()
  const lokal = usePeriodeDefault(db.ujPayments.map((p) => p.payment_date))
  const awal = periode?.awal ?? lokal.from
  const akhir = periode?.akhir ?? lokal.to
  const [tampilLokal, setTampilLokal] = useState<TampilUj>('supir')
  const tampil = tampilInduk ?? tampilLokal
  const gantiTampil = (t: TampilUj) => (onTampil ? onTampil(t) : setTampilLokal(t))
  const [previewLokal, setPreviewLokal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = tertanam ? !!previewInduk : previewLokal
  const tutupPreview = () => (tertanam ? onTutupPreview?.() : setPreviewLokal(false))

  const tripById = useMemo(() => new Map(transactionRows.map((t) => [t.id, t])), [transactionRows])
  const termin = useMemo(() => terminPeriode(db.ujPayments, tripById, db.drivers, awal, akhir), [db.ujPayments, db.drivers, tripById, awal, akhir])

  const total = useMemo(() => ({
    uj: termin.reduce((a, p) => a + p.uj_amount, 0),
    kasbon: termin.reduce((a, p) => a + p.kasbon_deduction, 0),
    tf: termin.reduce((a, p) => a + p.tf, 0),
    n: termin.length,
    trip: new Set(termin.map((p) => p.trip_id)).size,
  }), [termin])

  const perSupir = useMemo(() => {
    const g = groupBy(termin, (p) => p.supir_id || 'tanpa')
    return Object.entries(g)
      .map(([id, rows]) => ({
        id,
        nama: rows[0].supir_nama || 'Tanpa supir',
        kode: rows[0].supir_kode,
        termin: rows.length,
        trip: new Set(rows.map((r) => r.trip_id)).size,
        uj: rows.reduce((a, r) => a + r.uj_amount, 0),
        kasbon: rows.reduce((a, r) => a + r.kasbon_deduction, 0),
        tf: rows.reduce((a, r) => a + r.tf, 0),
      }))
      .sort((a, b) => b.uj - a.uj || a.nama.localeCompare(b.nama))
  }, [termin])

  const harian = useMemo(() => deretTanggal(awal, akhir, termin.map((p) => ({ tanggal: p.payment_date, nilai: p.uj_amount }))), [awal, akhir, termin])

  const karawang = workspace === 'karawang'
  const labelId = karawang ? 'ID Trip' : 'No. Trip'
  const periodeText = `${formatDate(awal)} s/d ${formatDate(akhir)}`
  const namaSupir = (r: { kode: string; nama: string }) => (r.kode ? `${r.kode} — ${r.nama}` : r.nama)

  function bukaPreview() {
    if (awal > akhir) { setError('Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.'); return }
    if (termin.length === 0) { setError('Tidak ada pembayaran uang jalan pada periode tersebut.'); toast.info('Tidak ada data untuk ditampilkan.'); return }
    setError(null); setPreviewLokal(true)
  }

  const meta = [
    { label: 'Jumlah termin', value: formatNumber(total.n) },
    { label: 'Total Uang Jalan', value: formatRupiah(total.uj) },
    { label: 'Total transfer ke supir', value: formatRupiah(total.tf) },
  ]

  if (preview && tampil === 'supir') {
    return (
      <ReportPreview onClose={tutupPreview} onPrint={() => window.print()}>
        {(orientasi) => {
          const per = barisPerLembar(orientasi, 26)
          const pages = chunkRows(perSupir, per)
          return (
            <PrintDocument>
              {pages.map((rows, i) => (
                <PrintPage key={i} page={i + 1} totalPages={pages.length}
                  title="Rekap Uang Jalan per Supir" subtitle="Berdasarkan tanggal bayar termin" periode={periodeText} meta={meta}>
                  <PrintTable cols={[
                    { label: 'No.', align: 'right', width: '6%' }, { label: 'Supir' },
                    { label: 'Trip', align: 'right', width: '9%' }, { label: 'Termin', align: 'right', width: '9%' },
                    { label: 'Uang Jalan (Rp)', align: 'right' }, { label: 'Potong Kasbon (Rp)', align: 'right' }, { label: 'Transfer (Rp)', align: 'right' },
                  ]}>
                    {rows.map((r, ri) => (
                      <PRow key={r.id}>
                        <PCell align="right">{i * per + ri + 1}</PCell>
                        <PCell>{namaSupir(r)}</PCell>
                        <PCell align="right">{formatNumber(r.trip)}</PCell>
                        <PCell align="right">{formatNumber(r.termin)}</PCell>
                        <PCell align="right">{formatNumber(r.uj)}</PCell>
                        <PCell align="right">{formatNumber(r.kasbon)}</PCell>
                        <PCell align="right" bold>{formatNumber(r.tf)}</PCell>
                      </PRow>
                    ))}
                    {i === pages.length - 1 && (
                      <PRow tone="total">
                        <PCell align="right" colSpan={2}>TOTAL</PCell>
                        <PCell align="right">{formatNumber(total.trip)}</PCell>
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
      <ReportPreview onClose={tutupPreview} onPrint={() => window.print()}>
        {(orientasi) => {
          const per = barisPerLembar(orientasi, 24)
          const pages = chunkRows(termin, per)
          return (
            <PrintDocument>
              {pages.map((rows, i) => (
                <PrintPage key={i} page={i + 1} totalPages={pages.length}
                  title="Rincian Termin Uang Jalan" subtitle="Satu baris per pembayaran, berdasarkan tanggal bayar termin" periode={periodeText} meta={meta}>
                  <PrintTable cols={[
                    { label: 'No.', align: 'right', width: '5%' }, { label: 'Tanggal', width: '9%' },
                    { label: labelId, width: karawang ? '17%' : '11%' }, { label: 'Supir' }, { label: 'Mobil', width: '10%' },
                    { label: 'Ke-', align: 'right', width: '5%' }, { label: 'Jenis', width: '10%' },
                    { label: 'Uang Jalan (Rp)', align: 'right' }, { label: 'Kasbon (Rp)', align: 'right' }, { label: 'Transfer (Rp)', align: 'right' },
                  ]}>
                    {rows.map((p, ri) => (
                      <PRow key={p.id}>
                        <PCell align="right">{i * per + ri + 1}</PCell>
                        <PCell>{formatDate(p.payment_date)}</PCell>
                        <PCell>{p.trip.id_tampil}</PCell>
                        <PCell>{p.supir_nama || '-'}</PCell>
                        <PCell>{p.trip.plate_number || '-'}</PCell>
                        <PCell align="right">{p.sequence}</PCell>
                        <PCell>{JENIS_TERMIN_LABEL[p.jenis ?? 'uj']}</PCell>
                        <PCell align="right">{formatNumber(p.uj_amount)}</PCell>
                        <PCell align="right">{p.kasbon_deduction ? formatNumber(p.kasbon_deduction) : '-'}</PCell>
                        <PCell align="right" bold>{formatNumber(p.tf)}</PCell>
                      </PRow>
                    ))}
                    {i === pages.length - 1 && (
                      <PRow tone="total">
                        <PCell align="right" colSpan={7}>TOTAL</PCell>
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

  const adaHarian = harian.values.some((v) => v > 0)
  const kosong = <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada pembayaran uang jalan pada periode tersebut.</p>

  const panel = (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><FaWallet size={15} className="text-brand-600" />Uang Jalan</span>}
        subtitle={`${formatNumber(total.n)} termin dibayar pada ${periodeText}. Dihitung dari tanggal bayar termin.`}
        actions={tertanam ? (
          <TombolSegmen
            label="Tampilan tabel uang jalan"
            value={tampil}
            onChange={(v) => gantiTampil(v as TampilUj)}
            pilihan={[{ id: 'supir', label: 'Rekap per Supir' }, { id: 'termin', label: 'Rincian per Termin' }]}
          />
        ) : undefined}
      />

      <div className="border-b border-hairline px-4 py-3">
        <RumusAngka suku={[
          { label: 'Uang jalan dibayar', nilai: total.uj },
          { label: 'Potong kasbon', nilai: total.kasbon, operator: '−' },
          { label: 'Transfer ke supir', nilai: total.tf, operator: '=', tebal: true },
        ]} />
      </div>

      <div className="grid gap-6 border-b border-hairline p-4 lg:grid-cols-2">
        <section aria-label="Grafik uang jalan dibayar">
          <JudulDiagram
            judul={harian.perBulan ? 'Uang jalan dibayar per bulan' : 'Uang jalan dibayar per hari'}
            keterangan="Nilai termin yang dibayar tiap tanggal, sebelum potong kasbon."
          />
          {adaHarian
            ? <LineChart labels={harian.labels} series={[{ name: 'Uang jalan', color: VIZ.series1, values: harian.values }]} height={190} />
            : <p className="py-10 text-center text-[12.5px] text-ink-3">Belum ada uang jalan dibayar pada periode ini.</p>}
        </section>
        <section aria-label="Supir dengan uang jalan terbesar">
          <JudulDiagram judul="Top supir · uang jalan (Rp)" keterangan={perSupir.length > 6 ? `6 dari ${perSupir.length} supir. Semuanya ada di tabel Rekap per Supir.` : 'Diurutkan dari uang jalan terbesar.'} />
          {perSupir.length > 0
            ? <RankingBars rows={perSupir.slice(0, 6).map((r) => ({ id: r.id, label: r.nama, meta: `${r.termin} termin`, value: r.uj }))} />
            : <p className="py-10 text-center text-[12.5px] text-ink-3">Belum ada supir menerima uang jalan.</p>}
        </section>
      </div>

      {termin.length === 0 ? kosong : tampil === 'supir' ? (
        <div className="max-h-[440px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-sunken">
              <tr>
                {['Supir', 'Trip', 'Termin', 'Uang Jalan', 'Potong Kasbon', 'Transfer ke Supir'].map((h, i) => (
                  <th key={h} className={cn(KELAS_TH, i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perSupir.map((r) => (
                <tr key={r.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                  <td className="px-4 py-2 font-medium text-ink">{namaSupir(r)}</td>
                  <td className="tnum px-4 py-2 text-right text-ink-2">{r.trip}</td>
                  <td className="tnum px-4 py-2 text-right text-ink-2">{r.termin}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">{formatRupiah(r.uj)}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">{r.kasbon ? formatRupiah(r.kasbon) : '—'}</td>
                  <td className="tnum px-4 py-2 text-right font-semibold whitespace-nowrap text-ink">{formatRupiah(r.tf)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-sunken">
              <tr className="font-semibold text-ink">
                <td className="px-4 py-2 whitespace-nowrap" style={GARIS_TOTAL}>Total · {formatNumber(perSupir.length)} supir</td>
                <td className="tnum px-4 py-2 text-right" style={GARIS_TOTAL}>{formatNumber(total.trip)}</td>
                <td className="tnum px-4 py-2 text-right" style={GARIS_TOTAL}>{formatNumber(total.n)}</td>
                <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.uj)}</td>
                <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.kasbon)}</td>
                <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.tf)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-sunken">
              <tr>
                {['Tanggal', 'Trip', 'Supir', 'Mobil', 'Ke-', 'Jenis', 'Uang Jalan', 'Potong Kasbon', 'Transfer ke Supir'].map((h, i) => (
                  <th key={h} className={cn(KELAS_TH, i === 4 || i >= 6 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {termin.map((p) => (
                <tr key={p.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                  <td className="tnum px-4 py-2 whitespace-nowrap text-ink-2">{formatDate(p.payment_date)}</td>
                  <td className="px-4 py-2">
                    <Link to={tautanTrip(p.trip_id)} className="tnum font-semibold whitespace-nowrap text-brand-700 hover:underline">{p.trip.id_tampil}</Link>
                  </td>
                  <td className="px-4 py-2 text-ink">{p.supir_nama || '—'}</td>
                  <td className="tnum px-4 py-2 whitespace-nowrap text-ink-2">{p.trip.plate_number || '—'}</td>
                  <td className="tnum px-4 py-2 text-right text-ink-2">{p.sequence}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-ink-2">{JENIS_TERMIN_LABEL[p.jenis ?? 'uj']}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">{formatRupiah(p.uj_amount)}</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap text-ink-2">{p.kasbon_deduction ? formatRupiah(p.kasbon_deduction) : '—'}</td>
                  <td className="tnum px-4 py-2 text-right font-semibold whitespace-nowrap text-ink">{formatRupiah(p.tf)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-sunken">
              <tr className="font-semibold text-ink">
                <td className="px-4 py-2 whitespace-nowrap" style={GARIS_TOTAL} colSpan={6}>Total · {formatNumber(total.n)} termin, {formatNumber(total.trip)} trip</td>
                <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.uj)}</td>
                <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.kasbon)}</td>
                <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.tf)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )

  if (tertanam) return panel

  return (
    <>
      <PageHeader
        title="Rekap Uang Jalan"
        crumbs={[{ label: 'Laporan' }, { label: 'Uang Jalan' }]}
        description="Rekap pembayaran uang jalan beserta potongan kasbon dan nilai transfer ke supir."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Periode" subtitle="Berdasarkan tanggal bayar termin." />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Awal" required>{(id) => <DateInput id={id} value={lokal.from} onChange={(e) => lokal.setFrom(e.target.value)} />}</Field>
              <Field label="Tanggal Akhir" required>{(id) => <DateInput id={id} value={lokal.to} onChange={(e) => lokal.setTo(e.target.value)} />}</Field>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-2">Tipe Laporan</p>
              <div className="space-y-2">
                <Radio name="uj-mode" label="Rekap per Supir" description="Satu baris per supir."
                  checked={tampil === 'supir'} onChange={() => { gantiTampil('supir'); setError(null) }} />
                <Radio name="uj-mode" label="Rincian per Termin" description="Satu baris per pembayaran."
                  checked={tampil === 'termin'} onChange={() => { gantiTampil('termin'); setError(null) }} />
              </div>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button variant="primary" icon={<FaEye size={15} />} onClick={bukaPreview}>Preview</Button>
              <Button icon={<FaPrint size={15} />} onClick={bukaPreview}>Cetak</Button>
              <Button variant="ghost" icon={<FaXmark size={14} />} onClick={() => { lokal.reset(); setError(null) }}>Batal</Button>
            </div>
          </div>
        </Card>
        {panel}
      </div>
    </>
  )
}
