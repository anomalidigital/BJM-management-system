import { useCallback, useMemo, useState } from 'react'
import { FaPen, FaPlus, FaTrashCan } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { LampiranThumbs } from '../components/ui/Lampiran'
import { DokumenPentingInput, ringkasDokumen } from '../components/ui/DokumenPenting'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { useFilter } from '../lib/useFilter'
import { matchesQuery } from '../lib/utils'
import { formatNumber } from '../lib/format'
import { DOKUMEN_KENDARAAN, GANDENGAN_LABEL, VEHICLE_CONFIGS } from '../types'
import type { DokumenPenting, Vehicle } from '../types'

type FormState = Omit<Vehicle, 'id' | 'created_at' | 'updated_at' | 'dokumen'> & { dokumen: Record<string, DokumenPenting> }
const BLANK: FormState = { plate_number: '', vehicle_type: '', configuration: '', status: 'aktif', dokumen: {}, attachments: [] }
const TYPES = ['Tronton 6x2', 'Trailer 20 FT', 'Trailer 40 FT', 'Head Truck', 'Wingbox']

/** Dokumen penting tersimpan tanpa slot kosong (tidak ada berkas & tanggal). */
function rapikanDokumen(d: Record<string, DokumenPenting>): Record<string, DokumenPenting> | undefined {
  const isi = Object.entries(d).filter(([, v]) => v.berkas.length > 0 || v.berlaku_sampai)
    .map(([k, v]) => [k, { berkas: v.berkas, ...(v.berlaku_sampai ? { berlaku_sampai: v.berlaku_sampai } : {}) }] as const)
  return isi.length ? Object.fromEntries(isi) : undefined
}

/**
 * Master Data -> Kendaraan. Revisi 13 Okt 2026: surat penting (STNK, KIR, Pajak, Asuransi) punya
 * tempat upload sendiri beserta masa berlakunya, terpisah dari foto & dokumen lainnya.
 */
export function DataMobilPage() {
  const { db, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const filter = useFilter({ config: '', status: '', dok: '' })
  const { config: configFilter, status: statusFilter, dok: dokFilter } = filter.nilai
  const d = filter.draf

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
    (v: Vehicle) => {
      const r = ringkasDokumen(DOKUMEN_KENDARAAN, v.dokumen)
      return (!configFilter || v.configuration === configFilter) && (!statusFilter || v.status === statusFilter)
        && (!dokFilter || (dokFilter === 'kurang' ? r.ada.length < r.total : r.habis.length + r.segera.length > 0))
    },
    [configFilter, statusFilter, dokFilter],
  )
  const jumlahFilter = [configFilter, statusFilter, dokFilter].filter(Boolean).length
  const filterAktif = jumlahFilter > 0
  const table = useTable(db.vehicles, {
    search, extraFilter, extraFilterActive: filterAktif, initialSortKey: 'plate_number', pageSize: 10,
  })
  const resetFilter = () => { table.reset(); filter.lepasSemua() }
  const LABEL_STATUS: Record<string, string> = { aktif: 'Aktif', servis: 'Servis', nonaktif: 'Nonaktif' }
  const chips = [
    configFilter && { label: `Konfigurasi: ${GANDENGAN_LABEL[configFilter] ?? configFilter}`, lepas: () => filter.lepas('config') },
    statusFilter && { label: `Status: ${LABEL_STATUS[statusFilter] ?? statusFilter}`, lepas: () => filter.lepas('status') },
    dokFilter && { label: dokFilter === 'kurang' ? 'Surat belum lengkap' : 'Surat habis / segera habis', lepas: () => filter.lepas('dok') },
  ]

  function openCreate() { setEditing(null); setForm(BLANK); setErrors({}); setFormOpen(true) }
  function openEdit(v: Vehicle) {
    setEditing(v)
    setForm({
      plate_number: v.plate_number, vehicle_type: v.vehicle_type, configuration: v.configuration, status: v.status,
      dokumen: { ...(v.dokumen ?? {}) }, attachments: v.attachments ?? [],
    })
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
    const { dokumen: dok, ...lain } = form
    const payload = { ...lain, dokumen: rapikanDokumen(dok), plate_number: form.plate_number.trim().toUpperCase() }
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
      render: (v) => (v.configuration ? <Badge tone="brand">{GANDENGAN_LABEL[v.configuration] ?? v.configuration}</Badge> : <span className="text-ink-3">—</span>),
    },
    {
      key: 'dokumen', header: 'Surat', width: '170px',
      render: (v) => {
        const r = ringkasDokumen(DOKUMEN_KENDARAAN, v.dokumen)
        return (
          <span className="block leading-tight">
            <span className={r.ada.length ? 'text-ink-2' : 'text-ink-3'}>{r.ada.length ? r.ada.join(', ') : 'Belum ada'}</span>
            {(r.habis.length > 0 || r.segera.length > 0) && (
              <span className="mt-0.5 block text-[11.5px] font-medium text-[color:var(--color-critical)]">
                {[...r.habis, ...r.segera].join(', ')} {r.habis.length ? 'habis' : 'segera habis'}
              </span>
            )}
          </span>
        )
      },
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
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(v)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(v)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Kendaraan"
        crumbs={[{ label: 'Master Data' }, { label: 'Kendaraan' }]}
        description="Master kendaraan beserta konfigurasi dan surat pentingnya (STNK, KIR, Pajak, Asuransi)."
        actions={<Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Kendaraan</Button>}
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari nomor kendaraan atau jenis..." />
              <PanelFilter filter={filter} chips={chips}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Konfigurasi">
                    {(id) => (
                      <Select id={id} value={d.config} onChange={(e) => filter.ubah({ config: e.target.value })}>
                        <option value="">Semua</option>
                        {VEHICLE_CONFIGS.map((c) => <option key={c} value={c}>{GANDENGAN_LABEL[c] ?? c}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="Status">
                    {(id) => (
                      <Select id={id} value={d.status} onChange={(e) => filter.ubah({ status: e.target.value })}>
                        <option value="">Semua</option>
                        <option value="aktif">Aktif</option>
                        <option value="servis">Servis</option>
                        <option value="nonaktif">Nonaktif</option>
                      </Select>
                    )}
                  </Field>
                </div>
                <Field label="Surat penting">
                  {(id) => (
                    <Select id={id} value={d.dok} onChange={(e) => filter.ubah({ dok: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="kurang">Belum lengkap</option>
                      <option value="habis">Habis / segera habis</option>
                    </Select>
                  )}
                </Field>
              </PanelFilter>
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
          empty={<EmptyState entity="kendaraan" />}
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
        title={editing ? 'Ubah Kendaraan' : 'Tambah Kendaraan'}
        subtitle={editing ? editing.plate_number : 'Tanda * wajib diisi.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        {/* Ringkas tanpa scroll (Baldy 14 Okt 2026): data kendaraan sebaris, surat sebaris di bawah. */}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-4">
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
          <Field label="Konfigurasi">
            {(id) => (
              <Select id={id} value={form.configuration} onChange={(e) => setForm({ ...form, configuration: e.target.value })}>
                <option value="">Standar</option>
                {VEHICLE_CONFIGS.map((c) => <option key={c} value={c}>{GANDENGAN_LABEL[c] ?? c}</option>)}
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
          <fieldset className="min-w-0 sm:col-span-2 md:col-span-4">
            <legend className="form-label">Surat & dokumen <span className="font-normal text-ink-3">· klik kotak untuk upload; foto diperkecil otomatis, PDF juga bisa</span></legend>
            <DokumenPentingInput jenis={DOKUMEN_KENDARAAN} value={form.dokumen} onChange={(v) => setForm((f) => ({ ...f, dokumen: v }))}
              lainnya={{ label: 'Foto & lainnya', value: form.attachments, onChange: (v) => setForm((f) => ({ ...f, attachments: v })) }} />
          </fieldset>
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
