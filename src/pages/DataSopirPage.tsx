import { useCallback, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import type { Driver } from '../types'

type FormState = Omit<Driver, 'id' | 'created_at' | 'updated_at'>

const BLANK: FormState = {
  driver_code: '', driver_name: '', address_1: '', address_2: '', city: '', phone: '', status: 'aktif',
}

export function DataSopirPage() {
  const { db, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState<Driver | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Driver | null>(null)

  const search = useCallback(
    (d: Driver, q: string) => matchesQuery(q, d.driver_code, d.driver_name, d.address_1, d.address_2, d.city, d.phone),
    [],
  )
  const table = useTable(db.drivers, { search, initialSortKey: 'driver_code', pageSize: 10 })

  /** Kode sopir berikutnya, mis. SPR027. */
  const nextCode = useMemo(() => {
    const max = db.drivers.reduce((acc, d) => {
      const n = Number(d.driver_code.replace(/\D/g, ''))
      return Number.isFinite(n) ? Math.max(acc, n) : acc
    }, 0)
    return `SPR${String(max + 1).padStart(3, '0')}`
  }, [db.drivers])

  function openCreate() {
    setEditing(null)
    setForm({ ...BLANK, driver_code: nextCode })
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(d: Driver) {
    setEditing(d)
    setForm({
      driver_code: d.driver_code, driver_name: d.driver_name, address_1: d.address_1,
      address_2: d.address_2, city: d.city, phone: d.phone, status: d.status,
    })
    setErrors({})
    setFormOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.driver_code.trim()) e.driver_code = 'Kode sopir wajib diisi.'
    else if (db.drivers.some((d) => d.driver_code.toLowerCase() === form.driver_code.trim().toLowerCase() && d.id !== editing?.id))
      e.driver_code = 'Kode sopir sudah dipakai.'
    if (!form.driver_name.trim()) e.driver_name = 'Nama sopir wajib diisi.'
    if (!form.city.trim()) e.city = 'Kota wajib diisi.'
    if (form.phone && !/^[\d+\-\s()]{6,20}$/.test(form.phone.trim())) e.phone = 'Format nomor telepon tidak valid.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = { ...form, driver_code: form.driver_code.trim().toUpperCase(), driver_name: form.driver_name.trim() }
    if (editing) {
      update('drivers', editing.id, payload)
      toast.success('Data berhasil diperbarui.')
    } else {
      create('drivers', payload)
      toast.success('Data berhasil disimpan.')
    }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('drivers', deleting.id)
    toast.success('Data berhasil dihapus.')
    setDeleting(null)
  }

  const columns: Column<Driver>[] = [
    {
      key: 'driver_code',
      header: 'Kode',
      sortable: true,
      width: '96px',
      render: (d) => <span className="tnum font-semibold text-ink">{d.driver_code}</span>,
    },
    { key: 'driver_name', header: 'Nama Sopir', sortable: true, render: (d) => <span className="font-medium">{d.driver_name}</span> },
    { key: 'address_1', header: 'Alamat', sortable: true, render: (d) => <span className="text-ink-2">{d.address_1 || '—'}</span> },
    { key: 'address_2', header: 'Alamat 2', sortable: true, render: (d) => <span className="text-ink-2">{d.address_2 || '—'}</span> },
    { key: 'city', header: 'Kota', sortable: true, width: '130px', render: (d) => <span className="text-ink-2">{d.city}</span> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '110px',
      render: (d) => (d.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      width: '92px',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(d)} />
          <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setDeleting(d)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Data Sopir"
        crumbs={[{ label: 'Master' }, { label: 'Data Sopir' }]}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}
            title={canEdit ? undefined : 'Peran Viewer tidak dapat mengubah master data'}>
            Tambah Sopir
          </Button>
        }
      />

      <Card>
        <Toolbar
          left={<SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari kode, nama, alamat, atau kota..." />}
          right={<span className="text-[12.5px] text-ink-3">{db.drivers.length} sopir terdaftar</span>}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(d) => d.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="data sopir" action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah Sopir</Button>} />}
          notFound={<NotFoundState onReset={table.reset} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
        <Users size={13} className="mt-0.5 shrink-0" />
        Alamat dipisah menjadi <span className="font-medium text-ink-2">Alamat</span> (nama jalan &amp; nomor) dan{' '}
        <span className="font-medium text-ink-2">Alamat 2</span> (kecamatan / area), sehingga data tetap utuh tetapi bisa
        dicari dan difilter secara terpisah.
      </p>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Data Sopir' : 'Tambah Data Sopir'}
        subtitle={editing ? `Kode ${editing.driver_code}` : 'Lengkapi data sopir baru. Tanda * wajib diisi.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kode" required error={errors.driver_code}>
            {(id) => (
              <Input id={id} value={form.driver_code} invalid={!!errors.driver_code} placeholder="SPR027"
                onChange={(e) => setForm({ ...form, driver_code: e.target.value })} />
            )}
          </Field>
          <Field label="Nama Sopir" required error={errors.driver_name}>
            {(id) => (
              <Input id={id} value={form.driver_name} invalid={!!errors.driver_name} placeholder="Budi Santoso"
                onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
            )}
          </Field>
          <Field label="Alamat" className="sm:col-span-2" hint="Nama jalan dan nomor rumah.">
            {(id) => (
              <Input id={id} value={form.address_1} placeholder="Jl. Melati No. 12"
                onChange={(e) => setForm({ ...form, address_1: e.target.value })} />
            )}
          </Field>
          <Field label="Alamat 2" hint="Kecamatan / area.">
            {(id) => (
              <Input id={id} value={form.address_2} placeholder="Jakarta Timur"
                onChange={(e) => setForm({ ...form, address_2: e.target.value })} />
            )}
          </Field>
          <Field label="Kota" required error={errors.city}>
            {(id) => (
              <Input id={id} value={form.city} invalid={!!errors.city} placeholder="Jakarta"
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            )}
          </Field>
          <Field label="Telepon" error={errors.phone}>
            {(id) => (
              <Input id={id} value={form.phone} invalid={!!errors.phone} placeholder="0812xxxxxxx"
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Driver['status'] })}>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </Select>
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">
              {deleting?.driver_code} — {deleting?.driver_name}
            </span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
