import { useMemo, useState } from 'react'
import { FaPen, FaTrashCan } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Checkbox, Field, Input, DateInput, Radio, Select } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { hapusLampiran } from '../../lib/lampiran'
import { formatDate, formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { biayaDitagihkan, dibayarPerusahaan } from '../../lib/trip'
import { BIAYA_DITAGIHKAN, EXPENSE_TYPES, PEMBAYAR_LABEL } from '../../types'
import type { OperationalExpense, PembayarBiaya, TransactionRow } from '../../types'
import { KepalaTab, KepalaTabel, KosongTab, PakaiNilai, PesanGalat } from './bagian'

type Form = Pick<OperationalExpense, 'expense_type' | 'amount' | 'expense_date' | 'notes' | 'attachments'> & { ditagihkan: boolean; dibayar: PembayarBiaya }

/** Petunjuk jenis biaya yang sering tertukar. */
const PETUNJUK_JENIS: Record<string, string> = {
  DEX: 'Solar (Pertamina Dex / Dexlite). Ditagihkan ke klien.',
  Nginap: 'Overnight: ditagihkan ke klien sebagai Additional Cost.',
  ASDP: 'Penyeberangan kapal ferry (PT ASDP).',
  SPSI: 'Ongkos buruh bongkar / muat serikat pekerja setempat.',
  Reimbus: 'Penggantian ke sopir untuk biaya yang ditalangi di luar uang jalan. Tidak ditagihkan.',
  'Double Driver': 'Uang sopir kedua. Tidak ditagihkan.',
}

/**
 * Tab Biaya Operasional: biaya di jalan (DEX, tol, nginap, ...) beserta notanya.
 * Dibayar sopir dari uang jalan (tidak menambah biaya perusahaan) atau dibayar perusahaan
 * langsung (biaya di luar uang jalan). Tidak pernah memotong transfer ke sopir; yang
 * ditagihkan ke klien masuk PI.
 */
export function TabBiaya({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, create, update, remove } = useData()
  const toast = useToast()

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<OperationalExpense | null>(null)
  const [form, setForm] = useState<Form>({ expense_type: 'DEX', amount: 0, expense_date: '', notes: '', attachments: [], ditagihkan: true, dibayar: 'sopir' })
  /** Karawang menagihkan biaya di luar tanggungan ke klien lewat PI. */
  const karawang = trip.workspace === 'karawang'
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<OperationalExpense | null>(null)

  const expenses = useMemo(
    // Dibaca dari seluruh data supaya arsip trip batal tetap terlihat.
    () => dbAll.expenses.filter((e) => e.trip_id === trip.id).sort((a, b) => a.expense_date.localeCompare(b.expense_date)),
    [dbAll.expenses, trip.id],
  )
  const total = expenses.reduce((a, e) => a + e.amount, 0)
  const dariUj = expenses.filter((e) => !dibayarPerusahaan(e)).reduce((a, e) => a + e.amount, 0)
  const olehPerusahaan = total - dariUj
  const batal = trip.status === 'batal'

  function buka(e?: OperationalExpense) {
    setEditing(e ?? null)
    setForm(e
      ? { expense_type: e.expense_type, amount: e.amount, expense_date: e.expense_date, notes: e.notes, attachments: e.attachments ?? [], ditagihkan: biayaDitagihkan(e), dibayar: e.dibayar ?? 'sopir' }
      : { expense_type: 'DEX', amount: 0, expense_date: trip.transaction_date, notes: '', attachments: [], ditagihkan: true, dibayar: 'sopir' })
    setGalat(null); setTerbuka(true)
  }

  function simpan() {
    if (form.amount <= 0) { setGalat('Nominal harus lebih dari 0.'); return }
    if (!form.expense_date) { setGalat('Tanggal wajib diisi.'); return }
    // Ikut jenisnya disimpan kosong, supaya mengikuti aturan jenis biaya bila nanti diubah.
    const { ditagihkan, dibayar, ...isi } = form
    const simpanTagih = {
      ditagihkan: karawang && ditagihkan !== BIAYA_DITAGIHKAN.includes(form.expense_type) ? ditagihkan : undefined,
      dibayar: dibayar === 'perusahaan' ? dibayar : undefined,
    }
    if (editing) { update('expenses', editing.id, { ...isi, ...simpanTagih }); toast.success('Biaya berhasil diperbarui.') }
    else { create('expenses', { ...isi, ...simpanTagih, trip_id: trip.id }); toast.success('Biaya berhasil ditambahkan.') }
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
          : karawang
            ? <>Dari uang jalan {formatRupiah(trip.uj_total)} terpakai <span className="tnum font-semibold text-ink-2">{formatRupiah(dariUj)}</span>{olehPerusahaan > 0 && <>; dibayar perusahaan langsung <span className="tnum font-semibold text-ink-2">{formatRupiah(olehPerusahaan)}</span></>}. Tidak memotong transfer ke sopir. DEX, Tol, ASDP, SPSI, Nginap, dan Escort ditagihkan ke klien di PI; uang dorong & uang pulang dicatat di tab Uang Jalan.</>
            : 'Tambahkan hanya biaya yang benar-benar terjadi. Tol yang dibayar dicatat di sini dengan jenis Tol; Uang Tol di route hanya patokan.'}
        tombol="Tambah Biaya"
        bisaUbah={bisaUbah}
        onTambah={() => buka()}
      />
      {expenses.length === 0 ? (
        <KosongTab
          judul="Belum ada biaya operasional."
          keterangan="Trip ini belum mencatat DEX, tol, nginap, atau biaya lain."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <KepalaTabel kolom={[
              { label: 'Jenis Biaya' }, { label: 'Tanggal' }, { label: 'Nominal', kanan: true }, { label: 'Dibayar' },
              ...(karawang ? [{ label: 'Ditagihkan' }] : []),
              { label: 'Catatan' }, { label: 'Bukti' }, { label: 'Action', kanan: true },
            ]} />
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                  <td className="px-3 py-2.5"><Badge tone="brand">{e.expense_type}</Badge></td>
                  <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(e.expense_date)}</td>
                  <td className={cn('tnum px-3 py-2.5 text-right font-semibold text-ink', batal && 'text-ink-3 line-through')}>{formatRupiah(e.amount)}</td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink-2">{dibayarPerusahaan(e) ? <Badge tone="warning">Perusahaan</Badge> : 'Sopir, dari UJ'}</td>
                  {karawang && <td className="px-3 py-2.5">{biayaDitagihkan(e) ? <Badge tone="good">Ke klien</Badge> : <span className="text-ink-3">—</span>}</td>}
                  <td className="max-w-72 px-3 py-2.5 text-ink-3">{e.notes || '—'}</td>
                  <td className="px-3 py-2.5"><LampiranThumbs ids={e.attachments ?? []} ukuran={30} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!bisaUbah} onClick={() => buka(e)} />
                      <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!bisaUbah} onClick={() => setMenghapus(e)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={2}>Total {expenses.length} biaya{batal && ' (arsip)'}</td>
                <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(total)}</td>
                <td className="tnum px-3 py-2.5 text-[12px] text-ink-2">{olehPerusahaan > 0 ? `${formatRupiah(olehPerusahaan)} perusahaan` : ''}</td>
                {karawang && <td className="tnum px-3 py-2.5 text-[12px] text-ink-2">{formatRupiah(expenses.filter(biayaDitagihkan).reduce((a, e) => a + e.amount, 0))} ke klien</td>}
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
          <Field label="Jenis Biaya" required hint={PETUNJUK_JENIS[form.expense_type]}>
            {(fid) => (
              <Select id={fid} value={form.expense_type}
                onChange={(e) => { const jenis = e.target.value; setForm((f) => ({ ...f, expense_type: jenis, ditagihkan: BIAYA_DITAGIHKAN.includes(jenis) })) }}>
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
          <div>
            <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-2">Dibayar oleh</p>
            <div className="grid gap-2">
              <Radio name="dibayar" checked={form.dibayar === 'sopir'} onChange={() => setForm((f) => ({ ...f, dibayar: 'sopir' }))}
                label={PEMBAYAR_LABEL.sopir} description="Sudah termasuk uang jalan; tidak menambah biaya dan tidak memotong transfer." />
              <Radio name="dibayar" checked={form.dibayar === 'perusahaan'} onChange={() => setForm((f) => ({ ...f, dibayar: 'perusahaan' }))}
                label={PEMBAYAR_LABEL.perusahaan} description="Voucher solar, kartu e-toll, atau transfer perusahaan: biaya di luar uang jalan." />
            </div>
          </div>
          {karawang && (
            <Checkbox checked={form.ditagihkan} onChange={(e) => setForm((f) => ({ ...f, ditagihkan: e.target.checked }))}
              label="Ditagihkan ke klien (Additional Cost di PI)" />
          )}
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
