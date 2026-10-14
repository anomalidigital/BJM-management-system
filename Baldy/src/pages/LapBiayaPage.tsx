import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaEye, FaPrint, FaReceipt, FaXmark } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, DateInput, Select, FieldError } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { RankingBars } from '../components/charts/RankingBars'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { PrintTable, PRow, PCell } from '../components/report/PrintTable'
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { formatDate, formatNumber, formatRupiah } from '../lib/format'
import { cn, groupBy } from '../lib/utils'
import { usePeriodeDefault } from '../lib/periode'
import { biayaDitagihkan, dibayarPerusahaan } from '../lib/trip'
import { EXPENSE_TYPES, labelBiaya } from '../types'
import type { OperationalExpense, TransactionRow, UjPayment } from '../types'
import { GARIS_TOTAL, JudulDiagram, KELAS_TH, RumusAngka } from './LapUangJalanPage'

/** Nota biaya operasional dalam periode, digabung dengan trip-nya. */
export interface NotaTrip extends OperationalExpense {
  trip: TransactionRow
  /** Ikut ditagihkan ke klien (isian nota, atau mengikuti jenisnya). */
  ditagih: boolean
  /** Dibayar perusahaan langsung, bukan dari uang jalan supir. */
  olehPerusahaan: boolean
}

/** Nota yang tanggalnya masuk periode. Nota trip batal sudah tidak ada di `db.expenses`. */
export function notaPeriode(expenses: OperationalExpense[], tripById: Map<string, TransactionRow>, awal: string, akhir: string): NotaTrip[] {
  const hasil: NotaTrip[] = []
  for (const e of expenses) {
    if (e.expense_date < awal || e.expense_date > akhir) continue
    const trip = tripById.get(e.trip_id)
    if (trip) hasil.push({ ...e, trip, ditagih: biayaDitagihkan(e), olehPerusahaan: dibayarPerusahaan(e) })
  }
  return hasil.sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.trip.transaction_no.localeCompare(b.trip.transaction_no))
}

/**
 * Uang dorong tetap dicatat sebagai termin Uang Jalan (keputusan 7 Okt 2026). Di Biaya
 * Operasional hanya ditampilkan sebagai keterangan dan tidak ikut dijumlah / ditagihkan.
 */
function uangDorongPeriode(ujPayments: UjPayment[], tripById: Map<string, TransactionRow>, awal: string, akhir: string) {
  return ujPayments
    .filter((p) => p.jenis === 'uang_dorong' && p.payment_date >= awal && p.payment_date <= akhir && tripById.has(p.trip_id))
    .map((p) => ({ ...p, trip: tripById.get(p.trip_id) as TransactionRow }))
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date))
}

/** Penanda ditagihkan per jenis biaya: semua, sebagian, atau tidak sama sekali. */
function penandaTagih(nominal: number, tagih: number): string {
  if (tagih <= 0) return 'tidak ditagihkan'
  return tagih >= nominal ? 'ditagihkan ke klien' : `sebagian ditagihkan (${formatRupiah(tagih, { compact: true })})`
}

/**
 * Warna bagian "ditagihkan ke klien": hijau palet data (slot 6), senada lencana "Ke klien" di
 * detail trip. Sama dengan di tab Per Trip.
 */
const WARNA_TAGIH = '#008300'
/** Bagian sisanya: abu-abu, supaya yang ditagihkan menonjol. */
const WARNA_SISA = '#c3c2b7'

const tautanBawaan = (tripId: string) => `/transaksi/trip/${tripId}?tab=biaya`

interface Props {
  /** Dirender sebagai tab di halaman Rekap Pengeluaran: tanpa kepala halaman & kartu Filter sendiri. */
  tertanam?: boolean
  /** Periode dari kepala halaman Rekap Pengeluaran (mode tertanam). */
  periode?: { awal: string; akhir: string }
  /** Jenis biaya terpilih ('' = semua); saat tertanam diatur halaman induk (disimpan di URL). */
  jenis?: string
  onJenis?: (j: string) => void
  /** Saat tertanam, preview cetak dibuka dari tombol di kepala halaman induk. */
  preview?: boolean
  onTutupPreview?: () => void
  /** Alamat detail trip dari baris tabel; bawaan membuka tab Biaya Operasional trip itu. */
  tautanTrip?: (tripId: string) => string
}

/**
 * Laporan Biaya Operasional: nota DEX, tol, SPSI Banlok, overnight, dan biaya lain per trip,
 * dengan tanda mana yang ikut ditagihkan ke klien. Kini tampil sebagai tab di Rekap Pengeluaran.
 */
export function LapBiayaPage({
  tertanam = false,
  periode,
  jenis: jenisInduk,
  onJenis,
  preview: previewInduk,
  onTutupPreview,
  tautanTrip = tautanBawaan,
}: Props = {}) {
  const { db, transactionRows } = useData()
  const toast = useToast()
  const { workspace } = useWorkspace()
  const lokal = usePeriodeDefault(db.expenses.map((e) => e.expense_date))
  const awal = periode?.awal ?? lokal.from
  const akhir = periode?.akhir ?? lokal.to
  const [jenisLokal, setJenisLokal] = useState('')
  const jenis = jenisInduk ?? jenisLokal
  const gantiJenis = (j: string) => (onJenis ? onJenis(j) : setJenisLokal(j))
  const [previewLokal, setPreviewLokal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = tertanam ? !!previewInduk : previewLokal
  const tutupPreview = () => (tertanam ? onTutupPreview?.() : setPreviewLokal(false))

  const tripById = useMemo(() => new Map(transactionRows.map((t) => [t.id, t])), [transactionRows])
  const semua = useMemo(() => notaPeriode(db.expenses, tripById, awal, akhir), [db.expenses, tripById, awal, akhir])
  const rows = useMemo(() => (jenis ? semua.filter((e) => e.expense_type === jenis) : semua), [semua, jenis])
  // Uang dorong bukan jenis biaya: hanya tampil saat semua jenis ditampilkan.
  const dorong = useMemo(() => (jenis ? [] : uangDorongPeriode(db.ujPayments, tripById, awal, akhir)), [db.ujPayments, tripById, awal, akhir, jenis])

  const total = useMemo(() => ({
    nominal: rows.reduce((a, e) => a + e.amount, 0),
    tagih: rows.filter((e) => e.ditagih).reduce((a, e) => a + e.amount, 0),
    perusahaan: rows.filter((e) => e.olehPerusahaan).reduce((a, e) => a + e.amount, 0),
    dorong: dorong.reduce((a, p) => a + p.uj_amount, 0),
  }), [rows, dorong])

  const perJenis = useMemo(() => {
    const g = groupBy(rows, (e) => e.expense_type)
    return Object.entries(g)
      .map(([kode, items]) => ({
        kode,
        n: items.length,
        nominal: items.reduce((a, e) => a + e.amount, 0),
        tagih: items.filter((e) => e.ditagih).reduce((a, e) => a + e.amount, 0),
      }))
      .sort((a, b) => b.nominal - a.nominal)
  }, [rows])

  // Pilihan jenis: urutan master, ditambah jenis lama yang masih ada di data.
  const daftarJenis = useMemo(() => {
    const ada = new Set<string>(EXPENSE_TYPES)
    const lama = [...new Set(db.expenses.map((e) => e.expense_type))].filter((k) => k && !ada.has(k)).sort()
    return [...EXPENSE_TYPES, ...lama]
  }, [db.expenses])

  const karawang = workspace === 'karawang'
  const labelId = karawang ? 'ID Trip' : 'No. Trip'
  const periodeText = `${formatDate(awal)} s/d ${formatDate(akhir)}`
  const sisa = Math.max(0, total.nominal - total.tagih)
  const persen = (n: number) => (total.nominal > 0 ? (n / total.nominal) * 100 : 0)
  const tulisPersen = (n: number) => { const p = persen(n); return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%` }

  function bukaPreview() {
    if (awal > akhir) { setError('Tanggal Awal tidak boleh lebih besar dari Tanggal Akhir.'); return }
    if (rows.length === 0) { setError('Tidak ada biaya pada periode tersebut.'); toast.info('Tidak ada data untuk ditampilkan.'); return }
    setError(null); setPreviewLokal(true)
  }

  if (preview) {
    return (
      <ReportPreview onClose={tutupPreview} onPrint={() => window.print()}>
        {(orientasi) => {
          const per = barisPerLembar(orientasi, 24)
          const pages = chunkRows(rows, per)
          return (
            <PrintDocument>
              {pages.map((page, i) => (
                <PrintPage key={i} page={i + 1} totalPages={pages.length}
                  title="Rekap Biaya Operasional"
                  subtitle={`${jenis ? `Jenis biaya: ${labelBiaya(jenis)}` : 'Seluruh jenis biaya'} · berdasarkan tanggal nota`}
                  periode={periodeText}
                  meta={[
                    { label: 'Jumlah nota', value: formatNumber(rows.length) },
                    { label: 'Total biaya', value: formatRupiah(total.nominal) },
                    { label: 'Ditagihkan ke klien', value: formatRupiah(total.tagih) },
                  ]}
                >
                  <PrintTable cols={[
                    { label: 'No.', align: 'right', width: '5%' }, { label: 'Tanggal', width: '10%' },
                    { label: labelId, width: karawang ? '19%' : '12%' }, { label: 'Supir' }, { label: 'Mobil', width: '11%' },
                    { label: 'Jenis Biaya', width: '13%' }, { label: 'Ditagihkan', align: 'center', width: '9%' },
                    { label: 'Nominal (Rp)', align: 'right', width: '13%' },
                  ]}>
                    {page.map((e, ri) => (
                      <PRow key={e.id}>
                        <PCell align="right">{i * per + ri + 1}</PCell>
                        <PCell>{formatDate(e.expense_date)}</PCell>
                        <PCell>{e.trip.id_tampil}</PCell>
                        <PCell>{e.trip.driver_names || '-'}</PCell>
                        <PCell>{e.trip.plate_number || '-'}</PCell>
                        <PCell>{labelBiaya(e.expense_type)}</PCell>
                        <PCell align="center">{e.ditagih ? 'Ya' : '-'}</PCell>
                        <PCell align="right" bold>{formatNumber(e.amount)}</PCell>
                      </PRow>
                    ))}
                    {i === pages.length - 1 && (
                      <>
                        <PRow tone="total">
                          <PCell align="right" colSpan={7}>TOTAL</PCell>
                          <PCell align="right">{formatNumber(total.nominal)}</PCell>
                        </PRow>
                        {total.dorong > 0 && (
                          <PRow tone="group">
                            <PCell colSpan={7}>Uang Dorong (dari Uang Jalan, {dorong.length} termin) — tidak termasuk total</PCell>
                            <PCell align="right">{formatNumber(total.dorong)}</PCell>
                          </PRow>
                        )}
                      </>
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

  const panel = (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><FaReceipt size={15} className="text-brand-600" />Biaya Operasional</span>}
        subtitle={`${formatNumber(rows.length)} nota${jenis ? ` jenis ${labelBiaya(jenis)}` : ''} pada ${periodeText}. Dihitung dari tanggal nota.`}

      />

      <div className="grid gap-6 border-b border-hairline p-4 lg:grid-cols-2">
        <section aria-label="Biaya per jenis">
          <JudulDiagram judul="Biaya per jenis (Rp)" keterangan="Tiap jenis diberi tanda apakah ikut ditagihkan ke klien lewat PI." />
          {perJenis.length > 0
            ? <RankingBars rows={perJenis.map((r) => ({ id: r.kode, label: labelBiaya(r.kode), meta: `${r.n} nota · ${penandaTagih(r.nominal, r.tagih)}`, value: r.nominal }))} />
            : <p className="py-10 text-center text-[12.5px] text-ink-3">Tidak ada biaya pada periode tersebut.</p>}
          {total.dorong > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-hairline bg-sunken px-3 py-2 text-[12.5px] text-ink-2">
              <span className="font-medium text-ink">Uang Dorong</span>
              <Badge>dari Uang Jalan</Badge>
              <span className="tnum">{formatRupiah(total.dorong)} · {dorong.length} termin</span>
              <span className="text-ink-3">Hanya keterangan: dicatat di Uang Jalan, tidak ikut dijumlah atau ditagihkan.</span>
            </p>
          )}
        </section>

        <section aria-label="Biaya yang ditagihkan ke klien">
          <JudulDiagram judul="Ditagihkan ke klien" keterangan="Bagian biaya yang ditagih kembali ke klien sebagai Additional Cost di PI." />
          {total.nominal > 0 ? (
            <>
              <div className="flex gap-[2px] overflow-hidden" style={{ height: 14, borderRadius: 4 }} role="img"
                aria-label={`Ditagihkan ke klien ${tulisPersen(total.tagih)}, tidak ditagihkan ${tulisPersen(sisa)}`}>
                {total.tagih > 0 && <span title={`Ditagihkan ke klien: ${formatRupiah(total.tagih)}`} style={{ width: `${persen(total.tagih)}%`, minWidth: 3, background: WARNA_TAGIH }} />}
                {sisa > 0 && <span title={`Tidak ditagihkan: ${formatRupiah(sisa)}`} style={{ width: `${persen(sisa)}%`, minWidth: 3, background: WARNA_SISA }} />}
              </div>
              <ul className="mt-3 space-y-1.5 text-[12.5px]">
                {[
                  { label: 'Ditagihkan ke klien', nilai: total.tagih, warna: WARNA_TAGIH },
                  { label: 'Tidak ditagihkan (ditanggung perusahaan)', nilai: sisa, warna: WARNA_SISA },
                ].map((b) => (
                  <li key={b.label} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-ink-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: b.warna }} aria-hidden="true" />
                      {b.label}
                    </span>
                    <span className="tnum shrink-0 whitespace-nowrap text-ink">
                      <span className="font-semibold">{formatRupiah(b.nilai)}</span>
                      <span className="ml-1.5 text-ink-3">{tulisPersen(b.nilai)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-hairline pt-4">
                <RumusAngka suku={[
                  { label: 'Dibayar supir (dari UJ)', nilai: total.nominal - total.perusahaan },
                  { label: 'Dibayar perusahaan', nilai: total.perusahaan, operator: '+' },
                  { label: 'Total biaya', nilai: total.nominal, operator: '=', tebal: true },
                ]} />
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-[12.5px] text-ink-3">Belum ada biaya pada periode ini.</p>
          )}
        </section>
      </div>

      {rows.length === 0 && dorong.length === 0 ? (
        <p className="px-4 py-12 text-center text-[13px] text-ink-3">Tidak ada biaya pada periode tersebut.</p>
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-sunken">
              <tr>
                {['Tanggal', 'Trip', 'Mobil · Supir', 'Jenis', 'Dibayar oleh', 'Ditagihkan', 'Nominal'].map((h, i) => (
                  <th key={h} className={cn(KELAS_TH, i === 6 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                  <td className="tnum px-4 py-2 whitespace-nowrap text-ink-2">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-2">
                    <Link to={tautanTrip(e.trip_id)} className="tnum font-semibold whitespace-nowrap text-brand-700 hover:underline">{e.trip.id_tampil}</Link>
                  </td>
                  <td className="px-4 py-2 leading-tight text-ink-2">
                    <span className="tnum block whitespace-nowrap">{e.trip.plate_number || '—'}</span>
                    <span className="block text-xs text-ink-3">{e.trip.driver_names || '—'}</span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-ink">{labelBiaya(e.expense_type)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-ink-2">{e.olehPerusahaan ? 'Perusahaan' : 'Supir (dari UJ)'}</td>
                  <td className="px-4 py-2">{e.ditagih ? <Badge tone="good">Ke klien</Badge> : <span className="text-ink-3">—</span>}</td>
                  <td className="tnum px-4 py-2 text-right font-semibold whitespace-nowrap text-ink">{formatRupiah(e.amount)}</td>
                </tr>
              ))}
              {dorong.length > 0 && (
                <tr className="bg-sunken">
                  <td colSpan={7} className="px-4 pt-2 pb-1.5 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">
                    Dari Uang Jalan · hanya keterangan, tidak ikut total
                  </td>
                </tr>
              )}
              {dorong.map((p) => (
                <tr key={p.id} className="border-b border-grid text-ink-3 last:border-0">
                  <td className="tnum px-4 py-2 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                  <td className="px-4 py-2">
                    <Link to={tautanTrip(p.trip_id)} className="tnum font-semibold whitespace-nowrap text-brand-700 hover:underline">{p.trip.id_tampil}</Link>
                  </td>
                  <td className="px-4 py-2 leading-tight">
                    <span className="tnum block whitespace-nowrap">{p.trip.plate_number || '—'}</span>
                    <span className="block text-xs">{p.trip.driver_names || '—'}</span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">Uang Dorong <Badge className="ml-1">dari Uang Jalan</Badge></td>
                  <td className="px-4 py-2 whitespace-nowrap">Termin ke-{p.sequence}</td>
                  <td className="px-4 py-2">—</td>
                  <td className="tnum px-4 py-2 text-right whitespace-nowrap">{formatRupiah(p.uj_amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-sunken">
              <tr className="font-semibold text-ink">
                <td className="px-4 py-2 whitespace-nowrap" style={GARIS_TOTAL} colSpan={5}>
                  Total · {formatNumber(rows.length)} nota{jenis ? ` jenis ${labelBiaya(jenis)}` : ''}
                </td>
                <td className="tnum px-4 py-2 whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.tagih)}</td>
                <td className="tnum px-4 py-2 text-right whitespace-nowrap" style={GARIS_TOTAL}>{formatRupiah(total.nominal)}</td>
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
        title="Rekap Biaya Operasional"
        crumbs={[{ label: 'Laporan' }, { label: 'Biaya Operasional' }]}
        description="Rekap DEX, tol, SPSI Banlok, overnight, dan biaya lain yang tercatat pada setiap trip."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Filter" subtitle="Berdasarkan tanggal nota." />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tanggal Awal" required>{(id) => <DateInput id={id} value={lokal.from} onChange={(e) => lokal.setFrom(e.target.value)} />}</Field>
              <Field label="Tanggal Akhir" required>{(id) => <DateInput id={id} value={lokal.to} onChange={(e) => lokal.setTo(e.target.value)} />}</Field>
            </div>
            <Field label="Jenis Biaya">
              {(id) => (
                <Select id={id} value={jenis} onChange={(e) => gantiJenis(e.target.value)}>
                  <option value="">Semua jenis</option>
                  {daftarJenis.map((t) => <option key={t} value={t}>{labelBiaya(t)}</option>)}
                </Select>
              )}
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button variant="primary" icon={<FaEye size={15} />} onClick={bukaPreview}>Preview</Button>
              <Button icon={<FaPrint size={15} />} onClick={bukaPreview}>Cetak</Button>
              <Button variant="ghost" icon={<FaXmark size={14} />} onClick={() => { lokal.reset(); gantiJenis(''); setError(null) }}>Batal</Button>
            </div>
          </div>
        </Card>
        {panel}
      </div>
    </>
  )
}
