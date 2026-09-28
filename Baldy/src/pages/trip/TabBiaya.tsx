import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, Input, DateInput, Select } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { hapusLampiran } from '../../lib/lampiran'
import { formatDate, formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { EXPENSE_TYPES } from '../../types'
import type { OperationalExpense, TransactionRow } from '../../types'
import { KepalaTab, KepalaTabel, KosongTab, PakaiNilai, PesanGalat } from './bagian'

type Form = Pick<OperationalExpense, 'expense_type' | 'amount' | 'expense_date' | 'notes' | 'attachments'>

/** Tab Biaya Operasional: biaya di jalan (DEX, tol, nginap, ...) yang benar-benar terjadi. */
export function TabBiaya({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, create, update, remove } = useData()
  const toast = useToast()

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<OperationalExpense | null>(null)
  const [form, setForm] = useState<Form>({ expense_type: 'DEX', amount: 0, expense_date: '', notes: '', attachments: [] })
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<OperationalExpense | null>(null)

  const expenses = useMemo(
    // Dibaca dari seluruh data supaya arsip trip batal tetap terlihat.
    () => dbAll.expenses.filter((e) => e.trip_id === trip.id).sort((a, b) => a.expense_date.localeCompare(b.expense_date)),
    [dbAll.expenses, trip.id],
  )
  const total = expenses.reduce((a, e) => a + e.amount, 0)
  const batal = trip.status === 'batal'

  function buka(e?: OperationalExpense) {
    setEditing(e ?? null)
    setForm(e
      ? { expense_type: e.expense_type, amount: e.amount, expense_date: e.expense_date, notes: e.notes, attachments: e.attachments ?? [] }
      : { expense_type: 'DEX', amount: 0, expense_date: trip.transaction_date, notes: '', attachments: [] })
    setGalat(null); setTerbuka(true)
  }

  function simpan() {
    if (form.amount <= 0) { setGalat('Nominal harus lebih dari 0.'); return }
    if (!form.expense_date) { setGalat('Tanggal wajib diisi.'); return }
    if (editing) { update('expenses', editing.id, form); toast.success('Biaya berhasil diperbarui.') }
    else { create('expenses', { ...form, trip_id: trip.id }); toast.success('Biaya berhasil ditambahkan.') }
    setTerbuka(false)
  }

  function hapus() {
    if (!menghapus) return
    remove('expenses', menghapus.id)
    void hapusLampiran(menghapus.attachments ?? [])
    toast.success('Biaya berhasil dihapus.')
    setMenghapus(null)
  }

  return (
    <div>
      <KepalaTab
        keterangan={batal
          ? 'Trip dibatalkan: biaya di bawah hanya arsip dan tidak dihitung di laporan.'
          : 'Tambahkan hanya biaya yang benar-benar terjadi. Tol yang dibayar dicatat di sini dengan jenis Tol; Uang Tol di route hanya patokan.'}
        tombol="Tambah Biaya"
        bisaUbah={bisaUbah}
        onTambah={() => buka()}
      />
      {expenses.length === 0 ? (
        <KosongTab
          judul="Belum ada biaya operasional."
          keterangan="Trip ini belum mencatat DEX, tol, nginap, atau biaya lain."
          tombol="Tambah Biaya"
          bisaUbah={bisaUbah}
          onTambah={() => buka()}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <KepalaTabel kolom={[
              { label: 'Jenis Biaya' }, { label: 'Tanggal' }, { label: 'Nominal', kanan: true },
              { label: 'Catatan' }, { label: 'Bukti' }, { label: 'Action', kanan: true },
            ]} />
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                  <td className="px-3 py-2.5"><Badge tone="brand">{e.expense_type}</Badge></td>
                  <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(e.expense_date)}</td>
                  <td className={cn('tnum px-3 py-2.5 text-right font-semibold text-ink', batal && 'text-ink-3 line-through')}>{formatRupiah(e.amount)}</td>
                  <td className="max-w-72 px-3 py-2.5 text-ink-3">{e.notes || '—'}</td>
                  <td className="px-3 py-2.5"><LampiranThumbs ids={e.attachments ?? []} ukuran={30} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Ubah" icon={<Pencil size={14} />} disabled={!bisaUbah} onClick={() => buka(e)} />
                      <IconButton label="Hapus" tone="danger" icon={<Trash2 size={14} />} disabled={!bisaUbah} onClick={() => setMenghapus(e)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={2}>Total {expenses.length} biaya{batal && ' (arsip)'}</td>
                <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title={editing ? 'Ubah Biaya Operasional' : 'Tambah Biaya Operasional'}
        subtitle={`Trip ${trip.transaction_no}`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setTerbuka(false)}>Batal</Button>
            <Button variant="primary" onClick={simpan}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Jenis Biaya" required>
            {(fid) => (
              <Select id={fid} value={form.expense_type} onChange={(e) => setForm((f) => ({ ...f, expense_type: e.target.value }))}>
                {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </Field>
          <Field
            label="Nominal"
            required
            hint={form.expense_type === 'Tol' && trip.toll > 0 && form.amount !== trip.toll
              ? <>Patokan tol route {formatRupiah(trip.toll)} · <PakaiNilai label="Pakai" onClick={() => setForm((f) => ({ ...f, amount: trip.toll }))} /></>
              : undefined}
          >
            {(fid) => <CurrencyInput id={fid} value={form.amount} onValueChange={(v) => setForm((f) => ({ ...f, amount: v }))} />}
          </Field>
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />}
          </Field>
          <Field label="Catatan">
            {(fid) => <Input id={fid} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />}
          </Field>
          <Field label="Bukti / foto nota">
            {(fid) => <LampiranInput id={fid} value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
          <PesanGalat>{galat}</PesanGalat>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus biaya?"
        message={`${menghapus?.expense_type} senilai ${formatRupiah(menghapus?.amount ?? 0)} akan dihapus beserta buktinya.`}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </div>
  )
}
