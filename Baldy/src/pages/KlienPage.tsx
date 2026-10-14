import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaPen, FaPlus, FaTrashCan } from '../components/ui/icons'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { PanelFilter, SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, DetailButton, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select, Checkbox, Radio } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { useFilter } from '../lib/useFilter'
import { matchesQuery } from '../lib/utils'
import { formatNumber, formatRupiah } from '../lib/format'
import { kodeKlienBerikut } from '../lib/kode'
import { KodeInput } from '../components/ui/KodeInput'
import { CLIENT_TYPES, CLIENT_TYPE_KET, CLIENT_TYPE_LABEL } from '../types'
import type { Project } from '../types'

type FormState = Omit<Project, 'id' | 'created_at' | 'updated_at'>
const FILTER_KOSONG = { layanan: '', dokumen: '', status: '' }
const BLANK: FormState = { project_code: '', project_name: '', client_type: 'callout', description: '', requires_document: true, status: 'aktif' }

type Baris = Project & { trip: number; uj: number; kontrakAktif: number; kontrakTotal: number; kontrakLain: number; nilaiAktif: number }

/**
 * Master -> Klien. Tipe layanan klien (Callout / Dedicated, revisi 13 Okt 2026) terbawa langsung
 * ke form trip; kontrak klien Dedicated dikelola di halaman tiap klien.
 */
export function KlienPage() {
  const { db, dbAll, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [editing, setEditing] = useState<Project | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Baris | null>(null)
  const filter = useFilter(FILTER_KOSONG)
  const f = filter.nilai
  const d = filter.draf

  const baris = useMemo<Baris[]>(() => {
    const trip = new Map<string, { n: number; uj: number }>()
    for (const t of transactionRows) {
      // Trip batal hanya arsip, tidak dihitung.
      if (!t.project_id || t.status === 'batal') continue
      const a = trip.get(t.project_id) ?? { n: 0, uj: 0 }
      a.n += 1; a.uj += t.uj_total
      trip.set(t.project_id, a)
    }
    return db.projects.map((p) => {
      const kontrak = db.contracts.filter((c) => c.project_id === p.id)
      const aktif = kontrak.filter((c) => c.status === 'aktif')
      return {
        ...p,
        trip: trip.get(p.id)?.n ?? 0,
        uj: trip.get(p.id)?.uj ?? 0,
        kontrakAktif: aktif.length,
        kontrakTotal: kontrak.length,
        // Kontrak dicatat per workspace; yang di workspace lain disebut saja.
        kontrakLain: dbAll.contracts.filter((c) => c.project_id === p.id).length - kontrak.length,
        nilaiAktif: aktif.reduce((a, c) => a + c.value, 0),
      }
    })
  }, [db.projects, db.contracts, dbAll.contracts, transactionRows])

  const search = useCallback((p: Baris, q: string) => matchesQuery(q, p.project_code, p.project_name, p.description), [])
  const extraFilter = useCallback(
    (p: Baris) => (!f.layanan || p.client_type === f.layanan) && (!f.status || p.status === f.status)
      && (!f.dokumen || (f.dokumen === 'ya') === p.requires_document),
    [f.layanan, f.status, f.dokumen],
  )
  const jumlahFilter = [f.layanan, f.dokumen, f.status].filter(Boolean).length
  const table = useTable(baris, { search, extraFilter, extraFilterActive: jumlahFilter > 0, initialSortKey: 'project_code', pageSize: 10 })
  const resetFilter = () => { table.reset(); filter.lepasSemua() }
  const chips = [
    f.layanan && { label: `Tipe: ${CLIENT_TYPE_LABEL[f.layanan as keyof typeof CLIENT_TYPE_LABEL] ?? f.layanan}`, lepas: () => filter.lepas('layanan') },
    f.dokumen && { label: f.dokumen === 'ya' ? 'Pakai TR / No PI' : 'Tanpa dokumen', lepas: () => filter.lepas('dokumen') },
    f.status && { label: `Status: ${f.status === 'aktif' ? 'Aktif' : 'Nonaktif'}`, lepas: () => filter.lepas('status') },
  ]

  // Kode klien dibuat dari singkatan nama, jadi saat form dibuka kodenya masih kosong.
  function openCreate() {
    setEditing(null); setForm(BLANK); setErrors({}); setFormOpen(true)
  }

  const kodeDariNama = (nama: string) =>
    kodeKlienBerikut(nama, db.projects.filter((p) => p.id !== editing?.id).map((p) => p.project_code))

  /** Generate: singkatan Nama Klien (PT Delta Energi Riau -> DER). Butuh nama terisi. */
  function generateKode() {
    if (!form.project_name.trim()) {
      setErrors((e) => ({ ...e, project_code: 'Isi Nama Klien dulu. Kode dibuat dari singkatan nama.' }))
      return
    }
    setForm((f) => ({ ...f, project_code: kodeDariNama(f.project_name) }))
    setErrors((e) => ({ ...e, project_code: undefined }))
  }

  /** Selesai mengisi nama: kode yang masih kosong langsung diisi dari singkatannya. */
  function isiKodeDariNama() {
    if (form.project_code.trim() || !form.project_name.trim()) return
    setForm((f) => ({ ...f, project_code: kodeDariNama(f.project_name) }))
    setErrors((e) => ({ ...e, project_code: undefined }))
  }
  function openEdit(p: Project) {
    setEditing(p)
    setForm({
      project_code: p.project_code, project_name: p.project_name, client_type: p.client_type ?? 'callout',
      description: p.description, requires_document: p.requires_document, status: p.status,
    })
    setErrors({}); setFormOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const kode = form.project_code.trim()
    if (!kode) e.project_code = 'Kode klien wajib diisi.'
    else if (db.projects.some((p) => p.project_code.toLowerCase() === kode.toLowerCase() && p.id !== editing?.id))
      e.project_code = 'Kode klien sudah dipakai.'
    if (!form.project_name.trim()) e.project_name = 'Nama klien wajib diisi.'
    // Klien yang masih punya kontrak tidak bisa dijadikan Callout.
    const kontrakAda = editing ? dbAll.contracts.filter((c) => c.project_id === editing.id).length : 0
    if (form.client_type === 'callout' && kontrakAda > 0)
      e.client_type = `Klien ini masih punya ${kontrakAda} kontrak. Hapus kontraknya dulu di halaman klien bila ingin menjadikannya Callout.`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onSubmit() {
    if (!validate()) return
    const payload = { ...form, project_code: form.project_code.trim().toUpperCase(), project_name: form.project_name.trim() }
    if (editing) { update('projects', editing.id, payload); toast.success('Data berhasil diperbarui.') }
    else { create('projects', payload); toast.success('Data berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('projects', deleting.id)
    toast.success('Data berhasil dihapus.')
    setDeleting(null)
  }

  /** Kontrak di workspace mana pun yang masih milik klien ini. */
  const kontrakMilik = deleting ? dbAll.contracts.filter((c) => c.project_id === deleting.id).length : 0

  const columns: Column<Baris>[] = [
    { key: 'project_code', header: 'Kode', sortable: true, width: '100px', render: (p) => <span className="tnum font-semibold text-ink">{p.project_code}</span> },
    {
      key: 'project_name', header: 'Nama Klien', sortable: true,
      render: (p) => (
        <div className="leading-tight">
          <Link to={`/master/klien/${p.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">{p.project_name}</Link>
          {p.description && <span className="mt-0.5 block text-[12px] text-ink-3">{p.description}</span>}
        </div>
      ),
    },
    {
      key: 'client_type', header: 'Tipe Layanan', sortable: true, width: '124px',
      render: (p) => (p.client_type === 'dedicated' ? <Badge tone="brand">Dedicated</Badge> : <Badge tone="neutral">Callout</Badge>),
    },
    {
      key: 'requires_document', header: 'Alur Dokumen', sortable: true, width: '140px',
      render: (p) => (p.requires_document ? <Badge tone="brand">Pakai TR / No PI</Badge> : <Badge tone="neutral">Tanpa dokumen</Badge>),
    },
    {
      key: 'kontrakAktif', header: 'Kontrak', sortable: true, width: '150px',
      render: (p) => (p.kontrakTotal === 0 ? (
        p.client_type === 'dedicated'
          ? (
            <Link to={`/master/klien/${p.id}`} className="text-[12.5px] text-ink-3 hover:text-brand-700 hover:underline">
              {p.kontrakLain > 0 ? `${p.kontrakLain} di workspace lain` : 'Belum ada kontrak'}
            </Link>
          )
          : <span className="text-ink-3">—</span>
      ) : (
        <Link to={`/master/klien/${p.id}`} className="group block leading-tight">
          <span className="font-medium text-brand-700 group-hover:underline">
            {p.kontrakAktif > 0 ? `${p.kontrakAktif} aktif` : `${p.kontrakTotal} selesai`}
          </span>
          {p.kontrakAktif > 0 && <span className="tnum mt-0.5 block text-[11.5px] text-ink-3">{formatRupiah(p.nilaiAktif, { compact: true })}</span>}
        </Link>
      )),
    },
    { key: 'trip', header: 'Trip', sortable: true, align: 'right', width: '80px', render: (p) => <span className="tnum text-ink-2">{formatNumber(p.trip)}</span> },
    { key: 'uj', header: 'Total Uang Jalan', sortable: true, align: 'right', width: '140px', render: (p) => <span className="tnum text-ink-2">{formatRupiah(p.uj)}</span> },
    {
      key: 'status', header: 'Status', sortable: true, width: '104px',
      render: (p) => (p.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '124px',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <DetailButton label={`Lihat detail ${p.project_name} (kontrak & trip)`} onClick={() => navigate(`/master/klien/${p.id}`)} />
          <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!canEdit} onClick={() => openEdit(p)} />
          <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!canEdit} onClick={() => setDeleting(p)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Klien / Pelanggan"
        crumbs={[{ label: 'Master Data' }, { label: 'Klien / Pelanggan' }]}
        description="Tipe layanan klien (Callout / Dedicated) terbawa otomatis ke form trip. Kontrak klien Dedicated dikelola di halaman klien."
        actions={<Button variant="primary" icon={<FaPlus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Klien</Button>}
      />

      <Card>
        <Toolbar
          left={
            <>
              <SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari kode atau nama klien..." />
              <PanelFilter filter={filter} chips={chips}>
                <Field label="Tipe Layanan">
                  {(id) => (
                    <Select id={id} value={d.layanan} onChange={(e) => filter.ubah({ layanan: e.target.value })}>
                      <option value="">Semua</option>
                      {CLIENT_TYPES.map((j) => <option key={j} value={j}>{CLIENT_TYPE_LABEL[j]}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Alur Dokumen">
                  {(id) => (
                    <Select id={id} value={d.dokumen} onChange={(e) => filter.ubah({ dokumen: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="ya">Pakai TR / No PI</option>
                      <option value="tidak">Tanpa dokumen</option>
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
              </PanelFilter>
            </>
          }
          right={(
            <span className="text-[12.5px] text-ink-3">
              {db.projects.length} klien · {baris.filter((p) => p.client_type === 'dedicated').length} Dedicated
            </span>
          )}
        />
        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(p) => p.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered || jumlahFilter > 0}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="klien" />}
          notFound={<NotFoundState onReset={resetFilter} />}
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Klien' : 'Tambah Klien'}
        subtitle={editing ? editing.project_code : 'Tanda * wajib diisi. Kontrak klien Dedicated ditambahkan setelah klien tersimpan.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipe Layanan" required error={errors.client_type} className="sm:col-span-2"
            hint={errors.client_type ? undefined : 'Terdeteksi otomatis di form trip saat klien ini dipilih.'}>
            {() => (
              <div className="grid gap-3 sm:grid-cols-2">
                {CLIENT_TYPES.map((j) => (
                  <Radio
                    key={j}
                    name="jenis-klien"
                    checked={form.client_type === j}
                    onChange={() => setForm({ ...form, client_type: j })}
                    label={CLIENT_TYPE_LABEL[j]}
                    description={CLIENT_TYPE_KET[j]}
                  />
                ))}
              </div>
            )}
          </Field>
          <Field label="Nama Klien" required error={errors.project_name} className="sm:col-span-2">
            {(id) => (
              <Input id={id} value={form.project_name} invalid={!!errors.project_name} placeholder="PT Delta Energi Riau"
                onChange={(e) => setForm({ ...form, project_name: e.target.value })} onBlur={isiKodeDariNama} />
            )}
          </Field>
          <Field label="Kode Klien" required error={errors.project_code}
            hint={errors.project_code ? undefined : 'Terisi dari singkatan Nama Klien (PT Delta Energi Riau → DER). Boleh diubah.'}>
            {(id) => (
              <KodeInput id={id} value={form.project_code} invalid={!!errors.project_code} placeholder="Isi Nama Klien dulu" uppercase
                generateTitle="Buat kode dari Nama Klien"
                onChange={(v) => setForm({ ...form, project_code: v })} onGenerate={generateKode} />
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </Select>
            )}
          </Field>
          <Field label="Deskripsi" className="sm:col-span-2">
            {(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              label="Trip klien ini memakai alur dokumen (TR / No PI)"
              checked={form.requires_document}
              onChange={(e) => setForm({ ...form, requires_document: e.target.checked })}
            />
            <p className="mt-1 text-[12px] text-ink-3">Matikan untuk order tunai yang tidak melalui dokumen.</p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={kontrakMilik ? 'Klien masih punya kontrak' : undefined}
        confirmLabel={kontrakMilik ? 'Mengerti' : undefined}
        tone={kontrakMilik ? 'primary' : undefined}
        message={kontrakMilik ? (
          `${deleting?.project_name} masih punya ${kontrakMilik} kontrak. Hapus kontraknya dulu di halaman klien, atau ubah status klien menjadi Nonaktif.`
        ) : (
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.project_code} — {deleting?.project_name}</span>
          </>
        )}
        onCancel={() => setDeleting(null)}
        onConfirm={kontrakMilik ? () => setDeleting(null) : onDelete}
      />
    </>
  )
}
