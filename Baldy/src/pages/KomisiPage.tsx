import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { Button, IconButton } from '../components/ui/Button'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Field, Input } from '../components/ui/Field'
import { CurrencyInput } from '../components/ui/CurrencyInput'
import { EmptyState } from '../components/ui/States'
import { useData } from '../store/DataProvider'
import { useAuth } from '../store/AuthProvider'
import { useToast } from '../store/ToastProvider'
import { currencyInputValue, formatRupiah, parseCurrencyInput } from '../lib/format'
import { cn } from '../lib/utils'
import type { CommissionScheme, CommissionUnit } from '../types'

type FormState = Omit<CommissionScheme, 'id' | 'created_at' | 'updated_at' | 'workspace'>

const BLANK: FormState = {
  name: '', target: 0,
  base_commission: 0, base_commission_unit: 'rp',
  target_commission: 0, target_commission_unit: 'rp',
  notes: '',
}

/** 10.5 -> "10,5" mengikuti penulisan angka Indonesia. */
const tulisAngka = (v: number) => String(v).replace('.', ',')

/** Nilai komisi apa adanya: "Rp 25.000" atau "10%". */
const tulisKomisi = (nilai: number, unit: CommissionUnit) =>
  unit === 'persen' ? `${tulisAngka(nilai)}%` : formatRupiah(nilai)

/**
 * Isian komisi dengan pemilih satuan menempel di kiri kolom angka:
 * Rp untuk nominal tetap, % untuk bagian dari target.
 */
function NilaiKomisi({
  id, value, unit, onValue, onUnit, invalid,
}: {
  id: string
  value: number
  unit: CommissionUnit
  onValue: (v: number) => void
  onUnit: (u: CommissionUnit) => void
  invalid?: boolean
}) {
  const persen = unit === 'persen'

  function ubah(raw: string) {
    if (!persen) { onValue(parseCurrencyInput(raw)); return }
    const angka = Number(raw.replace(',', '.').replace(/[^\d.]/g, ''))
    onValue(Number.isFinite(angka) ? Math.min(angka, 100) : 0)
  }

  return (
    <div
      className={cn(
        'flex h-9 w-full items-center overflow-hidden rounded-md border bg-surface transition-colors',
        'focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/15',
        invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline',
      )}
    >
      <select
        value={unit}
        aria-label="Satuan komisi"
        onChange={(e) => onUnit(e.target.value as CommissionUnit)}
        className="h-full cursor-pointer border-r border-hairline bg-sunken pr-6 pl-2.5 text-[12px] font-semibold text-ink-2 outline-none"
      >
        <option value="rp">Rp</option>
        <option value="persen">%</option>
      </select>
      <input
        id={id}
        inputMode="decimal"
        value={persen ? tulisAngka(value) : currencyInputValue(value)}
        onChange={(e) => ubah(e.target.value)}
        className="tnum h-full min-w-0 flex-1 bg-transparent px-2.5 text-right text-[13px] text-ink outline-none"
      />
    </div>
  )
}

/**
 * Master -> Komisi.
 * Daftar tarif komisi: satu baris = Nama, Target, dan komisi yang berlaku.
 * Halaman ini hanya untuk mengatur nilai - pencapaian dilaporkan di menu
 * laporan, bukan di sini.
 */
export function KomisiPage() {
  const { db, loading, error, reload, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionScheme | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleting, setDeleting] = useState<CommissionScheme | null>(null)

  function openCreate() {
    setEditing(null); setForm(BLANK); setErrors({}); setFormOpen(true)
  }

  function openEdit(s: CommissionScheme) {
    setEditing(s)
    setForm({
      name: s.name, target: s.target,
      base_commission: s.base_commission, base_commission_unit: s.base_commission_unit ?? 'rp',
      target_commission: s.target_commission, target_commission_unit: s.target_commission_unit ?? 'rp',
      notes: s.notes ?? '',
    })
    setErrors({}); setFormOpen(true)
  }

  function onSubmit() {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) e.name = 'Nama wajib diisi.'
    if (form.target <= 0) e.target = 'Target harus lebih dari 0.'
    if (form.base_commission <= 0) e.base_commission = 'Komisi dasar harus lebih dari 0.'
    if (form.target_commission <= 0) e.target_commission = 'Komisi target harus lebih dari 0.'
    // Hanya bisa dibandingkan bila satuannya sama.
    else if (
      form.base_commission_unit === form.target_commission_unit &&
      form.target_commission < form.base_commission
    ) e.target_commission = 'Komisi target tidak boleh lebih kecil dari komisi dasar.'
    setErrors(e)
    if (Object.keys(e).length > 0) { toast.error('Periksa kembali isian yang ditandai merah.'); return }

    const payload = { ...form, name: form.name.trim() }
    if (editing) { update('commissionSchemes', editing.id, payload); toast.success('Komisi berhasil diperbarui.') }
    else { create('commissionSchemes', payload); toast.success('Komisi berhasil disimpan.') }
    setFormOpen(false)
  }

  function onDelete() {
    if (!deleting) return
    remove('commissionSchemes', deleting.id)
    toast.success('Komisi berhasil dihapus.')
    setDeleting(null)
  }

  const columns: Column<CommissionScheme>[] = [
    { key: 'name', header: 'Nama', render: (s) => <span className="font-medium text-ink">{s.name}</span> },
    {
      key: 'target', header: 'Target', align: 'right', width: '200px',
      render: (s) => <span className="tnum">{formatRupiah(s.target)}</span>,
    },
    {
      key: 'commission', header: 'Komisi', align: 'right', width: '220px',
      render: (s) => (
        <span className="tnum leading-tight">
          <span className="font-semibold text-ink">{tulisKomisi(s.base_commission, s.base_commission_unit ?? 'rp')}</span>
          <span className="block text-[11.5px] text-ink-3">
            {tulisKomisi(s.target_commission, s.target_commission_unit ?? 'rp')} bila target tercapai
          </span>
        </span>
      ),
    },
    {
      key: 'action', header: 'Action', align: 'right', width: '92px',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!canEdit} onClick={() => openEdit(s)} />
          <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!canEdit} onClick={() => setDeleting(s)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Komisi"
        crumbs={[{ label: 'Master' }, { label: 'Komisi' }]}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} disabled={!canEdit} onClick={openCreate}>
            Tambah Komisi
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={db.commissionSchemes}
          rowKey={(s) => s.id}
          loading={loading}
          error={error}
          onRetry={reload}
          skeletonCols={4}
          empty={
            <EmptyState
              entity="komisi"
              action={canEdit && <Button variant="primary" icon={<Plus size={15} />} onClick={openCreate}>Tambah Komisi</Button>}
            />
          }
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah Komisi' : 'Pengaturan Komisi'}
        subtitle="Komisi dasar dipakai selama target belum tercapai; setelah tercapai memakai komisi target."
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={onSubmit}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Target" required error={errors.target}>
            {(id) => <CurrencyInput id={id} value={form.target} invalid={!!errors.target} onValueChange={(v) => setForm({ ...form, target: v })} />}
          </Field>
          <Field label="Komisi Dasar" required error={errors.base_commission}>
            {(id) => (
              <NilaiKomisi
                id={id}
                value={form.base_commission}
                unit={form.base_commission_unit}
                invalid={!!errors.base_commission}
                onValue={(v) => setForm((f) => ({ ...f, base_commission: v }))}
                onUnit={(u) => setForm((f) => ({ ...f, base_commission_unit: u }))}
              />
            )}
          </Field>
          <Field label="Komisi Apabila Target Tercapai" required error={errors.target_commission}>
            {(id) => (
              <NilaiKomisi
                id={id}
                value={form.target_commission}
                unit={form.target_commission_unit}
                invalid={!!errors.target_commission}
                onValue={(v) => setForm((f) => ({ ...f, target_commission: v }))}
                onUnit={(u) => setForm((f) => ({ ...f, target_commission_unit: u }))}
              />
            )}
          </Field>
          <Field label="Nama" required error={errors.name}>
            {(id) => (
              <Input id={id} value={form.name} invalid={!!errors.name} placeholder="Komisi Standar"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            )}
          </Field>
          <Field label="Catatan">
            {(id) => <Input id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{deleting?.name}</span>
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
      />
    </>
  )
}
