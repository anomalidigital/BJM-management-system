import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaPen, FaPercent, FaTrashCan } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, Input, DateInput, Select } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { PilihKaryawan } from '../../components/ui/PilihKaryawan'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { hapusLampiran } from '../../lib/lampiran'
import { formatDate, formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { EMPLOYEE_ROLES, INTERNAL_COST_TYPES, ROLE_LABEL } from '../../types'
import type { EmployeeRole, InternalCost, TransactionRow } from '../../types'
import { KepalaTab, KepalaTabel, KosongTab, PakaiNilai, PesanGalat } from './bagian'

type Form = Pick<InternalCost, 'cost_type' | 'amount' | 'cost_date' | 'notes' | 'recipient_role' | 'recipient_id' | 'recipient_name' | 'attachments'>

const KOSONG_PENERIMA = { recipient_role: '' as const, recipient_id: '', recipient_name: '' }

/**
 * Tab Biaya Internal: pengeluaran perusahaan sendiri atas trip ini. Jenis
 * "Komisi" mencatat penerimanya - manager atau sopir, terdaftar atau manual.
 */
export function TabInternal({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, create, update, remove } = useData()
  const toast = useToast()

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<InternalCost | null>(null)
  const [form, setForm] = useState<Form>({ cost_type: 'Uang Makan', amount: 0, cost_date: '', notes: '', ...KOSONG_PENERIMA, attachments: [] })
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<InternalCost | null>(null)

  // Dibaca dari seluruh data supaya arsip trip batal tetap terlihat.
  const internals = useMemo(
    () => dbAll.internalCosts.filter((c) => c.trip_id === trip.id).sort((a, b) => a.cost_date.localeCompare(b.cost_date)),
    [dbAll.internalCosts, trip.id],
  )
  const total = internals.reduce((a, c) => a + c.amount, 0)
  const drivers = useMemo(() => new Map(dbAll.drivers.map((d) => [d.id, d])), [dbAll.drivers])
  const batal = trip.status === 'batal'

  /* Komisi seharusnya (dari master Komisi) dibanding yang sudah dicatat dibayar. */
  const sopirUtama = drivers.get(trip.driver_ids[0] ?? '')
  const komisiDicatat = internals
    .filter((c) => c.cost_type === 'Komisi' && c.recipient_role === 'sopir' && (!sopirUtama || c.recipient_id === sopirUtama.id))
    .reduce((a, c) => a + c.amount, 0)
  const komisiKurang = Math.max(0, trip.komisi_sopir - komisiDicatat)

  /** Karyawan sesuai peran; sopir trip ini ditaruh paling atas. */
  const karyawanPeran = useMemo(() => {
    const peran = form.recipient_role
    if (!peran) return []
    const daftar = dbAll.drivers.filter((d) => d.role === peran && (d.status === 'aktif' || d.id === form.recipient_id))
    const diTrip = new Set([...trip.driver_ids, trip.manager_id])
    return [...daftar.filter((d) => diTrip.has(d.id)), ...daftar.filter((d) => !diTrip.has(d.id))]
  }, [dbAll.drivers, form.recipient_role, form.recipient_id, trip.driver_ids, trip.manager_id])

  const komisi = form.cost_type === 'Komisi'

  function buka(c?: InternalCost) {
    setEditing(c ?? null)
    setForm(c
      ? {
          cost_type: c.cost_type, amount: c.amount, cost_date: c.cost_date, notes: c.notes,
          recipient_role: c.recipient_role ?? '', recipient_id: c.recipient_id ?? '', recipient_name: c.recipient_name ?? '',
          attachments: c.attachments ?? [],
        }
      : { cost_type: 'Uang Makan', amount: 0, cost_date: trip.transaction_date, notes: '', ...KOSONG_PENERIMA, attachments: [] })
    setGalat(null); setTerbuka(true)
  }

  /** Catat pembayaran komisi sopir utama sebesar kekurangannya. */
  function catatKomisi() {
    setEditing(null)
    setForm({
      cost_type: 'Komisi', amount: komisiKurang, cost_date: trip.transaction_date, notes: trip.komisi_keterangan,
      recipient_role: 'sopir', recipient_id: sopirUtama?.id ?? '', recipient_name: sopirUtama?.driver_name ?? '', attachments: [],
    })
    setGalat(null); setTerbuka(true)
  }

  /** Jenis lama yang sudah tidak ditawarkan tetap tampil saat record itu dibuka. */
  const pilihanJenis = editing && !(INTERNAL_COST_TYPES as readonly string[]).includes(editing.cost_type)
    ? [...INTERNAL_COST_TYPES, editing.cost_type]
    : [...INTERNAL_COST_TYPES]

  /** Ganti jenis ke Komisi -> penerima awal: sopir utama trip ini. */
  function ubahJenis(jenis: string) {
    setForm((f) => {
      if (jenis !== 'Komisi') return { ...f, cost_type: jenis }
      if (f.recipient_role) return { ...f, cost_type: jenis }
      const utama = drivers.get(trip.driver_ids[0] ?? '')
      return { ...f, cost_type: jenis, recipient_role: 'sopir', recipient_id: utama?.id ?? '', recipient_name: utama?.driver_name ?? '' }
    })
  }

  function ubahPeran(peran: EmployeeRole | '') {
    setForm((f) => ({ ...f, recipient_role: peran, recipient_id: '', recipient_name: '' }))
  }

  function simpan() {
    if (form.amount <= 0) { setGalat('Nominal harus lebih dari 0.'); return }
    if (!form.cost_date) { setGalat('Tanggal wajib diisi.'); return }
    if (komisi && !form.recipient_role) { setGalat('Pilih komisi ini untuk manager atau sopir.'); return }
    if (komisi && !form.recipient_id && !form.recipient_name.trim()) { setGalat('Pilih penerima komisi, atau isi namanya.'); return }
    const isi = komisi
      ? { ...form, recipient_name: form.recipient_id ? drivers.get(form.recipient_id)?.driver_name ?? form.recipient_name : form.recipient_name.trim() }
      : { ...form, ...KOSONG_PENERIMA }
    if (editing) { update('internalCosts', editing.id, isi); toast.success('Biaya internal berhasil diperbarui.') }
    else { create('internalCosts', { ...isi, trip_id: trip.id }); toast.success('Biaya internal berhasil ditambahkan.') }
    setTerbuka(false)
  }

  function hapus() {
    if (!menghapus) return
    remove('internalCosts', menghapus.id)
    void hapusLampiran(menghapus.attachments ?? [])
    toast.success('Biaya internal berhasil dihapus.')
    setMenghapus(null)
  }

  function penerima(c: InternalCost) {
    if (c.cost_type !== 'Komisi' || !c.recipient_role) return <span className="text-ink-3">—</span>
    const terdaftar = c.recipient_id ? drivers.get(c.recipient_id) : undefined
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="neutral">{ROLE_LABEL[c.recipient_role]}</Badge>
        {terdaftar
          ? <Link to={`/master/karyawan/${terdaftar.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">{terdaftar.driver_name}</Link>
          : <span className="font-medium text-ink">{c.recipient_name || '—'}</span>}
      </span>
    )
  }

  return (
    <div>
      <KepalaTab
        keterangan={batal
          ? 'Trip dibatalkan: biaya di bawah hanya arsip dan tidak dihitung di laporan.'
          : 'Pengeluaran internal perusahaan atas trip ini — uang makan, kernet, komisi, servis, dan sejenisnya. Uang jalan dicatat di tab Uang Jalan.'}
        tombol="Tambah Biaya Internal"
        bisaUbah={bisaUbah}
        onTambah={() => buka()}
      />
      {!batal && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-brand-50/50 px-4 py-2.5">
          <p className="flex items-start gap-2 text-[12.5px] text-brand-800">
            <FaPercent size={15} className="mt-px shrink-0" />
            <span>
              Komisi sopir menurut aturan: <span className="tnum font-semibold">{formatRupiah(trip.komisi_sopir)}</span>
              {sopirUtama && <> untuk {sopirUtama.driver_name}</>}
              {' · '}sudah dicatat <span className="tnum font-semibold">{formatRupiah(komisiDicatat)}</span>
              <span className="block text-[11.5px] text-brand-700">{trip.komisi_keterangan || 'Belum ada aturan komisi yang cocok.'}</span>
              {trip.driver_ids.length > 1 && (
                <span className="block text-[11.5px] text-brand-700">Sopir tambahan tidak otomatis dapat komisi; bayarkan lewat biaya operasional &ldquo;Double Driver&rdquo; bila ada.</span>
              )}
            </span>
          </p>
          {komisiKurang > 0 && (
            <Button size="sm" disabled={!bisaUbah} onClick={catatKomisi}>Catat pembayaran {formatRupiah(komisiKurang)}</Button>
          )}
        </div>
      )}
      {internals.length === 0 ? (
        <KosongTab
          judul="Belum ada biaya internal."
          keterangan="Trip ini belum mencatat komisi, kernet, atau biaya internal lain."
          tombol="Tambah Biaya Internal"
          bisaUbah={bisaUbah}
          onTambah={() => buka()}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <KepalaTabel kolom={[
              { label: 'Jenis Biaya' }, { label: 'Penerima' }, { label: 'Tanggal' }, { label: 'Nominal', kanan: true },
              { label: 'Catatan' }, { label: 'Bukti' }, { label: 'Action', kanan: true },
            ]} />
            <tbody>
              {internals.map((c) => (
                <tr key={c.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                  <td className="px-3 py-2.5"><Badge tone={c.cost_type === 'Komisi' ? 'brand' : 'neutral'}>{c.cost_type}</Badge></td>
                  <td className="px-3 py-2.5">{penerima(c)}</td>
                  <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(c.cost_date)}</td>
                  <td className={cn('tnum px-3 py-2.5 text-right font-semibold text-ink', batal && 'text-ink-3 line-through')}>{formatRupiah(c.amount)}</td>
                  <td className="max-w-64 px-3 py-2.5 text-ink-3">{c.notes || '—'}</td>
                  <td className="px-3 py-2.5"><LampiranThumbs ids={c.attachments ?? []} ukuran={30} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!bisaUbah} onClick={() => buka(c)} />
                      <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!bisaUbah} onClick={() => setMenghapus(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={3}>Total {internals.length} biaya internal</td>
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
        title={editing ? 'Ubah Biaya Internal' : 'Tambah Biaya Internal'}
        subtitle={`Trip ${trip.transaction_no}`}
        size="md"
        footer={
          <>
            <Button onClick={() => setTerbuka(false)}>Batal</Button>
            <Button variant="primary" onClick={simpan}>Simpan</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jenis Biaya" required className="sm:col-span-2">
            {(fid) => (
              <Select id={fid} value={form.cost_type} onChange={(e) => ubahJenis(e.target.value)}>
                {pilihanJenis.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </Field>

          {komisi && (
            <div className="grid gap-4 rounded-lg border border-hairline bg-sunken p-3.5 sm:col-span-2 sm:grid-cols-2">
              <Field label="Komisi untuk" required>
                {(fid) => (
                  <Select id={fid} value={form.recipient_role} onChange={(e) => ubahPeran(e.target.value as EmployeeRole | '')}>
                    <option value="">— pilih peran —</option>
                    {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Atas nama" required hint={form.recipient_role ? 'Terdaftar di Data Karyawan, atau isi nama sendiri.' : 'Pilih peran lebih dulu.'}>
                {(fid) => form.recipient_role ? (
                  <PilihKaryawan
                    key={form.recipient_role}
                    id={fid}
                    karyawan={karyawanPeran}
                    valueId={form.recipient_id}
                    valueNama={form.recipient_name}
                    peran={form.recipient_role}
                    placeholder={`Pilih ${ROLE_LABEL[form.recipient_role].toLowerCase()}...`}
                    onChange={(rid, nama) => setForm((f) => ({ ...f, recipient_id: rid, recipient_name: nama }))}
                  />
                ) : (
                  <Input id={fid} disabled placeholder="—" />
                )}
              </Field>
            </div>
          )}

          <Field
            label="Nominal"
            required
            hint={komisi && form.recipient_role === 'sopir' && trip.komisi_sopir > 0 && form.amount !== trip.komisi_sopir
              ? <>Komisi menurut aturan {formatRupiah(trip.komisi_sopir)} · <PakaiNilai label="Pakai" onClick={() => setForm((f) => ({ ...f, amount: trip.komisi_sopir }))} /></>
              : undefined}
          >
            {(fid) => <CurrencyInput id={fid} value={form.amount} onValueChange={(v) => setForm((f) => ({ ...f, amount: v }))} />}
          </Field>
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={form.cost_date} onChange={(e) => setForm((f) => ({ ...f, cost_date: e.target.value }))} />}
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            {(fid) => <Input id={fid} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />}
          </Field>
          <Field label="Bukti / foto" className="sm:col-span-2">
            {(fid) => <LampiranInput id={fid} value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
          <div className="sm:col-span-2"><PesanGalat>{galat}</PesanGalat></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus biaya internal?"
        message={`${menghapus?.cost_type}${menghapus?.recipient_name ? ` untuk ${menghapus.recipient_name}` : ''} senilai ${formatRupiah(menghapus?.amount ?? 0)} akan dihapus beserta buktinya.`}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </div>
  )
}
