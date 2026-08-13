import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Printer, Search, Ship, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { DataContohNotice } from '../components/ui/DataNotice'
import { Card, CardHeader, InfoItem } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Checkbox, Label } from '../components/ui/Field'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Badge } from '../components/ui/Badge'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { ReportPreview } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { formatDate, formatNumber } from '../lib/format'
import type { TransactionRow } from '../types'

/**
 * Pencarian nomor SI - Job Order.
 * Bisa diakses langsung dengan mengetik nomor, atau otomatis terisi ketika
 * user mengklik nilai Sijo dari Browsing Data / Data Komisi / Surat Jalan.
 */
export function SijoSearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { db, transactionRows, loading } = useData()

  const [input, setInput] = useState('')
  const [komplitOnly, setKomplitOnly] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [preview, setPreview] = useState(false)

  const joOptions = useMemo(
    () =>
      db.jobOrders
        .filter((j) => (komplitOnly ? j.is_complete : true))
        .map((j) => ({ value: j.sijo, label: j.sijo, meta: `${j.customer_name} · ${j.party}`, keywords: j.customer_code })),
    [db.jobOrders, komplitOnly],
  )

  // Nomor dari URL (hasil klik pada kolom Sijo) langsung dicari.
  useEffect(() => {
    const fromUrl = params.get('sijo')
    if (fromUrl) {
      setInput(fromUrl)
      setSubmitted(fromUrl)
    }
  }, [params])

  const jobOrder = useMemo(
    () => (submitted ? db.jobOrders.find((j) => j.sijo === submitted.trim()) ?? null : null),
    [submitted, db.jobOrders],
  )

  const rows = useMemo(
    () =>
      jobOrder
        ? transactionRows
            .filter((t) => t.job_order_id === jobOrder.id)
            .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
        : [],
    [jobOrder, transactionRows],
  )

  useEffect(() => {
    if (submitted !== null) setNotFound(!jobOrder)
  }, [submitted, jobOrder])

  function doSearch(value?: string) {
    const q = (value ?? input).trim()
    setSubmitted(q)
    if (q) setParams({ sijo: q }, { replace: true })
    else setParams({}, { replace: true })
  }

  function clearSearch() {
    setInput(''); setSubmitted(null); setNotFound(false); setParams({}, { replace: true })
  }

  const columns: Column<TransactionRow>[] = [
    { key: 'sijo', header: 'Sijo', width: '110px', render: (t) => <span className="tnum font-semibold text-ink">{t.sijo}</span> },
    { key: 'transaction_date', header: 'Tgltrans', sortable: true, width: '116px', render: (t) => <span className="tnum text-ink-2">{formatDate(t.transaction_date)}</span> },
    { key: 'plate_number', header: 'No.Mobil', sortable: true, width: '136px', render: (t) => <span className="tnum font-medium">{t.plate_number || '—'}</span> },
    { key: 'driver_name', header: 'Sopir', sortable: true, render: (t) => <span className="font-medium">{t.driver_name || '—'}</span> },
    { key: 'container_no', header: 'Kont', sortable: true, width: '160px', render: (t) => <span className="tnum text-ink-2">{t.container_no || '—'}</span> },
  ]

  const printPages = useMemo(() => chunkRows(rows, 26), [rows])

  if (preview && jobOrder) {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        <PrintDocument>
          {printPages.map((pageRows, i) => (
            <PrintPage
              key={i}
              page={i + 1}
              totalPages={printPages.length}
              title="Daftar Mobil per SI / Job Order"
              subtitle={`SI / Job Order ${jobOrder.sijo}`}
              meta={[
                { label: 'Customer', value: jobOrder.customer_name },
                { label: 'Kode Cust', value: jobOrder.customer_code },
                { label: 'Party', value: jobOrder.party },
                { label: 'Kapal', value: jobOrder.ship },
                { label: 'Barang', value: jobOrder.goods },
                { label: 'Status', value: jobOrder.is_complete ? 'Komplit' : 'Belum komplit' },
              ]}
            >
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-neutral-100">
                    {['No.', 'Sijo', 'Tgltrans', 'No.Mobil', 'Sopir', 'Kont'].map((h) => (
                      <th key={h} className="border border-neutral-400 px-1.5 py-1 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t, ri) => (
                    <tr key={t.id}>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{i * 26 + ri + 1}</td>
                      <td className="border border-neutral-400 px-1.5 py-1">{t.sijo}</td>
                      <td className="border border-neutral-400 px-1.5 py-1">{formatDate(t.transaction_date)}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 font-medium">{t.plate_number}</td>
                      <td className="border border-neutral-400 px-1.5 py-1">{t.driver_name}</td>
                      <td className="border border-neutral-400 px-1.5 py-1">{t.container_no || '-'}</td>
                    </tr>
                  ))}
                  {i === printPages.length - 1 && (
                    <tr className="bg-neutral-100 font-bold">
                      <td className="border border-neutral-400 px-1.5 py-1 text-right" colSpan={6}>
                        Jumlah: {rows.length} MOBIL
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </PrintPage>
          ))}
        </PrintDocument>
      </ReportPreview>
    )
  }

  return (
    <>
      <PageHeader
        title="Pencarian nomor SI - Job Order"
        legacyTitle="Pencarian nomor SI - Job Order"
        crumbs={[{ label: 'Pencarian' }, { label: 'SI / Job Order' }]}
        description="Ketik nomor SI / Job Order, atau klik nilai Sijo dari halaman lain untuk langsung membuka detailnya."
      />

      <DataContohNotice modul="SI / Job Order" />

      <Card className="mb-4">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sijo-input">No. SI / Job Order</Label>
              <div className="flex gap-2">
                <Input
                  id="sijo-input"
                  value={input}
                  placeholder="3252209"
                  className="tnum max-w-xs"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
                />
                <Button variant="primary" icon={<Search size={15} />} onClick={() => doSearch()}>Cari</Button>
                {submitted && <Button variant="ghost" icon={<X size={14} />} onClick={clearSearch}>Bersihkan</Button>}
              </div>
            </div>
            <div>
              <Label>Atau pilih dari daftar</Label>
              <SearchableSelect
                options={joOptions}
                value={jobOrder?.sijo ?? null}
                placeholder="Cari SI / Job Order..."
                onChange={(v) => { setInput(v ?? ''); doSearch(v ?? '') }}
              />
            </div>
          </div>
          <div className="pb-2">
            <Checkbox
              label="Komplit"
              checked={komplitOnly}
              onChange={(e) => setKomplitOnly(e.target.checked)}
            />
            <p className="mt-1 text-[11.5px] text-ink-3">Batasi daftar hanya SI/JO berstatus Komplit.</p>
          </div>
        </div>
      </Card>

      {submitted === null ? (
        <Card>
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-hairline bg-sunken text-ink-3">
              <Ship size={20} />
            </div>
            <p className="text-[14px] font-semibold text-ink">Masukkan nomor SI / Job Order.</p>
            <p className="mt-1 text-[13px] text-ink-3">Sistem akan menampilkan customer beserta daftar mobil dan sopirnya.</p>
          </div>
        </Card>
      ) : notFound ? (
        <Card>
          <div className="px-6 py-16 text-center">
            <p className="text-[14px] font-semibold text-ink">Data tidak ditemukan.</p>
            <p className="mt-1 text-[13px] text-ink-3">Coba periksa kembali kata kunci atau filter.</p>
            <Button className="mt-4" onClick={clearSearch}>Bersihkan pencarian</Button>
          </div>
        </Card>
      ) : (
        jobOrder && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={`SI / Job Order ${jobOrder.sijo}`}
                subtitle="Informasi customer diambil otomatis dari master SI / Job Order."
                actions={jobOrder.is_complete ? <Badge tone="good">Komplit</Badge> : <Badge tone="warning">Belum komplit</Badge>}
              />
              <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <InfoItem label="Customer" value={jobOrder.customer_name} />
                <InfoItem label="Kode Cust" value={jobOrder.customer_code} mono />
                <InfoItem label="Party" value={jobOrder.party} />
                <InfoItem label="Kapal" value={jobOrder.ship} />
                <InfoItem label="Barang" value={jobOrder.goods} />
              </dl>
            </Card>

            <Card>
              <CardHeader
                title="Daftar Mobil &amp; Sopir"
                subtitle="Seluruh transaksi yang terhubung dengan SI / Job Order ini."
                actions={
                  <>
                    <Button icon={<Printer size={15} />} disabled={rows.length === 0} onClick={() => setPreview(true)}>Cetak</Button>
                    <Button variant="primary" onClick={() => navigate('/transaksi/tagihan')}>Selesai</Button>
                  </>
                }
              />
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(t) => t.id}
                loading={loading}
                maxHeight="480px"
                empty={
                  <div className="px-6 py-12 text-center">
                    <p className="text-[13.5px] font-semibold text-ink">Belum ada transaksi untuk SI/JO ini.</p>
                    <p className="mt-1 text-[13px] text-ink-3">Buat transaksi pada halaman Data Komisi.</p>
                  </div>
                }
              />
              <div className="flex items-center justify-between border-t border-hairline bg-sunken px-4 py-2.5">
                <p className="tnum text-[13px] font-semibold text-ink">
                  Jumlah: {formatNumber(rows.length)} MOBIL
                </p>
                <p className="text-[12px] text-ink-3">
                  {new Set(rows.map((r) => r.driver_id)).size} sopir terlibat
                </p>
              </div>
            </Card>
          </div>
        )
      )}
    </>
  )
}
