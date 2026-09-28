import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaHandHoldingDollar, FaPen, FaPlus, FaTrashCan, FaXmark } from '../components/ui/icons'
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
import { formatRupiah } from '../lib/format'
import { kodeKaryawanBerikut } from '../lib/kode'
import { EMPLOYEE_ROLES, ROLE_LABEL } from '../types'
import type { Driver, EmployeeRole } from '../types'

type FormState = Omit<Driver, 'id' | 'created_at' | 'updated_at'>

const BLANK: FormState = {
  driver_code: '', driver_name: '', role: 'sopir', address_1: '', address_2: '', city: '', phone: '', status: 'aktif',
  attachments: [],
}

type Baris = Driver & { saldo: number }

/**
 * Master -> Data Karyawan (dulu Data Sopir).
 * Setiap karyawan punya kasbon sendiri; ikon kasbon membuka halaman transaksinya.
 */
export function DataKaryawanPage() {
  const { db, saldoKasbon, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [editing, setEditing] = useState<Driver | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Driver | null>(null)
  const [peran, setPeran] = useState('')
  const [status, setStatus] = useState('')
  const [piutang, setPiutang] = useState('')

  const baris = useMemo<Baris[]>(
    () => db.drivers.map((d) => ({ ...d, role: d.role ?? 'sopir', saldo: saldoKasbon.get(d.id) ?? 0 })),
    [db.drivers, saldoKasbon],
  )

  const search = useCallback(
    (d: Baris, q: string) => matchesQuery(q, d.driver_code, d.driver_name, d.address_1, d.address_2, d.city, d.phone),
    [],
  )
  const extraFilter = useCallback(
    (d: Baris) => (!peran || d.role === peran) && (!status || d.status === status) &&
      (!piutang || (piutang === 'ada' ? d.saldo > 0 : d.saldo <= 0)),
    [peran, status, piutang],
  )
  const filterAktif = Boolean(peran || status || piutang)
  const table = useTable(baris, { search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'driver_code', pageSize: 10 })

  /** Kode berikutnya untuk peran tertentu, mis. SPR040 atau MGR002. */
  const kodeBerikut = useCallback((role: EmployeeRole) => kodeKaryawanBerikut(db.drivers, role), [db.drivers])

  function openCreate() {
    setEditing(null)
    setForm({ ...BLANK, driver_code: kodeBerikut('sopir') })
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(d: Driver) {
    setEditing(d)
    setForm({
      driver_code: d.driver_code, driver_name: d.driver_name, role: d.role ?? 'sopir', address_1: d.address_1,
      address_2: d.address_2, city: d.city, phone: d.phone, status: d.status, attachments: d.attachments ?? [],
    })
    setErrors({})
    setFormOpen(true)
  }

  /** Ganti peran saat menambah: kode ikut menyesuaikan bila belum diubah manual. */
  function gantiPeran(role: EmployeeRole) {
    setForm((f) => {
      const kodeOtomatis = !editing && (f.driver_code === '' || f.driver_code === kodeBerikut(f.role))
      return { ...f, role, driver_code: kodeOtomatis ? kodeBerikut(role) : f.driver_code }
    })
  }

  const kotaWajib = !editing || !!editing.city

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.driver_code.trim()) e.driver_code = 'Kode karyawan wajib diisi.'
    else if (db.drivers.some((d) => d.driver_code.toLowerCase() === form.driver_code.trim().toLowerCase() && d.id !== editing?.id))
      e.driver_code = 'Kode karyawan sudah dipakai.'
    if (!form.driver_name.trim()) e.driver_name = 'Nama wajib diisi.'
    // Karyawan dari data asli belum punya kota; jangan paksa diisi hanya untuk menambah dokumen.
    if (kotaWajib && !form.city.trim()) e.city = 'Kota wajib diisi.'
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

  function resetFilter() {
    table.reset(); setPeran(''); setStatus(''); setPiutang('')
  }

  const columns: Column<Baris>[] = [
    { key: 'driver_code', header: 'Kode', sortable: true, width: '96px', render: (d) => <span className="tnum font-semibold text-ink">{d.driver_code}</span> },
    { key: 'driver_name', header: 'Nama', sortable: true, render: (d) => <span className="font-medium">{d.driver_name}</span> },
    {
      key: 'role', header: 'Peran', sortable: true, width: '104px',
      render: (d) => <Badge tone={d.role === 'manager' ? 'brand' : 'neutral'}>{ROLE_LABEL[d.role]}</Badge>,
    },
    {
      key: 'address_1', header: 'Alamat', sortable: true,
      render: (d) => {
        const alamat = [d.address_1, d.address_2].filter(Boolean).join(', ')
        return <span className="text-ink-2">{alamat || '—'}</span>
      },
    },
    { key: 'city', header: 'Kota', sortable: true, width: '120px', render: (d) => <span className="text-ink-2">{d.city || '—'}</span> },
    { key: 'attachments', header: 'Dokumen', width: '120px', render: (d) => <LampiranThumbs ids={d.attachments ?? []} ukuran={28} /> },
    {
      // Piutang karyawan = sisa kasbon yang belum terpotong.
      key: 'saldo', header: 'Piutang', sortable: true, align: 'right', width: '150px',
      render: (d) => (
        <div className="flex flex-col items-end gap-1">
          <span className={d.saldo > 0 ? 'tnum font-semibold text-ink' : 'tnum text-ink-3'}>{formatRupiah(d.saldo)}</span>
          {d.saldo > 0 ? <Badge tone="warning">Belum lunas</Badge> : <Badge tone="good">Lunas</Badge>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true, width: '100px',
      render: (d) => (d.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '124px',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <IconButton label={`Kasbon & transaksi ${d.driver_name}`} icon={<FaHandHoldingDollar size={15} />} onClick={() => navigate(`/master/karyawan/${d.id}`)} />
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(d)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(d)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Data Karyawan"
        crumbs={[{ label: 'Master' }, { label: 'Data Karyawan' }]}
        actions={
          <Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={openCreate}
            title={canEdit ? undefined : 'Peran Viewer tidak dapat mengubah master data'}>
            Tambah Karyawan
          </Button>
        }
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari kode, nama, alamat, atau kota..." />
              <FilterField label="Peran">
                <Select value={peran} onChange={(e) => setPeran(e.target.value)} className="h-9 w-32">
                  <option value="">Semua</option>
                  {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-32">
                  <option value="">Semua</option>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </Select>
              </FilterField>
              <FilterField label="Piutang">
                <Select value={piutang} onChange={(e) => setPiutang(e.target.value)} className="h-9 w-36">
                  <option value="">Semua</option>
                  <option value="ada">Belum lunas</option>
                  <option value="lunas">Lunas</option>
                </Select>
              </FilterField>
              {(table.isFiltered || filterAktif) && <Button size="sm" variant="ghost" icon={<FaXmark size={14} />} onClick={resetFilter}>Reset</Button>}
            </>
          }
          right={<span className="text-[12.5px] text-ink-3">{db.drivers.length} karyawan terdaftar</span>}
        />

        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(d) => d.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || filterAktif}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="karyawan" action={canEdit && <Button variant="primary" icon={<FaPlus size={15} />} onClick={openCreate}>Tambah Karyawan</Button>} />}
          notFound={<NotFoundState onReset={resetFilter} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Data Karyawan' : 'Tambah Karyawan'}
        subtitle={editing ? `Kode ${editing.driver_code}` : 'Lengkapi data karyawan baru. Tanda * wajib diisi.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Peran" required hint="Sopir membawa kendaraan; manager mengelola trip.">
            {(id) => (
              <Select id={id} value={form.role} onChange={(e) => gantiPeran(e.target.value as EmployeeRole)}>
                {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Kode" required error={errors.driver_code}>
            {(id) => (
              <Input id={id} value={form.driver_code} invalid={!!errors.driver_code} placeholder="SPR027"
                onChange={(e) => setForm({ ...form, driver_code: e.target.value })} />
            )}
          </Field>
          <Field label="Nama" required error={errors.driver_name} className="sm:col-span-2">
            {(id) => (
              <Input id={id} value={form.driver_name} invalid={!!errors.driver_name} placeholder="Budi Santoso"
                onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
            )}
          </Field>
          <Field label="Alamat" className="sm:col-span-2">
            {(id) => (
              <Input id={id} value={form.address_1} placeholder="Jl. Melati No. 12, Jakarta Timur"
                onChange={(e) => setForm({ ...form, address_1: e.target.value })} />
            )}
          </Field>
          <Field label="Kota" required={kotaWajib} error={errors.city}>
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
          <Field label="Dokumen" className="sm:col-span-2" hint="KTP, SIM, dan surat lain karyawan. Foto diperkecil otomatis.">
            {(id) => <LampiranInput id={id} label="Tambah dokumen" value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.driver_code} — {deleting?.driver_name}</span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
