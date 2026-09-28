import { useCallback, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { FilterField, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, DateInput, Select, Textarea } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { LampiranInput, LampiranThumbs } from '../components/ui/Lampiran'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import { formatDate, formatRupiah, todayISO } from '../lib/format'
import { hitungKomisiKontrak } from '../lib/komisi'
import { nomorKontrakBerikut } from '../lib/kode'
import type { Contract } from '../types'

type FormState = Omit<Contract, 'id' | 'created_at' | 'updated_at' | 'workspace'>

const BLANK: FormState = {
  contract_no: '', client_name: '', value: 0, start_date: '', end_date: '', status: 'aktif', notes: '', attachments: [],
}

type Baris = Contract & { trip: number; terpakai: number; sisa: number; komisi: number }

/**
 * Master -> Data Kontrak: kontrak layanan Dedicated.
 * Trip Dedicated wajib memilih kontrak, sehingga sisa nilai kontraknya
 * (finance balance) bisa dihitung dari seluruh biaya trip kontrak itu.
 */
export function DataKontrakPage() {
  const { db, dbAll, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState<Contract | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Baris | null>(null)
  const [status, setStatus] = useState('')

  const baris = useMemo<Baris[]>(() => db.contracts.map((c) => {
    // Trip batal tidak dihitung: catatannya arsip.
    const trip = transactionRows.filter((t) => t.contract_id === c.id && t.status !== 'batal')
    const terpakai = trip.reduce((a, t) => a + t.uj_total + t.expense_total + t.internal_total, 0)
    return {
      ...c,
      trip: trip.length,
      terpakai,
      sisa: c.value - terpakai,
      komisi: hitungKomisiKontrak(db.commissionSchemes, c.value)?.nilai ?? 0,
    }
  }), [db.contracts, db.commissionSchemes, transactionRows])

  const search = useCallback((c: Baris, q: string) => matchesQuery(q, c.contract_no, c.client_name, c.notes), [])
  const extraFilter = useCallback((c: Baris) => !status || c.status === status, [status])
  const table = useTable(baris, { search, extraFilter, extraFilterActive: !!status, initialSortKey: 'contract_no', pageSize: 10 })
  const resetFilter = () => { table.reset(); setStatus('') }

  function openCreate() {
    setEditing(null)
    setForm({
      ...BLANK,
      contract_no: nomorKontrakBerikut(dbAll.contracts.map((c) => c.contract_no), todayISO().slice(0, 4)),
      start_date: todayISO(),
    })
    setErrors({}); setFormOpen(true)
  }

  function openEdit(c: Contract) {
    setEditing(c)
    setForm({
      contract_no: c.contract_no, client_name: c.client_name, value: c.value, start_date: c.start_date,
      end_date: c.end_date, status: c.status, notes: c.notes, attachments: c.attachments ?? [],
    })
    setErrors({}); setFormOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const no = form.contract_no.trim()
    if (!no) e.contract_no = 'Nomor kontrak wajib diisi.'
    else if (dbAll.contracts.some((c) => c.contract_no.toLowerCase() === no.toLowerCase() && c.id !== editing?.id))
      e.contract_no = 'Nomor kontrak sudah dipakai.'
    if (!form.client_name.trim()) e.client_name = 'Nama client wajib diisi.'
    if (form.value <= 0) e.value = 'Nilai kontrak harus lebih dari 0.'
    if (form.start_date && form.end_date && form.end_date < form.start_date) e.end_date = 'Tanggal selesai sebelum tanggal mulai.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = { ...form, contract_no: form.contract_no.trim().toUpperCase(), client_name: form.client_name.trim(), notes: form.notes.trim() }
    if (editing) { update('contracts', editing.id, payload); toast.success('Kontrak berhasil diperbarui.') }
    else { create('contracts', payload); toast.success('Kontrak berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('contracts', deleting.id)
    toast.success('Kontrak berhasil dihapus.')
    setDeleting(null)
  }

  /** Trip mana pun (termasuk batal) yang masih menunjuk kontrak ini. */
  const dipakai = (id: string) => db.transactions.filter((t) => t.contract_id === id).length

  const columns: Column<Baris>[] = [
    {
      key: 'contract_no', header: 'No. Kontrak', sortable: true, width: '200px',
      render: (c) => (
        <div className="leading-tight">
          <span className="tnum font-semibold text-ink">{c.contract_no}</span>
          <span className="mt-0.5 block text-[12px] text-ink-3">{c.client_name}</span>
        </div>
      ),
    },
    {
      key: 'start_date', header: 'Periode', sortable: true, width: '190px',
      render: (c) => <span className="tnum text-ink-2">{c.start_date ? formatDate(c.start_date) : '—'} – {c.end_date ? formatDate(c.end_date) : '—'}</span>,
    },
    { key: 'value', header: 'Nilai Kontrak', sortable: true, align: 'right', width: '140px', render: (c) => <span className="tnum font-medium">{formatRupiah(c.value)}</span> },
    {
      key: 'terpakai', header: 'Terpakai', sortable: true, align: 'right', width: '140px',
      render: (c) => (
        <div className="leading-tight">
          <span className="tnum text-ink-2">{formatRupiah(c.terpakai)}</span>
          <span className="mt-0.5 block text-[11.5px] text-ink-3">{c.trip} trip</span>
        </div>
      ),
    },
    {
      key: 'sisa', header: 'Sisa (balance)', sortable: true, align: 'right', width: '140px',
      render: (c) => <span className={c.sisa < 0 ? 'tnum font-semibold text-[color:var(--color-critical)]' : 'tnum font-semibold text-ink'}>{formatRupiah(c.sisa)}</span>,
    },
    {
      key: 'komisi', header: 'Komisi (perkiraan)', sortable: true, align: 'right', width: '150px',
      render: (c) => (c.komisi ? <span className="tnum text-ink-2">{formatRupiah(c.komisi)}</span> : <span className="text-ink-3">—</span>),
    },
    { key: 'attachments', header: 'Dokumen', width: '96px', render: (c) => <LampiranThumbs ids={c.attachments ?? []} ukuran={28} /> },
    {
      key: 'status', header: 'Status', sortable: true, width: '100px',
      render: (c) => (c.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Selesai</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(c)} />
          <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setDeleting(c)} />
        </div>
      ),
    },
  ]

  const jumlahDipakai = deleting ? dipakai(deleting.id) : 0

  return (
    <>
      <PageHeader
        title="Data Kontrak"
        description="Kontrak layanan Dedicated. Sisa kontrak = nilai kontrak dikurangi uang jalan dan biaya seluruh trip kontrak itu."
        crumbs={[{ label: 'Master' }, { label: 'Data Kontrak' }]}
        actions={<Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Kontrak</Button>}
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari nomor kontrak atau klien..." />
              <FilterField label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
                  <option value="">Semua</option>
                  <option value="aktif">Aktif</option>
                  <option value="selesai">Selesai</option>
                </Select>
              </FilterField>
              {(table.isFiltered || status) && <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={resetFilter}>Reset</Button>}
            </>
          }
          right={<span className="text-[12.5px] text-ink-3">{db.contracts.length} kontrak</span>}
        />
        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(c) => c.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || !!status}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="kontrak" action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah Kontrak</Button>} />}
          notFound={<NotFoundState onReset={resetFilter} />}
        />
        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Kontrak' : 'Tambah Kontrak'}
        subtitle="Dipakai trip berlayanan Dedicated."
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No. Kontrak" required error={errors.contract_no} hint={errors.contract_no ? undefined : 'Nomor urut otomatis per tahun, boleh diganti.'}>
            {(id) => <Input id={id} value={form.contract_no} invalid={!!errors.contract_no} className="tnum" onChange={(e) => setForm({ ...form, contract_no: e.target.value })} />}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Contract['status'] })}>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
              </Select>
            )}
          </Field>
          <Field label="Nama Klien" required error={errors.client_name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.client_name} invalid={!!errors.client_name} placeholder="PT ..." onChange={(e) => setForm({ ...form, client_name: e.target.value })} />}
          </Field>
          <Field label="Nilai Kontrak" required error={errors.value} className="sm:col-span-2">
            {(id) => <CurrencyInput id={id} value={form.value} invalid={!!errors.value} onValueChange={(v) => setForm({ ...form, value: v })} />}
          </Field>
          <Field label="Mulai">
            {(id) => <DateInput id={id} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />}
          </Field>
          <Field label="Selesai" error={errors.end_date}>
            {(id) => <DateInput id={id} value={form.end_date} invalid={!!errors.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />}
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>
          <Field label="Dokumen kontrak" className="sm:col-span-2">
            {(id) => <LampiranInput id={id} label="Tambah dokumen" value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={jumlahDipakai ? 'Kontrak masih dipakai' : 'Hapus kontrak?'}
        confirmLabel={jumlahDipakai ? 'Mengerti' : 'Hapus'}
        tone={jumlahDipakai ? 'primary' : 'danger'}
        message={jumlahDipakai
          ? `${deleting?.contract_no} masih dipakai ${jumlahDipakai} trip. Ubah statusnya menjadi Selesai bila kontrak sudah berakhir.`
          : `${deleting?.contract_no} — ${deleting?.client_name} akan dihapus.`}
        onCancel={() => setDeleting(null)}
        onConfirm={jumlahDipakai ? () => setDeleting(null) : onDelete}
      />
    </>
  )
}
