import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FaArrowRight, FaLock, FaPen, FaTrashCan } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Checkbox, Field, Input, DateInput, Radio, Select } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useAuth } from '../../store/AuthProvider'
import { useToast } from '../../store/ToastProvider'
import { hapusLampiran } from '../../lib/lampiran'
import { formatDate, formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { biayaDitagihkan, dibayarPerusahaan } from '../../lib/trip'
import { BIAYA_DITAGIHKAN, EXPENSE_TYPES, PEMBAYAR_LABEL, labelBiaya } from '../../types'
import type { OperationalExpense, PembayarBiaya, TransactionRow } from '../../types'
import { KepalaTab, KepalaTabel, KosongTab, KotakInfo, PakaiNilai, PesanGalat } from './bagian'

type Form = Pick<OperationalExpense, 'expense_type' | 'amount' | 'expense_date' | 'notes' | 'attachments'> & { ditagihkan: boolean; dibayar: PembayarBiaya }

/**
 * Pilihan semu "Uang Dorong" di daftar jenis. Uang dorong bukan nota biaya: dicatat
 * sebagai termin Uang Jalan supaya transfer & potong kasbon supir benar.
 */
const UANG_DORONG = '__uang_dorong__'

/** Bawaan "Ditagihkan ke klien" sebuah jenis biaya. */
const tagihBawaan = (jenis: string) => BIAYA_DITAGIHKAN.includes(jenis)

/** Jenis yang ditagihkan ke klien, urut seperti daftar jenis: "Tol, DEX, ..., dan ASDP". */
const JENIS_DITAGIHKAN = (() => {
  const nama = EXPENSE_TYPES.filter(tagihBawaan).map(labelBiaya)
  return nama.length > 1 ? `${nama.slice(0, -1).join(', ')}, dan ${nama.at(-1)}` : nama.join('')
})()

/** Petunjuk jenis biaya yang sering tertukar (nama tampil lewat labelBiaya). */
const PETUNJUK_JENIS: Record<string, string> = {
  Tol: 'Tol yang benar-benar dibayar; Uang Tol di rute hanya patokan.',
  DEX: 'Solar (Pertamina Dex / Dexlite).',
  SPSI: 'SPSI Banlok: ongkos buruh bongkar / muat serikat pekerja setempat.',
  Nginap: 'Overnight: biaya supir menginap di jalan.',
  Escort: 'Pengawalan kendaraan di jalan.',
  ASDP: 'Penyeberangan kapal ferry (PT ASDP).',
  'Double Driver': 'Uang supir kedua (pendamping).',
  Reimbus: 'Penggantian ke supir untuk biaya yang ditalangi di luar uang jalan.',
}

/**
 * Tab Biaya Operasional: nota biaya di jalan (tol, solar, SPSI Banlok, overnight, ...).
 * Dibayar supir dari uang jalan (tidak menambah biaya perusahaan) atau dibayar perusahaan
 * langsung (biaya di luar uang jalan). Tidak pernah memotong transfer ke supir; yang
 * ditagihkan ke klien masuk PI.
 *
 * Izin dihitung di sini, bukan dari prop `bisaUbah`: Admin boleh mencatat & mengubah nota
 * (bisa('nota')); menghapus nota dan mengubah "Ditagihkan ke klien" / "Dibayar oleh" dari
 * bawaannya hanya Manager / Owner (bisa('biaya')).
 *
 * Karawang: uang dorong tetap termin Uang Jalan. Pilihan semu "Uang Dorong" mengarahkan ke
 * tab Uang Jalan, dan terminnya tampil di sini baca-saja (tidak dijumlah, tidak ditagihkan).
 */
export function TabBiaya({ trip }: {
  trip: TransactionRow
  /** Tidak dipakai lagi: izin nota & biaya dihitung di dalam tab ini. */
  bisaUbah?: boolean
}) {
  const { dbAll, create, update, remove } = useData()
  const { bisa } = useAuth()
  const toast = useToast()
  const [, setSearchParams] = useSearchParams()

  /** Karawang menagihkan biaya di luar tanggungan ke klien lewat PI. */
  const karawang = trip.workspace === 'karawang'
  const batal = trip.status === 'batal'
  /** Catat & ubah nota (Admin boleh). */
  const bisaNota = bisa('nota') && !batal
  /** Hapus nota & ubah status ditagihkan / dibayar oleh (Manager & Owner). */
  const bisaAtur = bisa('biaya') && !batal

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<OperationalExpense | null>(null)
  const [form, setForm] = useState<Form>({ expense_type: EXPENSE_TYPES[0], amount: 0, expense_date: '', notes: '', attachments: [], ditagihkan: true, dibayar: 'sopir' })
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<OperationalExpense | null>(null)

  const expenses = useMemo(
    // Dibaca dari seluruh data supaya arsip trip batal tetap terlihat.
    () => dbAll.expenses.filter((e) => e.trip_id === trip.id).sort((a, b) => a.expense_date.localeCompare(b.expense_date)),
    [dbAll.expenses, trip.id],
  )
  /** Termin uang dorong trip Karawang: tampil baca-saja, tidak dijumlah dan tidak ditagihkan. */
  const dorong = useMemo(
    () => (karawang ? dbAll.ujPayments : [])
      .filter((p) => p.trip_id === trip.id && p.jenis === 'uang_dorong')
      .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.sequence - b.sequence),
    [karawang, dbAll.ujPayments, trip.id],
  )
  const totalDorong = dorong.reduce((a, p) => a + p.uj_amount, 0)
  const total = expenses.reduce((a, e) => a + e.amount, 0)
  const dariUj = expenses.filter((e) => !dibayarPerusahaan(e)).reduce((a, e) => a + e.amount, 0)
  const olehPerusahaan = total - dariUj
  const keKlien = expenses.filter(biayaDitagihkan).reduce((a, e) => a + e.amount, 0)

  const jenisDorong = form.expense_type === UANG_DORONG
  /** Jenis lama yang sudah tidak ditawarkan tetap tampil saat nota itu dibuka. */
  const pilihanJenis: string[] = editing && !(EXPENSE_TYPES as readonly string[]).includes(editing.expense_type)
    ? [...EXPENSE_TYPES, editing.expense_type]
    : [...EXPENSE_TYPES]

  /**
   * Nilai yang akan disimpan. Manager / Owner memakai isian form; Admin tidak bisa
   * mengubahnya: nilai nota lama dipertahankan, atau bawaan jenis bila jenisnya diganti.
   */
  const tagihDipakai = bisaAtur
    ? form.ditagihkan
    : editing && editing.expense_type === form.expense_type ? biayaDitagihkan(editing) : tagihBawaan(form.expense_type)
  const bayarDipakai: PembayarBiaya = bisaAtur ? form.dibayar : editing?.dibayar ?? 'sopir'
  /** Nilainya sudah diubah dari bawaan jenis biaya (oleh Manager / Owner, atau data lama). */
  const bukanBawaan = (karawang && tagihDipakai !== tagihBawaan(form.expense_type)) || bayarDipakai !== 'sopir'

  const petunjuk = jenisDorong
    ? undefined
    : [PETUNJUK_JENIS[form.expense_type], karawang ? (tagihBawaan(form.expense_type) ? 'Bawaan: ditagihkan ke klien.' : 'Bawaan: tidak ditagihkan ke klien.') : '']
        .filter(Boolean).join(' ') || undefined

  function buka(e?: OperationalExpense) {
    setEditing(e ?? null)
    const jenisAwal = EXPENSE_TYPES[0]
    setForm(e
      ? { expense_type: e.expense_type, amount: e.amount, expense_date: e.expense_date, notes: e.notes, attachments: e.attachments ?? [], ditagihkan: biayaDitagihkan(e), dibayar: e.dibayar ?? 'sopir' }
      : { expense_type: jenisAwal, amount: 0, expense_date: trip.transaction_date, notes: '', attachments: [], ditagihkan: tagihBawaan(jenisAwal), dibayar: 'sopir' })
    setGalat(null); setTerbuka(true)
  }

  function ubahJenis(jenis: string) {
    // Status tagih ikut bawaan jenis baru; Manager / Owner tetap bisa mengubahnya sesudahnya.
    setForm((f) => ({ ...f, expense_type: jenis, ditagihkan: jenis === UANG_DORONG ? f.ditagihkan : tagihBawaan(jenis) }))
    setGalat(null)
  }

  function simpan() {
    if (jenisDorong) return
    if (form.amount <= 0) { setGalat('Nominal harus lebih dari 0.'); return }
    if (!form.expense_date) { setGalat('Tanggal wajib diisi.'); return }
    const isi = {
      expense_type: form.expense_type, amount: form.amount, expense_date: form.expense_date, notes: form.notes, attachments: form.attachments,
      // Disimpan hanya bila berbeda dari bawaan, supaya tetap mengikuti aturan jenis biaya bila nanti diubah.
      ditagihkan: karawang && tagihDipakai !== tagihBawaan(form.expense_type) ? tagihDipakai : undefined,
      dibayar: bayarDipakai === 'perusahaan' ? bayarDipakai : undefined,
    }
    if (editing) { update('expenses', editing.id, isi); toast.success('Biaya berhasil diperbarui.') }
    else { create('expenses', { ...isi, trip_id: trip.id }); toast.success('Biaya berhasil ditambahkan.') }
    setTerbuka(false)
  }

  function hapus() {
    if (!menghapus || !bisaAtur) return
    remove('expenses', menghapus.id)
    void hapusLampiran(menghapus.attachments ?? [])
    toast.success('Biaya berhasil dihapus.')
    setMenghapus(null)
  }

  /** Pilihan "Uang Dorong": pindah ke tab Uang Jalan dengan form termin uang dorong terbuka. */
  function keUangJalan() {
    setTerbuka(false)
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'uj'); n.set('tambah', 'uang_dorong'); return n })
  }

  const kolom = [
    { label: 'Jenis Biaya' }, { label: 'Tanggal' }, { label: 'Nominal', kanan: true }, { label: 'Dibayar' },
    ...(karawang ? [{ label: 'Ditagihkan' }] : []),
    { label: 'Catatan' }, { label: 'Bukti' }, { label: 'Action', kanan: true },
  ]

  return (
    <div>
      <KepalaTab
        keterangan={batal
          ? 'Trip dibatalkan: biaya di bawah hanya arsip dan tidak dihitung di laporan.'
          : karawang
            ? <>
                Dari uang jalan {formatRupiah(trip.uj_total)} terpakai <span className="tnum font-semibold text-ink-2">{formatRupiah(dariUj)}</span>
                {olehPerusahaan > 0 && <>; dibayar perusahaan langsung <span className="tnum font-semibold text-ink-2">{formatRupiah(olehPerusahaan)}</span></>}.
                {' '}Tidak memotong transfer ke supir. {JENIS_DITAGIHKAN} ditagihkan ke klien di PI; uang dorong & uang pulang dicatat di tab Uang Jalan.
                {bisaNota && !bisaAtur && ' Hapus nota dan status ditagihkan / dibayar oleh diatur Manager / Owner.'}
              </>
            : 'Tambahkan hanya biaya yang benar-benar terjadi. Tol yang dibayar dicatat di sini dengan jenis Tol; Uang Tol di rute hanya patokan.'}
        tombol="Tambah Biaya"
        bisaUbah={bisaNota}
        onTambah={() => buka()}
      />
      {expenses.length === 0 && dorong.length === 0 ? (
        <KosongTab
          judul="Belum ada biaya operasional."
          keterangan="Trip ini belum mencatat tol, solar, overnight, atau biaya lain."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <KepalaTabel kolom={kolom} />
            <tbody>
              {expenses.length === 0 && (
                <tr className="border-b border-grid">
                  <td colSpan={kolom.length} className="px-3 py-5 text-center text-ink-3">Belum ada nota biaya operasional.</td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-grid last:border-0 hover:bg-sunken">
                  <td className="px-3 py-2.5"><Badge tone="brand">{labelBiaya(e.expense_type)}</Badge></td>
                  <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(e.expense_date)}</td>
                  <td className={cn('tnum px-3 py-2.5 text-right font-semibold text-ink', batal && 'text-ink-3 line-through')}>{formatRupiah(e.amount)}</td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink-2">{dibayarPerusahaan(e) ? <Badge tone="warning">Perusahaan</Badge> : 'Supir, dari UJ'}</td>
                  {karawang && <td className="px-3 py-2.5">{biayaDitagihkan(e) ? <Badge tone="good">Ke klien</Badge> : <span className="text-ink-3">—</span>}</td>}
                  <td className="max-w-72 px-3 py-2.5 text-ink-3">{e.notes || '—'}</td>
                  <td className="px-3 py-2.5"><LampiranThumbs ids={e.attachments ?? []} ukuran={30} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!bisaNota} onClick={() => buka(e)} />
                      <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!bisaAtur} onClick={() => setMenghapus(e)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total nota; baris uang dorong sengaja di bawahnya karena tidak ikut dijumlah. */}
            <tbody className="border-t-2 border-hairline bg-sunken font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={2}>Total {expenses.length} biaya{batal && ' (arsip)'}</td>
                <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(total)}</td>
                <td className="tnum px-3 py-2.5 text-[12px] text-ink-2">{olehPerusahaan > 0 ? `${formatRupiah(olehPerusahaan)} perusahaan` : ''}</td>
                {karawang && <td className="tnum px-3 py-2.5 text-[12px] text-ink-2">{formatRupiah(keKlien)} ke klien</td>}
                <td colSpan={3} />
              </tr>
            </tbody>
            {dorong.length > 0 && (
              <tbody>
                <tr className="border-t border-hairline">
                  <td colSpan={kolom.length} className="px-3 pt-4 pb-1.5 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">
                    Dari Uang Jalan · tidak ikut total, tidak ditagihkan
                  </td>
                </tr>
                {dorong.map((p) => (
                  <tr key={p.id} className="border-b border-grid text-ink-3 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap items-center gap-1">
                        <Badge tone="neutral">Uang Dorong</Badge>
                        <Badge tone="brand">dari Uang Jalan</Badge>
                      </span>
                    </td>
                    <td className="tnum px-3 py-2.5">{formatDate(p.payment_date)}</td>
                    <td className={cn('tnum px-3 py-2.5 text-right', batal && 'line-through')}>{formatRupiah(p.uj_amount)}</td>
                    <td className="px-3 py-2.5 text-[12.5px]">Termin {p.sequence} uang jalan</td>
                    {karawang && <td className="px-3 py-2.5">—</td>}
                    <td className="max-w-72 px-3 py-2.5">{p.notes || '—'}</td>
                    <td className="px-3 py-2.5"><LampiranThumbs ids={p.attachments ?? []} ukuran={30} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end">
                        <IconButton label="Buka di tab Uang Jalan" icon={<FaArrowRight size={14} />} onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'uj'); n.delete('tambah'); return n })} />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={kolom.length} className="px-3 pt-1 pb-3 text-[12px] text-ink-3">
                    Uang dorong {formatRupiah(totalDorong)} sudah tercatat sebagai termin Uang Jalan; ubah atau hapus di tab itu.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      )}

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title={editing ? 'Ubah Biaya Operasional' : 'Tambah Biaya Operasional'}
        subtitle={`Trip ${trip.id_tampil}`}
        size="md"
        footer={
          <>
            <Button onClick={() => setTerbuka(false)}>Batal</Button>
            {jenisDorong
              ? <Button variant="primary" icon={<FaArrowRight size={14} />} disabled={!bisa('trip')} onClick={keUangJalan}>Catat di tab Uang Jalan</Button>
              : <Button variant="primary" onClick={simpan}>Simpan</Button>}
          </>
        }
      >
        {/* Ringkas tanpa scroll (Baldy 14 Okt 2026): dua kolom. */}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Jenis Biaya" required hint={petunjuk} className="sm:col-span-2">
            {(fid) => (
              <Select id={fid} value={form.expense_type} onChange={(e) => ubahJenis(e.target.value)}>
                {pilihanJenis.map((t) => <option key={t} value={t}>{labelBiaya(t)}</option>)}
                {!editing && karawang && (
                  <optgroup label="Dicatat di tab Uang Jalan">
                    <option value={UANG_DORONG}>Uang Dorong</option>
                  </optgroup>
                )}
              </Select>
            )}
          </Field>

          {jenisDorong ? (
            <KotakInfo className="sm:col-span-2">Uang dorong dicatat sebagai termin Uang Jalan supaya transfer & potong kasbon supir benar.</KotakInfo>
          ) : (
            <>
              <Field
                label="Nominal"
                required
                hint={form.expense_type === 'Tol' && trip.toll > 0 && form.amount !== trip.toll
                  ? <>Patokan tol rute {formatRupiah(trip.toll)} · <PakaiNilai label="Pakai" onClick={() => setForm((f) => ({ ...f, amount: trip.toll }))} /></>
                  : undefined}
              >
                {(fid) => <CurrencyInput id={fid} value={form.amount} onValueChange={(v) => setForm((f) => ({ ...f, amount: v }))} />}
              </Field>
              <Field label="Tanggal" required>
                {(fid) => <DateInput id={fid} value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />}
              </Field>
              <Field label="Catatan" className="sm:col-span-2">
                {(fid) => <Input id={fid} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />}
              </Field>

              {bisaAtur ? (
                <div className="sm:col-span-2">
                  <p className="form-label">Dibayar oleh</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Radio name="dibayar" checked={form.dibayar === 'sopir'} onChange={() => setForm((f) => ({ ...f, dibayar: 'sopir' }))}
                      label={PEMBAYAR_LABEL.sopir} description="Sudah termasuk uang jalan; tidak menambah biaya dan tidak memotong transfer." />
                    <Radio name="dibayar" checked={form.dibayar === 'perusahaan'} onChange={() => setForm((f) => ({ ...f, dibayar: 'perusahaan' }))}
                      label={PEMBAYAR_LABEL.perusahaan} description="Voucher solar, kartu e-toll, atau transfer perusahaan: biaya di luar uang jalan." />
                  </div>
                </div>
              ) : (
                // Admin: tampil baca-saja. Nilai lama (atau bawaan jenis) disimpan apa adanya.
                <div className="rounded-lg border border-hairline bg-sunken px-3.5 py-3 sm:col-span-2">
                  <dl className="grid gap-1.5 text-[12.5px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <dt className="text-ink-3">Dibayar oleh</dt>
                      <dd className="font-medium text-ink">{PEMBAYAR_LABEL[bayarDipakai]}</dd>
                    </div>
                    {karawang && (
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <dt className="text-ink-3">Ditagihkan ke klien</dt>
                        <dd className="font-medium text-ink">{tagihDipakai ? 'Ya, Additional Cost di PI' : 'Tidak'}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-3">
                    <FaLock size={12} className="mt-[3px] shrink-0" />
                    <span>{bukanBawaan ? 'Sudah diubah dari bawaan jenis biaya; ubah oleh Manager / Owner.' : 'Bawaan jenis biaya; ubah oleh Manager / Owner.'}</span>
                  </p>
                </div>
              )}

              <Field label="Bukti / foto nota" className={bisaAtur && karawang ? undefined : 'sm:col-span-2'}>
                {(fid) => <LampiranInput id={fid} value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
              </Field>
              {bisaAtur && karawang && (
                <Checkbox className="self-center" checked={form.ditagihkan} onChange={(e) => setForm((f) => ({ ...f, ditagihkan: e.target.checked }))}
                  label="Ditagihkan ke klien (Additional Cost di PI)" />
              )}
            </>
          )}
          {galat && <div className="sm:col-span-2"><PesanGalat>{galat}</PesanGalat></div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus biaya?"
        message={`${labelBiaya(menghapus?.expense_type ?? '')} senilai ${formatRupiah(menghapus?.amount ?? 0)} akan dihapus beserta buktinya.`}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </div>
  )
}
