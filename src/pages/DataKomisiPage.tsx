import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, CircleHelp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, DateInput, Select } from '../components/ui/Field'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import { formatDate, startOfMonthISO, todayISO } from '../lib/format'
import type { CommissionTransaction, TransactionRow } from '../types'

type FormState = Omit<CommissionTransaction, 'id' | 'created_at' | 'updated_at' | 'is_marked'>

export function DataKomisiPage() {
  const { db, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<'hapus' | 'selesai' | null>(null)
  const [show4B, setShow4B] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const nextTrxNo = useMemo(() => {
    const ym = todayISO().slice(0, 4) + todayISO().slice(5, 7)
    const max = db.transactions
      .filter((t) => t.transaction_no.startsWith(ym))
      .reduce((acc, t) => Math.max(acc, Number(t.transaction_no.slice(6)) || 0), 0)
    return `${ym}${String(max + 1).padStart(4, '0')}`
  }, [db.transactions])

  const blank = (): FormState => ({
    transaction_no: nextTrxNo, transaction_date: todayISO(), driver_id: '', vehicle_id: '',
    job_order_id: '', route_id: '', destination_detail: '', container_no: '',
    is_done: false, bon_date: null, personal_bon: 0,
  })
  const [form, setForm] = useState<FormState>(blank)

  const search = useCallback(
    (t: TransactionRow, q: string) =>
      matchesQuery(q, t.transaction_no, t.driver_code, t.driver_name, t.plate_number, t.sijo, t.route_code, t.destination_detail, t.container_no),
    [],
  )
  const extraFilter = useCallback(
    (t: TransactionRow) =>
      (!dateFrom || t.transaction_date >= dateFrom) &&
      (!dateTo || t.transaction_date <= dateTo) &&
      (!statusFilter || (statusFilter === 'selesai' ? t.is_done : !t.is_done)),
    [dateFrom, dateTo, statusFilter],
  )
  const filterActive = Boolean(dateFrom || dateTo || statusFilter)
  const table = useTable(transactionRows, {
    search, extraFilter, extraFilterActive: filterActive,
    initialSortKey: 'transaction_date', initialSortDir: 'desc', pageSize: 10,
  })

  const driverOptions = useMemo(
    () => db.drivers.filter((d) => d.status === 'aktif').map((d) => ({ value: d.id, label: `${d.driver_code} — ${d.driver_name}`, meta: `${d.address_2}, ${d.city}`, keywords: d.driver_name })),
    [db.drivers],
  )
  const vehicleOptions = useMemo(
    () => db.vehicles.map((v) => ({ value: v.id, label: v.plate_number, meta: `${v.vehicle_type}${v.status !== 'aktif' ? ' · ' + v.status : ''}` })),
    [db.vehicles],
  )
  const routeOptions = useMemo(
    () => db.routes.map((r) => ({ value: r.id, label: r.route_code, meta: r.route_name, keywords: r.fart })),
    [db.routes],
  )
  const joOptions = useMemo(
    () => db.jobOrders.map((j) => ({ value: j.id, label: j.sijo, meta: `${j.customer_name} · ${j.party}`, keywords: j.customer_code })),
    [db.jobOrders],
  )

  function openCreate() {
    setEditing(null); setForm(blank()); setErrors({}); setFormOpen(true)
  }

  function openEdit(t: TransactionRow) {
    setEditing(t)
    setForm({
      transaction_no: t.transaction_no, transaction_date: t.transaction_date, driver_id: t.driver_id,
      vehicle_id: t.vehicle_id, job_order_id: t.job_order_id, route_id: t.route_id,
      destination_detail: t.destination_detail, container_no: t.container_no,
      is_done: t.is_done, bon_date: t.bon_date, personal_bon: t.personal_bon,
    })
    setErrors({}); setFormOpen(true)
  }

  /** Detail Tujuan diambil otomatis dari master Route saat route dipilih. */
  function applyRoute(routeId: string | null) {
    const route = db.routes.find((r) => r.id === routeId)
    setForm((f) => ({
      ...f,
      route_id: routeId ?? '',
      destination_detail: route ? route.route_name : '',
    }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.transaction_no.trim()) e.transaction_no = 'NoTrans wajib diisi.'
    else if (db.transactions.some((t) => t.transaction_no === form.transaction_no.trim() && t.id !== editing?.id))
      e.transaction_no = 'NoTrans sudah dipakai.'
    if (!form.transaction_date) e.transaction_date = 'Tanggal wajib diisi.'
    if (!form.job_order_id) e.job_order_id = 'S / JO wajib dipilih.'
    if (!form.driver_id) e.driver_id = 'Sopir wajib dipilih.'
    if (!form.vehicle_id) e.vehicle_id = 'No Mobil wajib dipilih.'
    if (!form.route_id) e.route_id = 'Kode Route wajib dipilih.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) { toast.error('Periksa kembali isian yang ditandai merah.'); return }
    const payload = { ...form, transaction_no: form.transaction_no.trim(), container_no: form.container_no.trim().toUpperCase() }
    if (editing) { update('transactions', editing.id, payload); toast.success('Data berhasil diperbarui.') }
    else { create('transactions', { ...payload, is_marked: false }); toast.success('Data berhasil disimpan.') }
    setFormOpen(false)
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const ids = table.pageRows.map((t) => t.id)
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }

  function doHapus() {
    const n = remove('transactions', [...selected])
    setSelected(new Set()); setConfirm(null)
    toast.success(`${n} transaksi berhasil dihapus.`)
  }

  function doSelesai() {
    selected.forEach((id) => update('transactions', id, { is_done: true }))
    toast.success(`${selected.size} transaksi ditandai Selesai.`)
    setSelected(new Set()); setConfirm(null)
  }

  function resetFilters() {
    table.reset(); setDateFrom(''); setDateTo(''); setStatusFilter('')
  }

  const columns: Column<TransactionRow>[] = [
    { key: 'transaction_no', header: 'NoTrans', sortable: true, width: '116px', render: (t) => <span className="tnum font-semibold text-ink">{t.transaction_no}</span> },
    { key: 'transaction_date', header: 'Tanggal', sortable: true, width: '104px', render: (t) => <span className="tnum text-ink-2">{formatDate(t.transaction_date)}</span> },
    { key: 'driver_code', header: 'Kode Sopir', sortable: true, width: '104px', render: (t) => <span className="tnum text-ink-2">{t.driver_code || '—'}</span> },
    { key: 'driver_name', header: 'Nama Sopir', sortable: true, render: (t) => <span className="font-medium">{t.driver_name || '—'}</span> },
    { key: 'plate_number', header: 'No Mobil', sortable: true, width: '124px', render: (t) => <span className="tnum text-ink-2">{t.plate_number || '—'}</span> },
    {
      key: 'sijo', header: 'S / JO', sortable: true, width: '106px',
      render: (t) => (
        <Link to={`/pencarian/sijo?sijo=${t.sijo}`} className="tnum font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
          {t.sijo || '—'}
        </Link>
      ),
    },
    { key: 'route_code', header: 'Kode Route', sortable: true, width: '112px', render: (t) => <span className="tnum text-ink-2">{t.route_code || '—'}</span> },
    { key: 'destination_detail', header: 'Detail Tujuan', sortable: true, render: (t) => <span className="text-ink-2">{t.destination_detail || '—'}</span> },
    {
      key: 'is_done', header: 'Status', sortable: true, width: '104px',
      render: (t) => (t.is_done ? <Badge tone="good">Selesai</Badge> : <Badge tone="warning">Proses</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '84px',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(t)} />
          <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => { setSelected(new Set([t.id])); setConfirm('hapus') }} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Data Komisi"
        legacyTitle="Pengisian Data Surat Jalan"
        crumbs={[{ label: 'Transaksi' }, { label: 'Data Komisi' }]}
        description="Satu form terintegrasi: pilih SI/JO, sopir, mobil, dan route — Detail Tujuan terisi otomatis dari master Route."
        actions={
          <>
            <Button icon={<CircleHelp size={15} />} onClick={() => setShow4B(true)} title="Fungsi tombol 4B belum tervalidasi">4B</Button>
            <Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah</Button>
          </>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} width="w-80" placeholder="Cari NoTrans, sopir, mobil, SI/JO, route..." />
              <FilterField label="Tanggal">
                <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" aria-label="Tanggal dari" />
              </FilterField>
              <span className="text-[12px] text-ink-3">s/d</span>
              <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" aria-label="Tanggal sampai" />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36" aria-label="Filter status">
                <option value="">Semua Status</option>
                <option value="proses">Proses</option>
                <option value="selesai">Selesai</option>
              </Select>
              {(table.isFiltered || filterActive) && <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={resetFilters}>Reset</Button>}
            </>
          }
          right={<Button size="sm" onClick={() => setDateFrom(startOfMonthISO())}>Bulan ini</Button>}
        />

        {/* "Tandai" pada aplikasi lama = memilih baris; aksinya muncul di sini */}
        {selected.size > 0 && (
          <div className="animate-in-fade flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-brand-800">{selected.size} transaksi ditandai</p>
            <div className="flex items-center gap-2">
              <Button size="sm" icon={<CheckCheck size={14} />} disabled={!canEdit} onClick={() => setConfirm('selesai')}>Selesai</Button>
              <Button size="sm" variant="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setConfirm('hapus')}>Hapus</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Batalkan</Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(t) => t.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterActive}
          sort={table.sort}
          onSortChange={table.toggleSort}
          selectedKeys={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          empty={<EmptyState entity="transaksi komisi" action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah</Button>} />}
          notFound={<NotFoundState onReset={resetFilters} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Ubah Transaksi ${editing.transaction_no}` : 'Tambah Transaksi Komisi'}
        subtitle="Urutan pengisian: SI/JO → Sopir → Mobil → Route. Tanda * wajib diisi."
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NoTrans" required error={errors.transaction_no}>
            {(fid) => <Input id={fid} value={form.transaction_no} invalid={!!errors.transaction_no} onChange={(e) => setForm({ ...form, transaction_no: e.target.value })} />}
          </Field>
          <Field label="Tanggal" required error={errors.transaction_date}>
            {(fid) => <DateInput id={fid} value={form.transaction_date} invalid={!!errors.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />}
          </Field>

          <Field label="Daftar S / JO" required error={errors.job_order_id} className="sm:col-span-2">
            {(fid) => (
              <SearchableSelect id={fid} options={joOptions} value={form.job_order_id || null} invalid={!!errors.job_order_id}
                placeholder="Cari nomor SI / Job Order..." onChange={(v) => setForm({ ...form, job_order_id: v ?? '' })} />
            )}
          </Field>
          <Field label="Daftar Sopir" required error={errors.driver_id}>
            {(fid) => (
              <SearchableSelect id={fid} options={driverOptions} value={form.driver_id || null} invalid={!!errors.driver_id}
                placeholder="Cari kode atau nama sopir..." onChange={(v) => setForm({ ...form, driver_id: v ?? '' })} />
            )}
          </Field>
          <Field label="No Mobil" required error={errors.vehicle_id}>
            {(fid) => (
              <SearchableSelect id={fid} options={vehicleOptions} value={form.vehicle_id || null} invalid={!!errors.vehicle_id}
                placeholder="Cari nomor polisi..." onChange={(v) => setForm({ ...form, vehicle_id: v ?? '' })} />
            )}
          </Field>
          <Field label="Daftar Route" required error={errors.route_id}>
            {(fid) => (
              <SearchableSelect id={fid} options={routeOptions} value={form.route_id || null} invalid={!!errors.route_id}
                placeholder="Cari kode route..." onChange={applyRoute} />
            )}
          </Field>
          <Field label="Detail Tujuan" hint="Terisi otomatis dari master Route, masih bisa diubah.">
            {(fid) => <Input id={fid} value={form.destination_detail} onChange={(e) => setForm({ ...form, destination_detail: e.target.value })} />}
          </Field>
          <Field label="Kont (No. Container)">
            {(fid) => <Input id={fid} value={form.container_no} placeholder="TGHU 4429318" onChange={(e) => setForm({ ...form, container_no: e.target.value })} />}
          </Field>
          <Field label="Status">
            {(fid) => (
              <Select id={fid} value={form.is_done ? 'selesai' : 'proses'} onChange={(e) => setForm({ ...form, is_done: e.target.value === 'selesai' })}>
                <option value="proses">Proses</option>
                <option value="selesai">Selesai</option>
              </Select>
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm === 'hapus'}
        message={`${selected.size} transaksi akan dihapus. Data yang sudah dihapus mungkin tidak dapat dikembalikan.`}
        onCancel={() => setConfirm(null)}
        onConfirm={doHapus}
      />
      <ConfirmDialog
        open={confirm === 'selesai'}
        title="Tandai Selesai?"
        message={`${selected.size} transaksi akan ditandai sebagai Selesai.`}
        confirmLabel="Selesai"
        tone="primary"
        onCancel={() => setConfirm(null)}
        onConfirm={doSelesai}
      />

      <Modal open={show4B} onClose={() => setShow4B(false)} title="Tombol 4B" size="sm"
        footer={<Button variant="primary" onClick={() => setShow4B(false)}>Mengerti</Button>}>
        <p className="text-[13px] leading-relaxed text-ink-2">
          Fungsi bisnis tombol <span className="font-semibold text-ink">4B</span> pada window lama belum tervalidasi,
          sehingga tombolnya dipertahankan sebagai secondary action tanpa logic karangan.
        </p>
        <p className="mt-3 rounded-md border border-hairline bg-sunken px-3 py-2.5 text-[12.5px] text-ink-3">
          Ditandai sebagai <span className="font-semibold text-ink-2">TBD-06</span>. Beri tahu fungsi aslinya, dan
          perilakunya akan diimplementasikan di sini.
        </p>
      </Modal>
    </>
  )
}
