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
import { Field, Input, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { LampiranInput, LampiranThumbs } from '../components/ui/Lampiran'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import { formatNumber } from '../lib/format'
import { VEHICLE_CONFIGS } from '../types'
import type { Vehicle } from '../types'

type FormState = Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>
const BLANK: FormState = { plate_number: '', vehicle_type: '', configuration: '', status: 'aktif', attachments: [] }
const TYPES = ['Tronton 6x2', 'Trailer 20 FT', 'Trailer 40 FT', 'Head Truck', 'Wingbox']

export function DataMobilPage() {
  const { db, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const [configFilter, setConfigFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  /** Jumlah trip per kendaraan, untuk konteks sebelum menghapus. */
  const tripCount = useMemo(() => {
    const m = new Map<string, number>()
    // Sebagian trip tidak mencantumkan nomor polisi; jangan dihitung ke kunci kosong.
    for (const t of transactionRows) {
      if (!t.vehicle_id) continue
      m.set(t.vehicle_id, (m.get(t.vehicle_id) ?? 0) + 1)
    }
    return m
  }, [transactionRows])

  const search = useCallback((v: Vehicle, q: string) => matchesQuery(q, v.plate_number, v.vehicle_type, v.configuration), [])
  const extraFilter = useCallback(
    (v: Vehicle) => (!configFilter || v.configuration === configFilter) && (!statusFilter || v.status === statusFilter),
    [configFilter, statusFilter],
  )
  const filterAktif = Boolean(configFilter || statusFilter)
  const table = useTable(db.vehicles, {
    search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'plate_number', pageSize: 10,
  })
  const resetFilter = () => { table.reset(); setConfigFilter(''); setStatusFilter('') }

  function openCreate() { setEditing(null); setForm(BLANK); setErrors({}); setFormOpen(true) }
  function openEdit(v: Vehicle) {
    setEditing(v)
    setForm({ plate_number: v.plate_number, vehicle_type: v.vehicle_type, configuration: v.configuration, status: v.status, attachments: v.attachments ?? [] })
    setErrors({}); setFormOpen(true)
  }

  /** Data kendaraan asli belum punya jenis; jangan paksa diisi hanya untuk menambah foto. */
  const jenisWajib = !editing || !!editing.vehicle_type

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const plat = form.plate_number.trim()
    if (!plat) e.plate_number = 'No. Kendaraan wajib diisi.'
    else if (db.vehicles.some((v) => v.plate_number.toLowerCase() === plat.toLowerCase() && v.id !== editing?.id))
      e.plate_number = 'No. Kendaraan sudah terdaftar.'
    if (jenisWajib && !form.vehicle_type.trim()) e.vehicle_type = 'Jenis kendaraan wajib diisi.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = { ...form, plate_number: form.plate_number.trim().toUpperCase() }
    if (editing) { update('vehicles', editing.id, payload); toast.success('Data berhasil diperbarui.') }
    else { create('vehicles', payload); toast.success('Data berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('vehicles', deleting.id)
    toast.success('Data berhasil dihapus.')
    setDeleting(null)
  }

  const columns: Column<Vehicle>[] = [
    { key: 'plate_number', header: 'No. Kendaraan', sortable: true, width: '140px', render: (v) => <span className="tnum font-semibold text-ink">{v.plate_number}</span> },
    { key: 'foto', header: 'Foto', width: '120px', render: (v) => <LampiranThumbs ids={v.attachments ?? []} ukuran={30} /> },
    { key: 'vehicle_type', header: 'Jenis Kendaraan', sortable: true, render: (v) => <span className="text-ink-2">{v.vehicle_type}</span> },
    {
      key: 'configuration', header: 'Konfigurasi', sortable: true, width: '130px',
      render: (v) => (v.configuration ? <Badge tone="brand">{v.configuration}</Badge> : <span className="text-ink-3">—</span>),
    },
    {
      key: 'trip', header: 'Jumlah Trip', align: 'right', width: '110px',
      render: (v) => <span className="tnum text-ink-2">{formatNumber(tripCount.get(v.id) ?? 0)}</span>,
    },
    {
      key: 'status', header: 'Status', sortable: true, width: '110px',
      render: (v) =>
        v.status === 'aktif' ? <Badge tone="good">Aktif</Badge>
          : v.status === 'servis' ? <Badge tone="warning">Servis</Badge>
          : <Badge tone="neutral">Nonaktif</Badge>,
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (v) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(v)} />
          <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setDeleting(v)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Data Mobil"
        crumbs={[{ label: 'Master' }, { label: 'Data Mobil' }]}
        description="Master kendaraan beserta konfigurasinya, terpisah dari data sopir."
        actions={<Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Mobil</Button>}
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari nomor kendaraan atau jenis..." />
              <FilterField label="Konfigurasi">
                <Select value={configFilter} onChange={(e) => setConfigFilter(e.target.value)} className="w-32">
                  <option value="">Semua</option>
                  {VEHICLE_CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-32">
                  <option value="">Semua</option>
                  <option value="aktif">Aktif</option>
                  <option value="servis">Servis</option>
                  <option value="nonaktif">Nonaktif</option>
                </Select>
              </FilterField>
              {(table.isFiltered || filterAktif) && <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={resetFilter}>Reset</Button>}
            </>
          }
          right={<span className="text-[12.5px] text-ink-3">{db.vehicles.length} mobil terdaftar</span>}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(v) => v.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterAktif}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="data mobil" action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah Mobil</Button>} />}
          notFound={<NotFoundState onReset={resetFilter} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>


      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Data Mobil' : 'Tambah Data Mobil'}
        subtitle={editing ? editing.plate_number : 'Tanda * wajib diisi.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No. Kendaraan" required error={errors.plate_number}>
            {(id) => (
              <Input id={id} value={form.plate_number} invalid={!!errors.plate_number} placeholder="B 9015 UWW"
                onChange={(e) => setForm({ ...form, plate_number: e.target.value })} />
            )}
          </Field>
          <Field label="Jenis Kendaraan" required={jenisWajib} error={errors.vehicle_type}>
            {(id) => (
              <Select id={id} value={form.vehicle_type} invalid={!!errors.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                <option value="">Pilih jenis...</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Konfigurasi" hint="Kosongkan bila kendaraan standar.">
            {(id) => (
              <Select id={id} value={form.configuration} onChange={(e) => setForm({ ...form, configuration: e.target.value })}>
                <option value="">— tanpa konfigurasi —</option>
                {VEHICLE_CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vehicle['status'] })}>
                <option value="aktif">Aktif</option>
                <option value="servis">Servis</option>
                <option value="nonaktif">Nonaktif</option>
              </Select>
            )}
          </Field>
          <Field label="Foto & dokumen" className="sm:col-span-2" hint="Foto kendaraan, STNK, KIR, atau informasi lain tentang kendaraan ini.">
            {(id) => <LampiranInput id={id} value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.plate_number}</span>
            {deleting && (tripCount.get(deleting.id) ?? 0) > 0 && (
              <span className="mt-2 block text-[12.5px] text-[color:var(--color-critical)]">
                Kendaraan ini dipakai pada {formatNumber(tripCount.get(deleting.id) ?? 0)} trip. Trip tersebut akan
                kehilangan referensi kendaraan.
              </span>
            )}
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
