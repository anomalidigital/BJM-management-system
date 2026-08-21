import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, Input, DateInput, Checkbox } from '../../components/ui/Field'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { SearchInput } from '../../components/ui/Toolbar'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { TableSkeleton } from '../../components/ui/States'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { formatDate, formatRupiah, todayISO } from '../../lib/format'
import { cn, matchesQuery } from '../../lib/utils'
import type { Billing, BillingRow } from '../../types'

type FormState = Omit<Billing, 'id' | 'created_at' | 'updated_at' | 'is_marked'>

const blank = (): FormState => ({
  invoice_no: '', job_order_id: '', cost_code: '', billing_date: todayISO(), withdrawal_date: todayISO(),
  amount: 0, guarantee_amount: 0, is_sunting: false, is_rejected: false, paid_date: null,
  bl_no: '', invoice_ref: '', notes: '',
})

/**
 * Daftar record dapat diklik langsung, dilengkapi tombol Previous / Next Record.
 */
export function ProsesDataTab() {
  const { db, billingRows, loading, create, update, remove } = useData()
  const { canEdit } = useAuth()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [form, setForm] = useState<FormState>(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState(false)

  const records = useMemo(
    () =>
      billingRows
        .filter((b) => matchesQuery(query, b.invoice_no, b.sijo, b.cost_code, b.customer_name))
        .sort((a, b) => b.billing_date.localeCompare(a.billing_date)),
    [billingRows, query],
  )

  const index = records.findIndex((r) => r.id === activeId)
  const active: BillingRow | undefined = index >= 0 ? records[index] : records[0]

  useEffect(() => {
    if (!activeId && records.length > 0) setActiveId(records[0].id)
  }, [activeId, records])

  useEffect(() => {
    if (mode === 'view' && active) {
      setForm({
        invoice_no: active.invoice_no, job_order_id: active.job_order_id, cost_code: active.cost_code,
        billing_date: active.billing_date, withdrawal_date: active.withdrawal_date, amount: active.amount,
        guarantee_amount: active.guarantee_amount, is_sunting: active.is_sunting, is_rejected: active.is_rejected,
        paid_date: active.paid_date, bl_no: active.bl_no, invoice_ref: active.invoice_ref, notes: active.notes,
      })
    }
  }, [active, mode])

  const joOptions = useMemo(
    () => db.jobOrders.map((j) => ({ value: j.id, label: j.sijo, meta: `${j.customer_name} · ${j.party}`, keywords: j.customer_code })),
    [db.jobOrders],
  )
  const selectedJo = db.jobOrders.find((j) => j.id === form.job_order_id)
  const readOnly = mode === 'view'

  function startCreate() {
    setMode('create'); setForm(blank()); setErrors({})
  }

  function startEdit() {
    if (!active) return
    setMode('edit'); setErrors({})
  }

  function cancel() {
    setMode('view'); setErrors({})
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.invoice_no.trim()) e.invoice_no = 'No Faktur wajib diisi.'
    else if (db.billings.some((b) => b.invoice_no.toLowerCase() === form.invoice_no.trim().toLowerCase() && b.id !== (mode === 'edit' ? active?.id : undefined)))
      e.invoice_no = 'No Faktur sudah dipakai.'
    if (!form.job_order_id) e.job_order_id = 'No. SI/JO wajib dipilih.'
    if (!form.cost_code.trim()) e.cost_code = 'Data Cost wajib diisi.'
    if (!form.billing_date) e.billing_date = 'Tgl Tagih wajib diisi.'
    if (form.amount <= 0) e.amount = 'Jumlah Rp harus lebih dari 0.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function save() {
    if (!validate()) { toast.error('Periksa kembali isian yang ditandai merah.'); return }
    const payload = { ...form, invoice_no: form.invoice_no.trim(), cost_code: form.cost_code.trim().toUpperCase() }
    if (mode === 'edit' && active) {
      update('billings', active.id, payload)
      toast.success('Data berhasil diperbarui.')
    } else {
      const created = create('billings', { ...payload, is_marked: false })
      setActiveId(created.id)
      toast.success('Data berhasil disimpan.')
    }
    setMode('view')
  }

  function onDelete() {
    if (!active) return
    remove('billings', active.id)
    setActiveId(records[index + 1]?.id ?? records[index - 1]?.id ?? null)
    setDeleting(false)
    toast.success('Data berhasil dihapus.')
  }

  if (loading) return <TableSkeleton rows={7} cols={5} />

  return (
    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Daftar record — pengganti navigasi Atas/Bawah/Sebelum/Berikut */}
      <aside className="border-b border-hairline lg:border-r lg:border-b-0">
        <div className="border-b border-hairline p-3">
          <SearchInput value={query} onChange={setQuery} width="w-full" placeholder="Cari faktur / SI-JO..." />
        </div>
        <ul className="max-h-[560px] overflow-y-auto">
          {records.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-ink-3">Data tidak ditemukan.</li>}
          {records.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => { setActiveId(r.id); setMode('view') }}
                className={cn(
                  'w-full border-b border-grid px-3.5 py-2.5 text-left transition-colors',
                  r.id === active?.id ? 'bg-brand-50' : 'hover:bg-sunken',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="tnum text-[12.5px] font-semibold text-ink">{r.invoice_no}</span>
                  <span className="tnum text-[11.5px] text-ink-3">{formatDate(r.billing_date)}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="tnum truncate text-[12px] text-ink-3">Sijo {r.sijo}</span>
                  <span className="tnum shrink-0 text-[12px] font-medium text-ink-2">{formatRupiah(r.amount, { compact: true })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Form record */}
      <section className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm" icon={<ChevronLeft size={14} />} disabled={mode !== 'view' || index <= 0}
              onClick={() => setActiveId(records[index - 1]?.id ?? null)}
            >
              Previous Record
            </Button>
            <Button
              size="sm" disabled={mode !== 'view' || index < 0 || index >= records.length - 1}
              onClick={() => setActiveId(records[index + 1]?.id ?? null)}
            >
              Next Record
              <ChevronRight size={14} />
            </Button>
            {records.length > 0 && (
              <span className="tnum ml-1 text-[12px] text-ink-3">
                Record {Math.max(index, 0) + 1} dari {records.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mode === 'view' ? (
              <>
                <Button size="sm" icon={<Plus size={14} />} disabled={!canEdit} onClick={startCreate}>Tambah</Button>
                <Button size="sm" icon={<Pencil size={14} />} disabled={!canEdit || !active} onClick={startEdit}>Edit</Button>
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} disabled={!canEdit || !active} onClick={() => setDeleting(true)}>Hapus</Button>
              </>
            ) : (
              <>
                <Button size="sm" icon={<X size={14} />} onClick={cancel}>Batal</Button>
                <Button size="sm" variant="primary" icon={<Save size={14} />} onClick={save}>Simpan</Button>
              </>
            )}
          </div>
        </header>

        {!active && mode === 'view' ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[14px] font-semibold text-ink">Belum ada data.</p>
            <p className="mt-1 text-[13px] text-ink-3">Tambahkan tagihan pertama untuk memulai.</p>
            {canEdit && <Button className="mt-4" variant="primary" icon={<Plus size={15} />} onClick={startCreate}>Tambah</Button>}
          </div>
        ) : (
          <div className="p-4">
            {mode !== 'view' && (
              <p className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-[12.5px] font-medium text-brand-800">
                {mode === 'create' ? 'Mode tambah data baru.' : `Mode ubah record ${active?.invoice_no}.`}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="No. SI/JO" required error={errors.job_order_id} className="sm:col-span-2 xl:col-span-1">
                {(fid) => (
                  <SearchableSelect
                    id={fid} options={joOptions} value={form.job_order_id || null} disabled={readOnly} invalid={!!errors.job_order_id}
                    placeholder="Cari nomor SI / Job Order..."
                    onChange={(v) => {
                      const jo = db.jobOrders.find((j) => j.id === v)
                      setForm((f) => ({ ...f, job_order_id: v ?? '', cost_code: f.cost_code || jo?.customer_code || '' }))
                    }}
                  />
                )}
              </Field>
              <Field label="Data Cost" required error={errors.cost_code} hint={errors.cost_code ? undefined : 'Kode biaya (Kodecost).'}>
                {(fid) => <Input id={fid} value={form.cost_code} readOnly={readOnly} invalid={!!errors.cost_code} onChange={(e) => setForm({ ...form, cost_code: e.target.value })} />}
              </Field>
              <Field label="No Faktur" required error={errors.invoice_no}>
                {(fid) => <Input id={fid} value={form.invoice_no} readOnly={readOnly} invalid={!!errors.invoice_no} placeholder="INV-047" onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} />}
              </Field>
              <Field label="Customer" hint="Diambil dari SI/JO.">
                {(fid) => <Input id={fid} value={selectedJo?.customer_name ?? ''} readOnly />}
              </Field>
              <Field label="Party" hint="Diambil dari SI/JO.">
                {(fid) => <Input id={fid} value={selectedJo?.party ?? ''} readOnly />}
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Tgl Tagih" required error={errors.billing_date}>
                {(fid) => <DateInput id={fid} value={form.billing_date} readOnly={readOnly} invalid={!!errors.billing_date} onChange={(e) => setForm({ ...form, billing_date: e.target.value })} />}
              </Field>
              <Field label="Tgl Tarik">
                {(fid) => <DateInput id={fid} value={form.withdrawal_date} readOnly={readOnly} onChange={(e) => setForm({ ...form, withdrawal_date: e.target.value })} />}
              </Field>
              <Field label="Tanggal Lunas" hint="Kosongkan bila belum lunas.">
                {(fid) => <DateInput id={fid} value={form.paid_date ?? ''} readOnly={readOnly} onChange={(e) => setForm({ ...form, paid_date: e.target.value || null })} />}
              </Field>
              <Field label="Jumlah Rp" required error={errors.amount}>
                {(fid) => <CurrencyInput id={fid} value={form.amount} disabled={readOnly} invalid={!!errors.amount} onValueChange={(v) => setForm({ ...form, amount: v })} />}
              </Field>
              <Field label="Jaminan Rp">
                {(fid) => <CurrencyInput id={fid} value={form.guarantee_amount} disabled={readOnly} onValueChange={(v) => setForm({ ...form, guarantee_amount: v })} />}
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-5 rounded-lg border border-hairline bg-sunken px-3.5 py-3">
              <Checkbox label="SUNTING" checked={form.is_sunting} disabled={readOnly} onChange={(e) => setForm({ ...form, is_sunting: e.target.checked })} />
              <Checkbox label="DITOLAK" checked={form.is_rejected} disabled={readOnly} onChange={(e) => setForm({ ...form, is_rejected: e.target.checked })} />
              <span className="ml-auto flex flex-wrap items-center gap-2">
                {form.is_rejected && <Badge tone="critical">DITOLAK</Badge>}
                {form.is_sunting && <Badge tone="warning">SUNTING</Badge>}
                {form.paid_date && <Badge tone="good">Lunas {formatDate(form.paid_date)}</Badge>}
              </span>
            </div>

            <details className="mt-4 rounded-lg border border-hairline">
              <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-medium text-ink-2 select-none">
                Field lainnya (BL No, Invoice No, Catatan)
              </summary>
              <div className="grid gap-4 border-t border-hairline p-3.5 sm:grid-cols-3">
                <Field label="BL No">{(fid) => <Input id={fid} value={form.bl_no} readOnly={readOnly} onChange={(e) => setForm({ ...form, bl_no: e.target.value })} />}</Field>
                <Field label="Invoice No">{(fid) => <Input id={fid} value={form.invoice_ref} readOnly={readOnly} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} />}</Field>
                <Field label="Catatan">{(fid) => <Input id={fid} value={form.notes} readOnly={readOnly} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
              </div>
            </details>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleting}
        message={
          <>
            Data yang sudah dihapus mungkin tidak dapat dikembalikan.
            <br />
            <span className="mt-2 block font-medium text-ink">{active?.invoice_no} — Sijo {active?.sijo}</span>
          </>
        }
        onCancel={() => setDeleting(false)}
        onConfirm={onDelete}
      />
    </div>
  )
}
