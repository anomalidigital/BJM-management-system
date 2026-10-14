import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaPen, FaTrashCan } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, Input, DateInput, Select } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { PilihKaryawan } from '../../components/ui/PilihKaryawan'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
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
 * Tab Komisi (dulu Biaya Internal, diganti atasan 13 Okt 2026): pembayaran komisi (biaya internal jenis
 * "Komisi"), uang makan, kernet, servis, dan sejenisnya. Kotak hitungan komisi supir & manager dari Aturan
 * Komisi dihapus dulu (Baldy 14 Okt 2026); hasil hitungnya tetap dipakai sebagai acuan nominal di form.
 */
export function TabInternal({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, create, update, remove } = useData()
  const { bisa } = useAuth()
  const toast = useToast()

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<InternalCost | null>(null)
  const [form, setForm] = useState<Form>({ cost_type: 'Uang Makan', amount: 0, cost_date: '', notes: '', ...KOSONG_PENERIMA, attachments: [] })
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<InternalCost | null>(null)

  const batal = trip.status === 'batal'
  /** Catat biaya internal & pembayaran komisi: Manager & Owner. */
  const bisaCatat = bisaUbah && bisa('biaya') && !batal

  // Dibaca dari seluruh data supaya arsip trip batal tetap terlihat.
  const internals = useMemo(
    () => dbAll.internalCosts.filter((c) => c.trip_id === trip.id).sort((a, b) => a.cost_date.localeCompare(b.cost_date)),
    [dbAll.internalCosts, trip.id],
  )
  const total = internals.reduce((a, c) => a + c.amount, 0)
  const drivers = useMemo(() => new Map(dbAll.drivers.map((d) => [d.id, d])), [dbAll.drivers])

  const sopirUtama = drivers.get(trip.driver_ids[0] ?? '')

  /** Karyawan sesuai peran; orang di trip ini ditaruh paling atas. */
  const karyawanPeran = useMemo(() => {
    const peran = form.recipient_role
    if (!peran) return []
    const daftar = dbAll.drivers.filter((d) => d.role === peran && (d.status === 'aktif' || d.id === form.recipient_id))
    const diTrip = new Set([...trip.driver_ids, trip.manager_id])
    return [...daftar.filter((d) => diTrip.has(d.id)), ...daftar.filter((d) => !diTrip.has(d.id))]
  }, [dbAll.drivers, form.recipient_role, form.recipient_id, trip.driver_ids, trip.manager_id])

  const jenisKomisi = form.cost_type === 'Komisi'
  /** Komisi menurut aturan untuk peran yang dipilih di form. */
  const acuanKomisi = form.recipient_role === 'sopir' ? trip.komisi_sopir : form.recipient_role === 'manager' ? trip.komisi_manager : 0

  /** Orang di trip ini untuk satu peran: supir utama, atau manager trip. */
  function orangTrip(peran: EmployeeRole | ''): { recipient_id: string; recipient_name: string } {
    if (peran === 'sopir') return { recipient_id: sopirUtama?.id ?? '', recipient_name: sopirUtama?.driver_name ?? '' }
    if (peran === 'manager') return { recipient_id: trip.manager_id, recipient_name: trip.manager_label }
    return { recipient_id: '', recipient_name: '' }
  }

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

  /** Jenis lama yang sudah tidak ditawarkan tetap tampil saat record itu dibuka. */
  const pilihanJenis = editing && !(INTERNAL_COST_TYPES as readonly string[]).includes(editing.cost_type)
    ? [...INTERNAL_COST_TYPES, editing.cost_type]
    : [...INTERNAL_COST_TYPES]

  /** Ganti jenis ke Komisi -> penerima awal: supir utama trip ini. */
  function ubahJenis(jenis: string) {
    setForm((f) => {
      if (jenis !== 'Komisi' || f.recipient_role) return { ...f, cost_type: jenis }
      return { ...f, cost_type: jenis, recipient_role: 'sopir', ...orangTrip('sopir') }
    })
  }

  /** Ganti peran -> penerima awal: orang trip ini untuk peran itu (tetap bisa diganti). */
  function ubahPeran(peran: EmployeeRole | '') {
    setForm((f) => ({ ...f, recipient_role: peran, ...orangTrip(peran) }))
  }

  function simpan() {
    if (form.amount <= 0) { setGalat('Nominal harus lebih dari 0.'); return }
    if (!form.cost_date) { setGalat('Tanggal wajib diisi.'); return }
    if (jenisKomisi && !form.recipient_role) { setGalat('Pilih komisi ini untuk manager atau supir.'); return }
    if (jenisKomisi && !form.recipient_id && !form.recipient_name.trim()) { setGalat('Pilih penerima komisi, atau isi namanya.'); return }
    const isi = jenisKomisi
      ? { ...form, recipient_name: form.recipient_id ? drivers.get(form.recipient_id)?.driver_name ?? form.recipient_name : form.recipient_name.trim() }
      : { ...form, ...KOSONG_PENERIMA }
    if (editing) { update('internalCosts', editing.id, isi); toast.success('Biaya internal berhasil diperbarui.') }
    else { create('internalCosts', { ...isi, trip_id: trip.id }); toast.success(jenisKomisi ? 'Pembayaran komisi berhasil dicatat.' : 'Biaya internal berhasil ditambahkan.') }
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
      {/*
        Kotak hitungan komisi supir & manager dihapus dulu (Baldy 14 Okt 2026: "ga pasti juga kalau yang dapet
        komisi mereka doang"). Pembayaran komisi tetap dicatat di tabel ini dengan jenis Komisi.
      */}
      <KepalaTab
        judul="Biaya internal"
        keterangan={batal
          ? 'Trip dibatalkan: biaya di bawah hanya arsip yang tidak dihitung di laporan.'
          : 'Pembayaran komisi, uang makan, kernet, servis, dan sejenisnya.'}
        tombol="Tambah Biaya Internal"
        bisaUbah={bisaCatat}
        onTambah={() => buka()}
      />
      {internals.length === 0 ? (
        <KosongTab
          judul="Belum ada biaya internal."
          keterangan="Trip ini belum mencatat komisi, kernet, atau biaya internal lain."
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
                      <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!bisaCatat} onClick={() => buka(c)} />
                      <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!bisaCatat} onClick={() => setMenghapus(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={3}>Total {internals.length} biaya internal{batal && ' (arsip)'}</td>
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
        title={editing ? 'Ubah Biaya Internal' : jenisKomisi ? 'Catat Pembayaran Komisi' : 'Tambah Biaya Internal'}
        subtitle={`Trip ${trip.id_tampil}`}
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

          {jenisKomisi && (
            <div className="grid gap-4 rounded-lg border border-hairline bg-sunken p-3.5 sm:col-span-2 sm:grid-cols-2">
              <Field label="Komisi untuk" required>
                {(fid) => (
                  <Select id={fid} value={form.recipient_role} onChange={(e) => ubahPeran(e.target.value as EmployeeRole | '')}>
                    <option value="">— pilih peran —</option>
                    {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Atas nama" required hint={form.recipient_role ? 'Terdaftar di Supir / Karyawan, atau isi nama sendiri.' : 'Pilih peran lebih dulu.'}>
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
            hint={jenisKomisi && acuanKomisi > 0 && form.amount !== acuanKomisi
              ? <>Komisi menurut aturan {formatRupiah(acuanKomisi)} · <PakaiNilai label="Pakai" onClick={() => setForm((f) => ({ ...f, amount: acuanKomisi }))} /></>
              : jenisKomisi && acuanKomisi > 0 ? 'Sesuai hasil hitung Aturan Komisi.' : undefined}
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
