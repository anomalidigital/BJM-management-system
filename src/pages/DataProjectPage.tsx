import { useCallback, useMemo, useState } from 'react'
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { SearchInput, Toolbar } from '../components/ui/Toolbar'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select, Checkbox } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, NotFoundState } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { useTable } from '../lib/useTable'
import { matchesQuery } from '../lib/utils'
import { formatNumber, formatRupiah } from '../lib/format'
import type { Project } from '../types'

type FormState = Omit<Project, 'id' | 'created_at' | 'updated_at'>
const BLANK: FormState = { project_code: '', project_name: '', description: '', requires_document: true, status: 'aktif' }

export function DataProjectPage() {
  const { db, transactionRows, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [editing, setEditing] = useState<Project | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<Project | null>(null)

  const stat = useMemo(() => {
    const m = new Map<string, { trip: number; uj: number }>()
    for (const t of transactionRows) {
      const a = m.get(t.project_id) ?? { trip: 0, uj: 0 }
      a.trip += 1; a.uj += t.uj_total
      m.set(t.project_id, a)
    }
    return m
  }, [transactionRows])

  const search = useCallback((p: Project, q: string) => matchesQuery(q, p.project_code, p.project_name, p.description), [])
  const table = useTable(db.projects, { search, initialSortKey: 'project_code', pageSize: 10 })

  function openCreate() { setEditing(null); setForm(BLANK); setErrors({}); setFormOpen(true) }
  function openEdit(p: Project) {
    setEditing(p)
    setForm({ project_code: p.project_code, project_name: p.project_name, description: p.description, requires_document: p.requires_document, status: p.status })
    setErrors({}); setFormOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    const kode = form.project_code.trim()
    if (!kode) e.project_code = 'Kode project wajib diisi.'
    else if (db.projects.some((p) => p.project_code.toLowerCase() === kode.toLowerCase() && p.id !== editing?.id))
      e.project_code = 'Kode project sudah dipakai.'
    if (!form.project_name.trim()) e.project_name = 'Nama project wajib diisi.'
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

  const columns: Column<Project>[] = [
    { key: 'project_code', header: 'Kode', sortable: true, width: '100px', render: (p) => <span className="tnum font-semibold text-ink">{p.project_code}</span> },
    { key: 'project_name', header: 'Nama Project', sortable: true, render: (p) => <span className="font-medium">{p.project_name}</span> },
    { key: 'description', header: 'Deskripsi', render: (p) => <span className="text-ink-2">{p.description || '—'}</span> },
    {
      key: 'requires_document', header: 'Alur Dokumen', sortable: true, width: '140px',
      render: (p) => (p.requires_document ? <Badge tone="brand">Pakai TR / No PI</Badge> : <Badge tone="neutral">Tanpa dokumen</Badge>),
    },
    { key: 'trip', header: 'Trip', align: 'right', width: '80px', render: (p) => <span className="tnum text-ink-2">{formatNumber(stat.get(p.id)?.trip ?? 0)}</span> },
    { key: 'uj', header: 'Total UJ', align: 'right', width: '140px', render: (p) => <span className="tnum text-ink-2">{formatRupiah(stat.get(p.id)?.uj ?? 0)}</span> },
    {
      key: 'status', header: 'Status', sortable: true, width: '104px',
      render: (p) => (p.status === 'aktif' ? <Badge tone="good">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(p)} />
          <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setDeleting(p)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Data Project"
        crumbs={[{ label: 'Master' }, { label: 'Data Project' }]}
        description="Project menentukan apakah sebuah trip memiliki alur dokumen TR / No PI."
        actions={<Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}>Tambah Project</Button>}
      />

      <Card>
        <Toolbar
          left={<SearchInput value={table.query} onChange={table.setQuery} placeholder="Cari kode atau nama project..." />}
          right={<span className="text-[12.5px] text-ink-3">{db.projects.length} project terdaftar</span>}
        />
        <DataTable
          columns={columns}
          rows={table.pageRows}
          rowKey={(p) => p.id}
          loading={loading}
          error={error}
          onRetry={reload}
          isFiltered={table.isFiltered}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState entity="data project" action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah Project</Button>} />}
          notFound={<NotFoundState onReset={table.reset} />}
        />
      </Card>

      <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-3">
        <FolderKanban size={13} className="mt-0.5 shrink-0" />
        Pada data operasional, seluruh trip bertanda <span className="font-medium text-ink-2">CASH</span> tercatat tanpa TR
        maupun No PI — polanya berbeda dari project berdokumen. Karena itu disediakan penanda{' '}
        <span className="font-medium text-ink-2">Alur Dokumen</span>, sehingga order tunai tidak tercampur ke dimensi
        customer. Perlu konfirmasi client (TBD-09).
      </p>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Data Project' : 'Tambah Data Project'}
        subtitle={editing ? editing.project_code : 'Tanda * wajib diisi.'}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>{editing ? 'Simpan Perubahan' : 'Simpan'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kode Project" required error={errors.project_code}>
            {(id) => <Input id={id} value={form.project_code} invalid={!!errors.project_code} placeholder="ARM" onChange={(e) => setForm({ ...form, project_code: e.target.value })} />}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </Select>
            )}
          </Field>
          <Field label="Nama Project" required error={errors.project_name} className="sm:col-span-2">
            {(id) => <Input id={id} value={form.project_name} invalid={!!errors.project_name} placeholder="Armada Migas Riau" onChange={(e) => setForm({ ...form, project_name: e.target.value })} />}
          </Field>
          <Field label="Deskripsi" className="sm:col-span-2">
            {(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              label="Trip project ini memakai alur dokumen (TR / No PI)"
              checked={form.requires_document}
              onChange={(e) => setForm({ ...form, requires_document: e.target.checked })}
            />
            <p className="mt-1 text-[12px] text-ink-3">Matikan untuk order tunai yang tidak melalui dokumen.</p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.project_code} — {deleting?.project_name}</span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
