import { useCallback, useMemo, useState } from 'react'
import { FaPen, FaPlus, FaPrint, FaTrashCan, FaXmark } from '../components/ui/icons'
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
import { ReportPreview, barisPerLembar } from '../components/report/ReportPreview'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useWorkspace } from '../store/WorkspaceProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery, sum } from '../lib/utils'
import { formatNumber, formatRupiah } from '../lib/format'
import { buatKodeUnik } from '../lib/kode'
import { KodeInput } from '../components/ui/KodeInput'
import type { Route, RouteNominal } from '../types'

type FormState = Omit<Route, 'id' | 'created_at' | 'updated_at'>

const BLANK: FormState = { route_code: '', route_name: '', project_id: '', feet: '1X40', ujroute: 0, toll: 0, commissioner: 0, price: 0, estimated_fields: [] }
const FEET_OPTIONS = ['1X20', '1X40', '2X20', '1X20K', '1X40K']

/** Nominal route; yang masih perkiraan diberi keterangan kecil di bawahnya. */
function Nominal({ nilai, kira, tebal }: { nilai: number; kira?: boolean; tebal?: boolean }) {
  return (
    <span className="block leading-tight">
      <span className={tebal ? 'tnum font-semibold text-ink' : 'tnum'}>{formatRupiah(nilai)}</span>
      {kira && (
        <span className="mt-0.5 block text-[11px] text-ink-3" title="Belum ada di data trip. Ganti lewat Ubah bila sudah tahu nilai sebenarnya.">
          perkiraan
        </span>
      )}
    </span>
  )
}

export function DataRoutePage() {
  const { db, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  /** Feet = ukuran container, hanya untuk rute container Priok. Rute Karawang (alat berat) tidak memakainya. */
  const pakaiFeet = useWorkspace().workspace === 'priok'

  const [editing, setEditing] = useState<Route | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Route | null>(null)
  const [feetFilter, setFeetFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  const projectMap = useMemo(() => new Map(db.projects.map((p) => [p.id, p])), [db.projects])
  const [preview, setPreview] = useState(false)

  const search = useCallback(
    (r: Route, q: string) => matchesQuery(q, r.route_code, r.route_name, r.feet, projectMap.get(r.project_id)?.project_code),
    [projectMap],
  )
  const extraFilter = useCallback(
    (r: Route) => (!feetFilter || (feetFilter === '-' ? !r.feet : r.feet === feetFilter)) && (!projectFilter || (projectFilter === '-' ? !r.project_id : r.project_id === projectFilter)),
    [feetFilter, projectFilter],
  )
  const filterAktif = Boolean(feetFilter || projectFilter)
  const table = useTable(db.routes, {
    search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'route_code', pageSize: 10,
  })
  const resetFilter = () => { table.reset(); setFeetFilter(''); setProjectFilter('') }

  function openCreate() {
    setEditing(null); setForm({ ...BLANK, feet: pakaiFeet ? BLANK.feet : '', route_code: buatKodeUnik(db.routes.map((r) => r.route_code)) }); setErrors({}); setFormOpen(true)
  }

  /** Tombol Generate: kode unik (timestamp + 7 huruf acak) yang belum dipakai route lain. */
  function generateKode() {
    const terpakai = db.routes.filter((r) => r.id !== editing?.id).map((r) => r.route_code)
    setForm((f) => ({ ...f, route_code: buatKodeUnik(terpakai) }))
    setErrors((e) => ({ ...e, route_code: undefined }))
  }

  function openEdit(r: Route) {
    setEditing(r)
    setForm({
      route_code: r.route_code, route_name: r.route_name, project_id: r.project_id ?? '', feet: r.feet,
      ujroute: r.ujroute, toll: r.toll ?? 0, commissioner: r.commissioner, price: r.price, estimated_fields: r.estimated_fields ?? [],
    })
    setErrors({}); setFormOpen(true)
  }

  const hargaWajib = !editing || editing.price > 0
  // Route dari data asli belum punya ukuran container; wajib dipilih hanya untuk route baru.
  const feetWajib = pakaiFeet && (!editing || !!editing.feet)
  // Klien trip diambil dari rutenya, jadi rute baru wajib punya klien. Rute lama yang
  // belum punya klien tetap bisa disimpan saat hanya mengubah nominal.
  const klienWajib = !editing || !!editing.project_id

  /** Nominal perkiraan yang belum diubah di form ini. */
  const masihKira = (k: RouteNominal) => !!editing?.estimated_fields?.includes(k) && form[k] === (editing[k] ?? 0)

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const code = form.route_code.trim()
    if (!code) e.route_code = 'No. Route wajib diisi. Klik Generate untuk membuatnya otomatis.'
    else if (db.routes.some((r) => r.route_code.toLowerCase() === code.toLowerCase() && r.id !== editing?.id))
      e.route_code = 'No. Route sudah dipakai. Gunakan kode lain.'
    if (!form.route_name.trim()) e.route_name = 'Nama Route wajib diisi.'
    if (klienWajib && !form.project_id) e.project_id = 'Klien wajib dipilih: trip yang memakai rute ini otomatis milik klien ini.'
    if (feetWajib && !form.feet) e.feet = 'Feet wajib dipilih.'
    // Route dari data asli belum punya harga; jangan paksa diisi saat hanya mengubah UJ / tol.
    if (hargaWajib && form.price <= 0) e.price = 'Harga harus lebih dari 0.'
    if (form.ujroute < 0) e.ujroute = 'UJROUTE tidak boleh negatif.'
    if (form.toll < 0) e.toll = 'Uang Tol tidak boleh negatif.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = {
      ...form,
      route_code: form.route_code.trim().toUpperCase(),
      route_name: form.route_name.trim(),
      // Nominal perkiraan yang diubah admin sudah bukan perkiraan lagi.
      estimated_fields: (editing?.estimated_fields ?? []).filter((k) => form[k] === (editing![k] ?? 0)),
    }
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
  const jumlahKira = db.routes.filter((r) => (r.estimated_fields?.length ?? 0) > 0).length

  const columns: Column<Route>[] = [
    { key: 'route_code', header: 'No. Route', sortable: true, width: '190px', render: (r) => <span className="tnum font-semibold break-all text-ink">{r.route_code}</span> },
    { key: 'route_name', header: 'Nama Route', sortable: true, render: (r) => <span className="font-medium">{r.route_name}</span> },
    {
      key: 'project_id', header: 'Klien', sortable: true, width: '104px',
      render: (r) => {
        const pr = projectMap.get(r.project_id)
        return pr ? <Badge tone="brand">{pr.project_code}</Badge> : <span className="text-ink-3">—</span>
      },
    },
    ...(pakaiFeet ? [{ key: 'feet', header: 'Feet', sortable: true, width: '86px', render: (r: Route) => (r.feet ? <Badge tone="neutral">{r.feet}</Badge> : <span className="text-ink-3">—</span>) }] : []),
    { key: 'ujroute', header: 'UJROUTE', sortable: true, align: 'right', width: '128px', render: (r) => <Nominal nilai={r.ujroute} kira={r.estimated_fields?.includes('ujroute')} /> },
    { key: 'toll', header: 'Uang Tol', sortable: true, align: 'right', width: '128px', render: (r) => <Nominal nilai={r.toll ?? 0} kira={r.estimated_fields?.includes('toll')} /> },
    { key: 'price', header: 'Harga', sortable: true, align: 'right', width: '134px', render: (r) => <Nominal nilai={r.price} kira={r.estimated_fields?.includes('price')} tebal /> },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(r)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(r)} />
        </div>
      ),
    },
  ]

  if (preview) {
    return (
      <ReportPreview onClose={() => setPreview(false)} onPrint={() => window.print()}>
        {(orientasi) => {
          const printPages = chunkRows(printRows, barisPerLembar(orientasi, 24))
          return (
        <PrintDocument>
          {printPages.map((rows, i) => (
            <PrintPage
              key={i}
              page={i + 1}
              totalPages={printPages.length}
              title="Daftar Rute"
              subtitle={pakaiFeet && feetFilter ? `Filter Feet: ${feetFilter}` : 'Seluruh route terdaftar'}
              meta={[
                { label: 'Jumlah route', value: `${formatNumber(printRows.length)} route` },
                { label: 'Total Harga', value: formatRupiah(sum(printRows, (r) => r.price)) },
                { label: 'Total Uang Tol', value: formatRupiah(sum(printRows, (r) => r.toll ?? 0)) },
              ]}
            >
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-neutral-100">
                    {['No.', 'No. Route', 'Nama Route', ...(pakaiFeet ? ['Feet'] : []), 'UJROUTE', 'Uang Tol', 'Harga'].map((h) => (
                      <th key={h} className={`border border-neutral-400 px-1.5 py-1 font-semibold ${['UJROUTE', 'Uang Tol', 'Harga'].includes(h) ? 'text-right' : 'text-left'}`}>
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
                      {pakaiFeet && <td className="border border-neutral-400 px-1.5 py-1">{r.feet || '—'}</td>}
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.ujroute)}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.toll ?? 0)}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(r.price)}</td>
                    </tr>
                  ))}
                  {i === printPages.length - 1 && (
                    <tr className="bg-neutral-100 font-bold">
                      <td className="border border-neutral-400 px-1.5 py-1 text-right" colSpan={pakaiFeet ? 4 : 3}>TOTAL</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.ujroute))}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.toll ?? 0))}</td>
                      <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatNumber(sum(printRows, (r) => r.price))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
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
        title="Rute"
        crumbs={[{ label: 'Master Data' }, { label: 'Rute' }]}
        description="UJROUTE, Uang Tol, dan Harga diambil dari data trip. Yang belum ada datanya bertanda perkiraan; ganti lewat Ubah bila sudah tahu nilai sebenarnya."
        actions={
          <>
            <Button icon={<FaPrint size={15} />} onClick={() => setPreview(true)}>Cetak</Button>
            <Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Rute</Button>
          </>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari No. Route atau Nama Route..." />
              {pakaiFeet && (
                <FilterField label="Feet">
                  <Select value={feetFilter} onChange={(e) => setFeetFilter(e.target.value)} className="h-9 w-28">
                    <option value="">Semua</option>
                    {FEET_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                    <option value="-">Belum diisi</option>
                  </Select>
                </FilterField>
              )}
              <FilterField label="Klien">
                <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-9 w-40">
                  <option value="">Semua</option>
                  {db.projects.map((p) => <option key={p.id} value={p.id}>{p.project_code}</option>)}
                  <option value="-">Tanpa klien</option>
                </Select>
              </FilterField>
              {(table.isFiltered || filterAktif) && <Button size="sm" variant="ghost" icon={<FaXmark size={14} />} onClick={resetFilter}>Reset</Button>}
            </>
          }
          right={(
            <span className="text-[12.5px] text-ink-3">
              {db.routes.length} route terdaftar{jumlahKira > 0 && <> · {jumlahKira} bernominal perkiraan</>}
            </span>
          )}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterAktif}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="rute" />}
          notFound={<NotFoundState onReset={resetFilter} />}
          footer={
            table.total > 0 ? (
              <tr>
                <td className="px-3 py-2 text-[12px] text-ink-2" colSpan={4}>Total {formatNumber(table.total)} route</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px]">{formatRupiah(sum(table.filtered, (r) => r.ujroute))}</td>
                <td className="tnum px-3 py-2 text-right text-[12.5px]">{formatRupiah(sum(table.filtered, (r) => r.toll ?? 0))}</td>
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
        title={editing ? 'Ubah Rute' : 'Tambah Rute'}
        subtitle={editing ? `No. Route ${editing.route_code}` : 'Tanda * wajib diisi. Nominal otomatis diformat Rupiah.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="No. Route"
            required
            error={errors.route_code}
            className="sm:col-span-2"
            hint={errors.route_code ? undefined : 'Terisi otomatis dan dijamin unik. Klik Generate untuk kode baru, atau ketik sendiri.'}
          >
            {(id) => (
              <KodeInput id={id} value={form.route_code} invalid={!!errors.route_code} uppercase
                placeholder="Klik Generate atau ketik manual" generateTitle="Buat No. Route unik otomatis"
                onChange={(v) => setForm({ ...form, route_code: v })} onGenerate={generateKode} />
            )}
          </Field>
          <Field label="Klien" required={klienWajib} error={errors.project_id}
            hint={errors.project_id ? undefined : 'Trip yang memakai rute ini otomatis tercatat ke klien ini, jadi klien tidak dipilih lagi di form trip.'}>
            {(id) => (
              <Select id={id} value={form.project_id} invalid={!!errors.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">{klienWajib ? '— pilih klien —' : '— belum ditentukan —'}</option>
                {db.projects.map((p) => <option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>)}
              </Select>
            )}
          </Field>
          {pakaiFeet && (
          <Field label="Feet" required={feetWajib} error={errors.feet} hint={!form.feet && !errors.feet ? 'Data asli belum mencatat ukuran container route ini.' : undefined}>
            {(id) => (
              <Select id={id} value={form.feet} invalid={!!errors.feet} onChange={(e) => setForm({ ...form, feet: e.target.value })}>
                {!feetWajib && <option value="">— belum diisi —</option>}
                {FEET_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            )}
          </Field>
          )}
          <Field label="Nama Route" required error={errors.route_name} className="sm:col-span-2"
            hint={errors.route_name ? undefined : 'Tulis ASAL - TUJUAN, mis. CIB - DURI: dipakai sebagai lokasi muat & bongkar di Berita Acara. Rute backload, mis. DURI - CIB BCKLD.'}>
            {(id) => <Input id={id} value={form.route_name} invalid={!!errors.route_name} placeholder="CIB - DURI" onChange={(e) => setForm({ ...form, route_name: e.target.value })} />}
          </Field>
          <Field label="UJROUTE" required error={errors.ujroute} hint={errors.ujroute ? undefined : masihKira('ujroute') ? 'Masih perkiraan. Ganti dengan nilai sebenarnya bila sudah tahu.' : 'Patokan uang jalan. Termin dicatat di trip saat dibayar.'}>
            {(id) => <CurrencyInput id={id} value={form.ujroute} invalid={!!errors.ujroute} onValueChange={(v) => setForm({ ...form, ujroute: v })} />}
          </Field>
          <Field label="Uang Tol" error={errors.toll} hint={errors.toll ? undefined : masihKira('toll') ? 'Masih perkiraan. Ganti dengan nilai sebenarnya bila sudah tahu.' : 'Patokan tol. Yang dibayar dicatat di biaya operasional trip.'}>
            {(id) => <CurrencyInput id={id} value={form.toll} invalid={!!errors.toll} onValueChange={(v) => setForm({ ...form, toll: v })} />}
          </Field>
          <Field label="Harga" required={hargaWajib} error={errors.price} hint={errors.price ? undefined : masihKira('price') ? 'Masih perkiraan. Ganti dengan nilai sebenarnya bila sudah tahu.' : 'Komisi sopir kini diatur di Master Data → Aturan Komisi.'}>
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
