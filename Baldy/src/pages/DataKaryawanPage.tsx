import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaPen, FaPlus, FaTrashCan } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, DetailButton, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { DokumenPentingInput, ringkasDokumen } from '../components/ui/DokumenPenting'
import { NilaiPiutang } from '../components/ui/NilaiPiutang'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { useFilter } from '../lib/useFilter'
import { matchesQuery } from '../lib/utils'
import { kodeKaryawanBerikut } from '../lib/kode'
import { sisiKaryawan } from '../lib/kasbon'
import { KodeInput } from '../components/ui/KodeInput'
import { DOKUMEN_KARYAWAN, EMPLOYEE_ROLES, ROLE_LABEL } from '../types'
import type { DokumenPenting, Driver, EmployeeRole } from '../types'

type FormState = Omit<Driver, 'id' | 'created_at' | 'updated_at' | 'dokumen'> & { dokumen: Record<string, DokumenPenting> }

const BLANK: FormState = {
  driver_code: '', driver_name: '', role: 'sopir', address_1: '', address_2: '', city: '', phone: '', status: 'aktif',
  dokumen: {}, attachments: [],
}

type Baris = Driver & {
  /** Saldo piutang dari sisi karyawan: minus = masih punya piutang. */
  saldo: number
  /** Jumlah dokumen penting yang sudah diunggah (urut kolom Dokumen). */
  jumlahDok: number
}

/** Dokumen penting tersimpan tanpa slot kosong (tidak ada berkas & tanggal). */
function rapikanDokumen(d: Record<string, DokumenPenting>): Record<string, DokumenPenting> | undefined {
  const isi = Object.entries(d).filter(([, v]) => v.berkas.length > 0 || v.berlaku_sampai)
    .map(([k, v]) => [k, { berkas: v.berkas, ...(v.berlaku_sampai ? { berlaku_sampai: v.berlaku_sampai } : {}) }] as const)
  return isi.length ? Object.fromEntries(isi) : undefined
}

/**
 * Master -> Supir / Karyawan. Revisi 13 Okt 2026: tanpa status lunas / belum lunas, piutang
 * tampil merah bertanda minus; dokumen penting (KTP, SIM, KK, NPWP) punya tempat upload sendiri
 * di form, terpisah dari dokumen lainnya. Transaksi piutang dicatat di menu Piutang Karyawan.
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
  const filter = useFilter({ peran: '', status: '', piutang: '', dokumen: '' })
  const { peran, status, piutang, dokumen } = filter.nilai
  const d = filter.draf

  const baris = useMemo<Baris[]>(
    () => db.drivers.map((d) => ({
      ...d, role: d.role ?? 'sopir', saldo: sisiKaryawan(saldoKasbon.get(d.id) ?? 0),
      jumlahDok: ringkasDokumen(DOKUMEN_KARYAWAN, d.dokumen).ada.length,
    })),
    [db.drivers, saldoKasbon],
  )

  const search = useCallback(
    (d: Baris, q: string) => matchesQuery(q, d.driver_code, d.driver_name, d.address_1, d.address_2, d.city, d.phone),
    [],
  )
  const extraFilter = useCallback(
    (d: Baris) => {
      const r = ringkasDokumen(DOKUMEN_KARYAWAN, d.dokumen)
      return (!peran || d.role === peran) && (!status || d.status === status)
        && (!piutang || (piutang === 'ada' ? d.saldo < 0 : d.saldo >= 0))
        && (!dokumen || (dokumen === 'kurang' ? r.ada.length < r.total : r.habis.length + r.segera.length > 0))
    },
    [peran, status, piutang, dokumen],
  )
  const jumlahFilter = [peran, status, piutang, dokumen].filter(Boolean).length
  const filterAktif = jumlahFilter > 0
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
      address_2: d.address_2, city: d.city, phone: d.phone, status: d.status, dokumen: { ...(d.dokumen ?? {}) }, attachments: d.attachments ?? [],
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
    const { dokumen: dok, ...lain } = form
    const payload = { ...lain, dokumen: rapikanDokumen(dok), driver_code: form.driver_code.trim().toUpperCase(), driver_name: form.driver_name.trim() }
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

  const chips = [
    peran && { label: `Peran: ${ROLE_LABEL[peran as EmployeeRole] ?? peran}`, lepas: () => filter.lepas('peran') },
    status && { label: `Status: ${status === 'aktif' ? 'Aktif' : 'Nonaktif'}`, lepas: () => filter.lepas('status') },
    piutang && { label: piutang === 'ada' ? 'Masih punya piutang' : 'Tidak punya piutang', lepas: () => filter.lepas('piutang') },
    dokumen && { label: dokumen === 'kurang' ? 'Dokumen belum lengkap' : 'Dokumen habis / segera habis', lepas: () => filter.lepas('dokumen') },
  ]
  function resetFilter() {
    table.reset(); filter.lepasSemua()
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
        return (
          <span className="block leading-tight">
            <span className="text-ink-2">{alamat || '—'}</span>
            {d.city && <span className="mt-0.5 block text-[12px] text-ink-3">{d.city}</span>}
          </span>
        )
      },
    },
    {
      key: 'jumlahDok', header: 'Dokumen', sortable: true, width: '150px',
      render: (d) => {
        const r = ringkasDokumen(DOKUMEN_KARYAWAN, d.dokumen)
        const lain = (d.attachments ?? []).length
        return (
          <span className="block leading-tight">
            <span className={r.ada.length ? 'text-ink-2' : 'text-ink-3'}>{r.ada.length ? r.ada.join(', ') : 'Belum ada'}</span>
            {(r.habis.length > 0 || r.segera.length > 0) && (
              <span className="mt-0.5 block text-[11.5px] font-medium text-[color:var(--color-critical)]">
                {[...r.habis, ...r.segera].join(', ')} {r.habis.length ? 'habis' : 'segera habis'}
              </span>
            )}
            {lain > 0 && <span className="mt-0.5 block text-[11.5px] text-ink-3">+{lain} dokumen lainnya</span>}
          </span>
        )
      },
    },
    {
      // Piutang dari sisi karyawan (atasan 13 Okt 2026): minus merah = masih punya piutang.
      key: 'saldo', header: 'Piutang', sortable: true, align: 'right', width: '140px',
      render: (d) => <NilaiPiutang nilai={d.saldo} tebal={d.saldo < 0} />,
    },
    {
      key: 'status', header: 'Status', sortable: true, width: '100px',
      render: (d) => (d.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '124px',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <DetailButton label={`Lihat detail ${d.driver_name} (piutang & trip)`} onClick={() => navigate(`/master/karyawan/${d.id}`)} />
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(d)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(d)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Supir / Karyawan"
        crumbs={[{ label: 'Master Data' }, { label: 'Supir / Karyawan' }]}
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
              <PanelFilter filter={filter} chips={chips}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Peran">
                    {(id) => (
                      <Select id={id} value={d.peran} onChange={(e) => filter.ubah({ peran: e.target.value })}>
                        <option value="">Semua</option>
                        {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="Status">
                    {(id) => (
                      <Select id={id} value={d.status} onChange={(e) => filter.ubah({ status: e.target.value })}>
                        <option value="">Semua</option>
                        <option value="aktif">Aktif</option>
                        <option value="nonaktif">Nonaktif</option>
                      </Select>
                    )}
                  </Field>
                </div>
                <Field label="Piutang">
                  {(id) => (
                    <Select id={id} value={d.piutang} onChange={(e) => filter.ubah({ piutang: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="ada">Masih punya piutang</option>
                      <option value="tidak">Tidak punya piutang</option>
                    </Select>
                  )}
                </Field>
                <Field label="Dokumen penting">
                  {(id) => (
                    <Select id={id} value={d.dokumen} onChange={(e) => filter.ubah({ dokumen: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="kurang">Belum lengkap</option>
                      <option value="habis">Habis / segera habis</option>
                    </Select>
                  )}
                </Field>
              </PanelFilter>
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
          empty={<EmptyState entity="karyawan" />}
          notFound={<NotFoundState onReset={resetFilter} />}
        />

        {table.total > 0 && (
          <Pagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="lg"
        title={editing ? 'Ubah Karyawan' : 'Tambah Karyawan'}
        subtitle={editing ? `Kode ${editing.driver_code}` : 'Lengkapi data karyawan baru. Tanda * wajib diisi.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        {/* Ringkas tanpa scroll (Baldy 14 Okt 2026): tiga kolom, dokumen sebaris di bawah. */}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="Peran" required>
            {(id) => (
              <Select id={id} value={form.role} onChange={(e) => gantiPeran(e.target.value as EmployeeRole)}>
                {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Kode" required error={errors.driver_code}>
            {(id) => (
              <KodeInput id={id} value={form.driver_code} invalid={!!errors.driver_code} placeholder="SPR027" uppercase
                generateTitle="Buat kode berikutnya: SPR untuk supir, MGR untuk manager"
                onChange={(v) => setForm({ ...form, driver_code: v })}
                onGenerate={() => setForm((f) => ({ ...f, driver_code: kodeKaryawanBerikut(db.drivers.filter((d) => d.id !== editing?.id), f.role) }))} />
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
          <Field label="Nama" required error={errors.driver_name} className="sm:col-span-2">
            {(id) => (
              <Input id={id} value={form.driver_name} invalid={!!errors.driver_name} placeholder="Budi Santoso"
                onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
            )}
          </Field>
          <Field label="Telepon" error={errors.phone}>
            {(id) => (
              <Input id={id} value={form.phone} invalid={!!errors.phone} placeholder="0812xxxxxxx"
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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

          <fieldset className="min-w-0 sm:col-span-3">
            <legend className="form-label">Dokumen <span className="font-normal text-ink-3">· klik kotak untuk upload; foto diperkecil otomatis, PDF juga bisa</span></legend>
            <DokumenPentingInput jenis={DOKUMEN_KARYAWAN} value={form.dokumen} onChange={(v) => setForm((f) => ({ ...f, dokumen: v }))}
              lainnya={{ label: 'Dokumen lainnya', value: form.attachments, onChange: (v) => setForm((f) => ({ ...f, attachments: v })) }} />
          </fieldset>
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
