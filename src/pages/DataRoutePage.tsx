import { useCallback, useMemo, useState } from 'react'
import { Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { PrintDocument, PrintPage, chunkRows } from '../components/report/PrintDocument'
import { ReportPreview } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery, sum } from '../lib/utils'
import { formatNumber, formatRupiah } from '../lib/format'
import type { Route } from '../types'

type FormState = Omit<Route, 'id' | 'created_at' | 'updated_at'>

const BLANK: FormState = { route_code: '', route_name: '', fart: '1X40', ujroute: 0, commissioner: 0, price: 0 }
const FART_OPTIONS = ['1X20', '1X40', '2X20', '1X20K', '1X40K']

export function DataRoutePage() {
  const { db, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState<Route | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Route | null>(null)
  const [fartFilter, setFartFilter] = useState('')
  const [preview, setPreview] = useState(false)

  const search = useCallback((r: Route, q: string) => matchesQuery(q, r.route_code, r.route_name, r.fart), [])
  const extraFilter = useCallback((r: Route) => (fartFilter ? r.fart === fartFilter : true), [fartFilter])
  const table = useTable(db.routes, {
    search, extraFilter, extraFilterActive: !!fartFilter, initialSortKey: 'route_code', pageSize: 10,
  })

  function openCreate() {
    setEditing(null); setForm(BLANK); setErrors({}); setFormOpen(true)
  }

  function openEdit(r: Route) {
    setEditing(r)
    setForm({ route_code: r.route_code, route_name: r.route_name, fart: r.fart, ujroute: r.ujroute, commissioner: r.commissioner, price: r.price })
    setErrors({}); setFormOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const code = form.route_code.trim()
    if (!code) e.route_code = 'No. Route wajib diisi.'
    else if (db.routes.some((r) => r.route_code.toLowerCase() === code.toLowerCase() && r.id !== editing?.id))
      e.route_code = 'No. Route sudah dipakai. Gunakan kode lain.'
    if (!form.route_name.trim()) e.route_name = 'Nama Route wajib diisi.'
    if (form.price <= 0) e.price = 'Harga harus lebih dari 0.'
    if (form.ujroute < 0) e.ujroute = 'UjRoute tidak boleh negatif.'
    if (form.commissioner < 0) e.commissioner = 'Komisioner tidak boleh negatif.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = { ...form, route_code: form.route_code.trim().toUpperCase(), route_name: form.route_name.trim() }
    if (editing) { update('routes', editing.id, payload); toast.success('Data berhasil diperbarui.') }
    else { create('routes', payload); toast.success('Data berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    const used = db.transactions.filter((t) => t.route_id === deleting.id).length
    remove('routes', deleting.id)
    toast.success(used > 0 ? `Data berhasil dihapus. ${used} transaksi terkait kehilangan referensi route.` : 'Data berhasil dihapus.')
    setDeleting(null)
  }

  const printRows = table.filtered
  const printPages = useMemo(() => chunkRows(printRows, 24), [printRows])

  const columns: Column<Route>[] = [
    { key: 'route_code', header: 'No. Route', sortable: true, width: '116px', render: (r) => <span className="tnum font-semibold text-ink">{r.route_code}</span> },
    { key: 'route_name', header: 'Nama Route', sortable: true, render: (r) => <span className="font-medium">{r.route_name}</span> },
    { key: 'fart', header: 'Fart', sortable: true, width: '86px', render: (r) => <Badge tone="neutral">{r.fart}</Badge> },
    { key: 'ujroute', header: 'UjRoute', sortable: true, align: 'right', width: '128px', render: (r) => <span className="tnum">{formatRupiah(r.ujroute)}</span> },
    { key: 'commissioner', header: 'Komisioner', sortable: true, align: 'right', width: '128px', render: (r) => <span className="tnum">{formatRupiah(r.commissioner)}</span> },
    { key: 'price', header: 'Harga', sortable: true, align: 'right', width: '134px', render: (r) => <span className="tnum font-semibold text-ink">{formatRupiah(r.price)}</span> },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(r)} />
          <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setDeleting(r)} />
        </div>
      ),
    },
  ]

  if (preview) {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        <PrintDocument>
          {printPages.map((rows, i) => (
            <PrintPage
              key={i}
              page={i + 1}
              totalPages={printPages.length}
              title="Daftar Master Data Route"
              subtitle={fartFilter ? `Filter Fart: ${fartFilter}` : 'Seluruh route terdaftar'}
              meta={[
                { label: 'Jumlah route', value: `${formatNumber(printRows.length)} route` },
                { label: 'Total Harga', value: formatRupiah(sum(printRows, (r) => r.price)) },
                { label: 'Total Komisioner', value: formatRupiah(sum(printRows, (r) => r.commissioner)) },
              ]}
            >
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-neutral-100">
                    {['No.', 'No. Route', 'Nama Route', 'Fart', 'UjRoute', 'Komisioner', 'Harga'].map((h, hi) => (
                      <th key={h} className={`border border-neutral-400 px-1.5 py-1 font-semibold ${hi > 3 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={r.id}>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{i * 24 + ri + 1}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 font-medium">{r.route_code}</td>
                      <td className="border border-neutral-400 px-1.5 py-1">{r.route_name}</td>
                      <td className="border border-neutral-400 px-1.5 py-1">{r.fart}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.ujroute)}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.commissioner)}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.price)}</td>
                    </tr>
                  ))}
                  {i === printPages.length - 1 && (
                    <tr className="bg-neutral-100 font-bold">
                      <td className="border border-neutral-400 px-1.5 py-1 text-right" colSpan={4}>TOTAL</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.ujroute))}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.commissioner))}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.price))}</td>
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
        title="Data Route"
        crumbs={[{ label: 'Master' }, { label: 'Data Route' }]}
        actions={
          <>
            <Button icon={<Printer size={15} />} onClick={() => setPreview(true)}>Cetak</Button>
            <Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Route</Button>
          </>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari No. Route atau Nama Route..." />
              <FilterField label="Fart">
                <Select value={fartFilter} onChange={(e) => setFartFilter(e.target.value)} className="h-9 w-28">
                  <option value="">Semua</option>
                  {FART_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </FilterField>
            </>
          }
          right={<span className="text-[12.5px] text-ink-3">{db.routes.length} route terdaftar</span>}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="data route" action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah Route</Button>} />}
          notFound={<NotFoundState onReset={() => { table.reset(); setFartFilter('') }} />}
          footer={
            table.total > 0 ? (
              <tr>
                <td className="px-3 py-2 text-[12px] text-ink-2" colSpan={3}>Total {formatNumber(table.total)} route</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px]">{formatRupiah(sum(table.filtered, (r) => r.ujroute))}</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px]">{formatRupiah(sum(table.filtered, (r) => r.commissioner))}</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px] text-ink">{formatRupiah(sum(table.filtered, (r) => r.price))}</td>
                <td />
              </tr>
            ) : undefined
          }
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Data Route' : 'Tambah Data Route'}
        subtitle={editing ? `No. Route ${editing.route_code}` : 'Tanda * wajib diisi. Nominal otomatis diformat Rupiah.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No. Route" required error={errors.route_code} hint={errors.route_code ? undefined : 'Harus unik, mis. PRKSRG43.'}>
            {(id) => <Input id={id} value={form.route_code} invalid={!!errors.route_code} placeholder="PRKSRG43" onChange={(e) => setForm({ ...form, route_code: e.target.value })} />}
          </Field>
          <Field label="Fart" required>
            {(id) => (
              <Select id={id} value={form.fart} onChange={(e) => setForm({ ...form, fart: e.target.value })}>
                {FART_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Nama Route" required error={errors.route_name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.route_name} invalid={!!errors.route_name} placeholder="PRIOK-SERANG 40'(K)" onChange={(e) => setForm({ ...form, route_name: e.target.value })} />}
          </Field>
          <Field label="UjRoute" required error={errors.ujroute}>
            {(id) => <CurrencyInput id={id} value={form.ujroute} invalid={!!errors.ujroute} onValueChange={(v) => setForm({ ...form, ujroute: v })} />}
          </Field>
          <Field label="Komisioner" required error={errors.commissioner}>
            {(id) => <CurrencyInput id={id} value={form.commissioner} invalid={!!errors.commissioner} onValueChange={(v) => setForm({ ...form, commissioner: v })} />}
          </Field>
          <Field label="Harga" required error={errors.price} className="sm:col-span-2">
            {(id) => <CurrencyInput id={id} value={form.price} invalid={!!errors.price} onValueChange={(v) => setForm({ ...form, price: v })} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.route_code} — {deleting?.route_name}</span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
