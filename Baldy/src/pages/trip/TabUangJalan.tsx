import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FaLock, FaPen, FaTrashCan } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, Input, DateInput, Select, Textarea } from '../../components/ui/Field'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import type { TerminForm } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { useAuth } from '../../store/AuthProvider'
import { tfPembayaran, totalUj } from '../../lib/calculations'
import { saldoKasbon as hitungSaldo } from '../../lib/kasbon'
import { formatDate, formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { JENIS_TERMIN, JENIS_TERMIN_LABEL } from '../../types'
import type { JenisTermin, TransactionRow, UjPayment } from '../../types'
import { KepalaTab, KepalaTabel, KosongTab, KotakInfo, PakaiNilai, PesanGalat } from './bagian'

/** Petunjuk tiap jenis termin. */
const PETUNJUK_JENIS: Record<JenisTermin, string> = {
  uj: 'Uang perjalanan dari patokan UJ Rute: tol, solar, SPSI Banlok, overnight, ASDP dibayar supir dari sini. Di atas patokan perlu persetujuan Manager / Owner beserta alasannya.',
  uang_dorong: 'Uang untuk lanjut membawa muatan balik; catat di trip backload / rute lanjutannya. Nominalnya belum diatur, jadi tidak dibatasi patokan.',
  uang_pulang: 'Supir pulang kosong tanpa backload. Nominalnya belum diatur, jadi tidak dibatasi patokan.',
  tambahan: 'Kekurangan uang jalan di luar patokan, mis. perjalanan lebih lama. Selalu perlu persetujuan Manager / Owner beserta alasannya.',
}

/** Termin tanpa jenis = uang jalan biasa (data lama). */
const jenisTermin = (p: Pick<UjPayment, 'jenis'>): JenisTermin => p.jenis ?? 'uj'

/** Isian termin + persetujuan di atas patokan (disimpan pada termin itu). */
type IsiTermin = TerminForm & Pick<UjPayment, 'override_note' | 'override_by'>

/**
 * Tab Uang Jalan. Uang jalan = seluruh uang untuk supir selama perjalanan (uang jalan,
 * uang dorong, uang pulang, tambahan); termin dicatat saat uang benar-benar dibayar.
 *
 * Patokan UJ Rute hanya membatasi termin jenis "Uang jalan": total di atas patokan perlu
 * Manager / Owner (bisa('override')) dan alasan, yang disimpan di termin (override_note,
 * override_by = username). Termin "Tambahan" selalu perlu persetujuan + alasan. Uang dorong
 * & uang pulang belum punya patokan (TBD-24), jadi cukup bisa('trip').
 * Potong kasbon mengurangi kasbon supir penerima termin itu.
 *
 * ?tambah=uang_dorong | uang_pulang di URL membuka form termin jenis itu (dipakai pilihan
 * "Uang Dorong" di Biaya Operasional), lalu parameternya dihapus.
 */
export function TabUangJalan({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, simpanTermin, hapusTermin } = useData()
  const { bisa, user, pengguna } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<UjPayment | null>(null)
  const [form, setForm] = useState<TerminForm>({ payment_date: '', driver_id: '', jenis: 'uj', uj_amount: 0, kasbon_deduction: 0, notes: '', attachments: [] })
  /** Alasan uang jalan di atas patokan / uang tambahan. */
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<UjPayment | null>(null)

  // Dibaca dari seluruh data supaya arsip trip batal tetap terlihat.
  const payments = useMemo(
    () => dbAll.ujPayments.filter((p) => p.trip_id === trip.id).sort((a, b) => a.sequence - b.sequence),
    [dbAll.ujPayments, trip.id],
  )
  const drivers = useMemo(() => new Map(dbAll.drivers.map((d) => [d.id, d])), [dbAll.drivers])
  const uj = totalUj(payments)
  const batal = trip.status === 'batal'
  /** Boleh menyetujui uang jalan di atas patokan & uang tambahan (Manager / Owner). */
  const bisaSetujui = bisa('override')
  const patokan = trip.ujroute
  /** Yang dibandingkan dengan patokan hanya termin jenis "Uang jalan". */
  const ujDibayar = payments.filter((p) => jenisTermin(p) === 'uj').reduce((a, p) => a + p.uj_amount, 0)
  const sisa = patokan - ujDibayar
  /** Uang di luar patokan per jenis: uang dorong, uang pulang, tambahan. */
  const luarPatokan = JENIS_TERMIN
    .filter((j) => j !== 'uj')
    .map((j) => ({ jenis: j, nilai: payments.filter((p) => jenisTermin(p) === j).reduce((a, p) => a + p.uj_amount, 0) }))
    .filter((x) => x.nilai > 0)
  const penyelesaian = new Map((trip.cancel_settlement ?? []).map((x) => [x.uj_payment_id, x]))
  const adaAlasan = payments.some((p) => p.override_note)
  const namaPengguna = (username?: string) => (username ? pengguna.find((p) => p.username === username)?.name ?? username : '')

  /** Penerima termin: supir trip ini; bila trip belum punya supir, seluruh supir aktif. */
  const opsiSopir = useMemo(() => {
    const ids = trip.driver_ids.length
      ? trip.driver_ids
      : dbAll.drivers.filter((d) => d.role === 'sopir' && d.status === 'aktif').map((d) => d.id)
    const semua = editing?.driver_id && !ids.includes(editing.driver_id) ? [...ids, editing.driver_id] : ids
    return semua.map((id) => {
      const d = drivers.get(id)
      return { value: id, label: d ? `${d.driver_code} — ${d.driver_name}` : id, meta: `Kasbon ${formatRupiah(hitungSaldo(dbAll.kasbonEntries, id))}` }
    })
  }, [trip.driver_ids, dbAll.drivers, dbAll.kasbonEntries, drivers, editing])

  // Saldo supir terpilih tanpa potongan termin yang sedang diubah.
  const saldo = form.driver_id ? hitungSaldo(dbAll.kasbonEntries, form.driver_id, editing?.id) : 0
  const maksPotong = Math.max(0, Math.min(saldo, form.uj_amount))
  const namaSopir = drivers.get(form.driver_id)?.driver_name ?? ''
  /** Potongan melebihi kasbon yang masih ada: tidak bisa disimpan. */
  const potongLebih = !!form.driver_id && form.kasbon_deduction > Math.max(0, saldo)
  /** Supir tanpa kasbon: tidak ada yang bisa dipotong, jadi kolomnya dikunci. */
  const tanpaKasbon = !!form.driver_id && saldo <= 0 && form.kasbon_deduction === 0

  /* ── Patokan & persetujuan termin yang sedang diisi ── */
  const jenis = form.jenis ?? 'uj'
  const jenisLama = editing ? jenisTermin(editing) : null
  /** Uang jalan termin lain (tanpa termin yang sedang diubah). */
  const ujLain = payments.filter((p) => jenisTermin(p) === 'uj' && p.id !== editing?.id).reduce((a, p) => a + p.uj_amount, 0)
  const sisaSebelumIni = patokan - ujLain
  /** Total uang jalan setelah termin ini disimpan, untuk dibandingkan dengan patokan. */
  const totalSetelah = ujLain + (jenis === 'uj' ? form.uj_amount : 0)
  const lewatPatokan = jenis === 'uj' && patokan > 0 && totalSetelah > patokan
  /** Termin ini butuh persetujuan Manager / Owner + alasan. */
  const perluSetuju = jenis === 'tambahan' || lewatPatokan
  /** Simpanan ini menambah uang: termin baru, jenisnya berganti, atau nominalnya naik. */
  const naik = !editing || jenisLama !== jenis || form.uj_amount > editing.uj_amount
  /** Persetujuan baru diperlukan. Mengubah tanggal / bukti termin yang sudah disetujui tidak perlu. */
  const butuhSetuju = perluSetuju && naik
  const tampilAlasan = perluSetuju || !!editing?.override_note
  const wajibAlasan = perluSetuju && (naik || !!editing?.override_note)

  /** Isian awal nominal termin baru: sisa patokan untuk uang jalan; jenis lain belum berpatokan. */
  const nominalAwal = (j: JenisTermin) => (j === 'uj' ? Math.max(0, sisa) : 0)

  function buka(p?: UjPayment, jenisAwal: JenisTermin = 'uj') {
    setEditing(p ?? null)
    setForm(p
      ? { payment_date: p.payment_date, driver_id: p.driver_id, jenis: p.jenis ?? 'uj', uj_amount: p.uj_amount, kasbon_deduction: p.kasbon_deduction, notes: p.notes, attachments: p.attachments ?? [] }
      : {
          payment_date: trip.transaction_date,
          driver_id: trip.driver_ids[0] ?? '',
          jenis: jenisAwal,
          // Uang jalan baru langsung diisi sisa dari patokan; tetap bisa diubah.
          uj_amount: nominalAwal(jenisAwal),
          kasbon_deduction: 0,
          notes: '',
          attachments: [],
        })
    setAlasan(p?.override_note ?? '')
    setGalat(null); setTerbuka(true)
  }

  // Dibuka dari tempat lain, mis. pilihan "Uang Dorong" di Biaya Operasional (?tambah=uang_dorong).
  const minta = params.get('tambah')
  useEffect(() => {
    if (minta !== 'uang_dorong' && minta !== 'uang_pulang') return
    if (bisaUbah) buka(undefined, minta)
    const p = new URLSearchParams(params)
    p.delete('tambah')
    setParams(p, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minta])

  function gantiJenis(j: JenisTermin) {
    setForm((f) => {
      // Nominal yang masih isian otomatis ikut jenis baru; nominal ketikan sendiri tidak diubah.
      const otomatis = !editing && f.uj_amount === nominalAwal(f.jenis ?? 'uj')
      return { ...f, jenis: j, uj_amount: otomatis ? nominalAwal(j) : f.uj_amount }
    })
    setGalat(null)
  }

  function simpan() {
    if (!form.payment_date) { setGalat('Tanggal wajib diisi.'); return }
    if (form.uj_amount <= 0) { setGalat('Nilai UJ harus lebih dari 0.'); return }
    if (form.kasbon_deduction > form.uj_amount) { setGalat('Potong kasbon tidak boleh melebihi UJ.'); return }
    if (butuhSetuju && !bisaSetujui) {
      setGalat(`Belum bisa disimpan: ${jenis === 'tambahan' ? 'uang tambahan' : 'uang jalan di atas patokan'} perlu persetujuan Manager atau Owner.`)
      return
    }
    const ket = alasan.trim()
    if (bisaSetujui && wajibAlasan && !ket) {
      setGalat(jenis === 'tambahan' ? 'Tulis alasan uang tambahan ini.' : 'Tulis alasan uang jalan di atas patokan.')
      return
    }
    if (form.kasbon_deduction > 0 && !form.driver_id) { setGalat('Pilih supir yang kasbonnya dipotong.'); return }
    if (form.kasbon_deduction > saldo) {
      setGalat(`Kasbon ${namaSopir || 'supir ini'} tinggal ${formatRupiah(Math.max(0, saldo))}. Potongan tidak boleh melebihinya.`)
      return
    }
    // Persetujuan tercatat atas nama yang menyimpan; tanpa perubahan, persetujuan lama dipertahankan.
    let persetujuan: Pick<UjPayment, 'override_note' | 'override_by'> = editing
      ? { override_note: editing.override_note, override_by: editing.override_by }
      : {}
    if (bisaSetujui && tampilAlasan) {
      const baru = butuhSetuju || ket !== (editing?.override_note ?? '')
      persetujuan = ket
        ? { override_note: ket, override_by: baru ? user?.username ?? '' : editing?.override_by }
        : { override_note: undefined, override_by: undefined }
    }
    const isi: IsiTermin = { ...form, ...persetujuan }
    simpanTermin(trip.id, isi, editing ?? undefined)
    toast.success(editing ? 'Termin berhasil diperbarui.' : 'Termin uang jalan berhasil ditambahkan.')
    setTerbuka(false)
  }

  function hapus() {
    if (!menghapus) return
    hapusTermin(menghapus)
    toast.success(menghapus.kasbon_deduction > 0
      ? `Termin dihapus. Potongan kasbon ${formatRupiah(menghapus.kasbon_deduction)} dikembalikan.`
      : 'Termin berhasil dihapus.')
    setMenghapus(null)
  }

  const keterangan = batal ? (
    'Trip dibatalkan: termin di bawah hanya arsip dan tidak dihitung di laporan.'
  ) : patokan > 0 ? (
    <>
      Patokan UJ Rute <span className="font-semibold text-ink-2">{trip.route_name || trip.route_code}</span>: {formatRupiah(patokan)} ·
      uang jalan dibayar {formatRupiah(ujDibayar)} ·{' '}
      {sisa >= 0
        ? <>sisa <span className="tnum font-semibold text-ink-2">{formatRupiah(sisa)}</span></>
        : <span className="font-semibold text-[#8a6100]">melebihi patokan {formatRupiah(-sisa)}</span>}
      {luarPatokan.length > 0 && <> · di luar patokan: {luarPatokan.map((x) => `${JENIS_TERMIN_LABEL[x.jenis].toLowerCase()} ${formatRupiah(x.nilai)}`).join(', ')}</>}
      . Catat termin saat uang benar-benar dibayar; di atas patokan perlu persetujuan Manager / Owner.
    </>
  ) : (
    'Rute trip ini belum punya patokan UJ Rute. Catat termin saat uang dibayar; potong kasbon mengurangi kasbon supir penerima.'
  )

  return (
    <div>
      <KepalaTab keterangan={keterangan} tombol="Tambah Termin" bisaUbah={bisaUbah} onTambah={() => buka()} />
      {payments.length === 0 ? (
        <KosongTab
          judul="Belum ada uang jalan yang dibayar."
          keterangan={patokan > 0 ? `Patokan UJ Rute: ${formatRupiah(patokan)}. Termin pertama akan terisi nilai itu.` : 'Tambahkan termin saat uang jalan dibayar.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <KepalaTabel kolom={[
              { label: 'Termin' }, { label: 'Tanggal' }, { label: 'Supir' }, { label: 'UJ', kanan: true },
              { label: 'Potong Kasbon', kanan: true }, { label: 'TF', kanan: true },
              ...(batal ? [{ label: 'Setelah batal' }] : []),
              { label: 'Catatan' },
              ...(adaAlasan ? [{ label: 'Alasan & persetujuan' }] : []),
              { label: 'Bukti' }, { label: 'Action', kanan: true },
            ]} />
            <tbody>
              {payments.map((p) => {
                const d = drivers.get(p.driver_id)
                const selesai = penyelesaian.get(p.id)
                return (
                  <tr key={p.id} className={cn('border-b border-grid last:border-0 hover:bg-sunken', batal && 'text-ink-3')}>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap items-center gap-1">
                        <Badge tone="neutral">Termin {p.sequence}</Badge>
                        {p.jenis && p.jenis !== 'uj' && <Badge tone="brand">{JENIS_TERMIN_LABEL[p.jenis]}</Badge>}
                      </span>
                    </td>
                    <td className="tnum px-3 py-2.5 text-ink-2">{formatDate(p.payment_date)}</td>
                    <td className="px-3 py-2.5">
                      {d ? <Link to={`/master/karyawan/${d.id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">{d.driver_name}</Link> : <span className="text-ink-3">—</span>}
                    </td>
                    <td className={cn('tnum px-3 py-2.5 text-right font-medium', batal && 'line-through')}>{formatRupiah(p.uj_amount)}</td>
                    <td className={cn('tnum px-3 py-2.5 text-right text-ink-2', batal && 'line-through')}>{p.kasbon_deduction ? formatRupiah(p.kasbon_deduction) : '—'}</td>
                    <td className={cn('tnum px-3 py-2.5 text-right font-semibold text-ink', batal && 'line-through')}>{formatRupiah(tfPembayaran(p))}</td>
                    {batal && (
                      <td className="px-3 py-2.5">
                        {selesai
                          ? <Badge tone={selesai.cara === 'kasbon' ? 'warning' : 'good'}>{selesai.cara === 'kasbon' ? 'Jadi kasbon supir' : 'Dikembalikan tunai'}</Badge>
                          : <span className="text-ink-3">—</span>}
                      </td>
                    )}
                    <td className="max-w-64 px-3 py-2.5 text-ink-3">{p.notes || '—'}</td>
                    {adaAlasan && (
                      <td className="max-w-64 px-3 py-2.5">
                        {p.override_note ? (
                          <>
                            <p className="whitespace-normal text-ink-2">{p.override_note}</p>
                            {p.override_by && <p className="text-[11.5px] text-ink-3">Disetujui {namaPengguna(p.override_by)}</p>}
                          </>
                        ) : <span className="text-ink-3">—</span>}
                      </td>
                    )}
                    <td className="px-3 py-2.5"><LampiranThumbs ids={p.attachments ?? []} ukuran={30} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <IconButton label="Ubah" icon={<FaPen size={14} />} disabled={!bisaUbah} onClick={() => buka(p)} />
                        <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={14} />} disabled={!bisaUbah} onClick={() => setMenghapus(p)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-hairline bg-sunken font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-[12px] text-ink-2" colSpan={3}>Total {uj.termin} termin{batal && ' (arsip)'}</td>
                <td className="tnum px-3 py-2.5 text-right">{formatRupiah(uj.uj)}</td>
                <td className="tnum px-3 py-2.5 text-right">{formatRupiah(uj.kasbon)}</td>
                <td className="tnum px-3 py-2.5 text-right text-ink">{formatRupiah(uj.tf)}</td>
                <td colSpan={(batal ? 1 : 0) + (adaAlasan ? 1 : 0) + 3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title={editing ? `Ubah Termin ${editing.sequence}` : 'Tambah Termin Uang Jalan'}
        subtitle={`Trip ${trip.id_tampil}`}
        size="md"
        footer={
          <>
            <Button onClick={() => setTerbuka(false)}>Batal</Button>
            <Button variant="primary" onClick={simpan}>Simpan</Button>
          </>
        }
      >
        {/* Ringkas tanpa scroll (Baldy 14 Okt 2026). */}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Jenis" required className="sm:col-span-2" hint={PETUNJUK_JENIS[jenis]}>
            {(fid) => (
              <Select id={fid} value={jenis} onChange={(e) => gantiJenis(e.target.value as JenisTermin)}>
                {JENIS_TERMIN.map((j) => {
                  // Admin tidak bisa memilih Tambahan (selalu perlu persetujuan), kecuali termin itu memang Tambahan.
                  const terkunci = j === 'tambahan' && !bisaSetujui && jenisLama !== 'tambahan'
                  return <option key={j} value={j} disabled={terkunci}>{JENIS_TERMIN_LABEL[j]}{terkunci ? ' (perlu Manager / Owner)' : ''}</option>
                })}
              </Select>
            )}
          </Field>
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} />}
          </Field>
          <Field label="Supir penerima" hint="Kasbon yang dipotong milik supir ini.">
            {(fid) => (
              <SearchableSelect
                id={fid}
                options={opsiSopir}
                value={form.driver_id || null}
                placeholder="Pilih supir..."
                onChange={(v) => setForm((f) => ({ ...f, driver_id: v ?? '' }))}
              />
            )}
          </Field>
          <Field
            label="UJ"
            required
            hint={jenis !== 'uj'
              ? (jenis === 'tambahan' ? 'Di luar patokan UJ Rute.' : 'Belum ada patokan untuk jenis ini; isi sesuai uang yang dibayar.')
              : patokan > 0 && sisaSebelumIni > 0 && form.uj_amount !== sisaSebelumIni
                ? <>Sisa patokan UJ Rute {formatRupiah(sisaSebelumIni)} · <PakaiNilai label="Pakai" onClick={() => setForm((f) => ({ ...f, uj_amount: sisaSebelumIni }))} /></>
                : patokan > 0 ? `Patokan UJ Rute ${formatRupiah(patokan)}.` : 'Rute ini belum punya patokan UJ Rute.'}
          >
            {(fid) => <CurrencyInput id={fid} value={form.uj_amount} onValueChange={(v) => setForm((f) => ({ ...f, uj_amount: v }))} />}
          </Field>
          <Field
            label="Potong Kasbon"
            error={potongLebih ? `Melebihi kasbon ${namaSopir} (${formatRupiah(Math.max(0, saldo))}). Kosongkan, atau catat kasbonnya dulu.` : undefined}
            hint={!form.driver_id
              ? 'Pilih supir untuk melihat kasbonnya.'
              : saldo <= 0
                ? <>
                    {namaSopir} tidak punya kasbon, jadi tidak ada yang dipotong. Kasbon baru dicatat di{' '}
                    <Link to={`/master/karyawan/${form.driver_id}`} target="_blank" className="font-medium text-brand-700 hover:underline">halaman {namaSopir}</Link>.
                  </>
                : <>
                    Kasbon {namaSopir}: <span className="tnum font-semibold text-ink-2">{formatRupiah(saldo)}</span>
                    {maksPotong > 0 && form.kasbon_deduction !== maksPotong && <> · <PakaiNilai label={`Potong ${formatRupiah(maksPotong)}`} onClick={() => setForm((f) => ({ ...f, kasbon_deduction: maksPotong }))} /></>}
                  </>}
          >
            {(fid) => (
              <CurrencyInput
                id={fid}
                value={form.kasbon_deduction}
                invalid={potongLebih}
                disabled={tanpaKasbon}
                onValueChange={(v) => setForm((f) => ({ ...f, kasbon_deduction: v }))}
              />
            )}
          </Field>
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-3 sm:col-span-2">
            <p className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-medium text-brand-800">TF ke supir</span>
              <span className="tnum text-[16px] font-semibold text-brand-800">{formatRupiah(form.uj_amount - form.kasbon_deduction)}</span>
            </p>
            <p className="mt-1 text-[11.5px] text-brand-700">
              Dihitung otomatis: UJ − Potong Kasbon
              {form.kasbon_deduction > 0 && form.driver_id && !potongLebih && <> · sisa kasbon {namaSopir} menjadi {formatRupiah(saldo - form.kasbon_deduction)}</>}
            </p>
            {lewatPatokan && bisaSetujui && (
              <p className="mt-1 text-[11.5px] font-medium text-[#8a6100]">
                Total uang jalan trip menjadi {formatRupiah(totalSetelah)}, melebihi patokan UJ Rute {formatRupiah(patokan)}.
              </p>
            )}
          </div>

          {tampilAlasan && (bisaSetujui ? (
            <Field
              label={jenis === 'tambahan' ? 'Alasan uang tambahan' : 'Alasan di atas patokan'}
              required={wajibAlasan}
              className="sm:col-span-2"
              hint={butuhSetuju || alasan.trim() !== (editing?.override_note ?? '')
                ? `Tercatat disetujui oleh ${user?.name ?? 'Anda'}.`
                : editing?.override_by ? `Disetujui ${namaPengguna(editing.override_by)}.` : undefined}
            >
              {(fid) => (
                <Textarea id={fid} rows={2} value={alasan} placeholder="mis. macet total dua hari di jalur Cikampek"
                  onChange={(e) => setAlasan(e.target.value)} />
              )}
            </Field>
          ) : butuhSetuju ? (
            <KotakInfo nada="peringatan" className="sm:col-span-2">
              {jenis === 'tambahan'
                ? 'Uang tambahan di luar patokan perlu persetujuan Manager atau Owner beserta alasannya. Minta Manager / Owner mencatat termin ini.'
                : <>
                    Total uang jalan menjadi {formatRupiah(totalSetelah)}, melebihi patokan UJ Rute {formatRupiah(patokan)}. Uang jalan di atas
                    patokan perlu persetujuan Manager atau Owner:{' '}
                    {sisaSebelumIni > 0 ? `isi paling banyak sisa patokan ${formatRupiah(sisaSebelumIni)}, atau minta` : 'minta'} Manager / Owner
                    mencatat termin ini beserta alasannya.
                  </>}
            </KotakInfo>
          ) : editing?.override_note ? (
            <div className="rounded-lg border border-hairline bg-sunken px-3.5 py-3 text-[12.5px] sm:col-span-2">
              <p className="text-ink-3">Alasan di atas patokan</p>
              <p className="mt-0.5 font-medium text-ink">{editing.override_note}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                <FaLock size={12} className="shrink-0" />
                {editing.override_by ? `Disetujui ${namaPengguna(editing.override_by)}; ` : ''}ubah oleh Manager / Owner.
              </p>
            </div>
          ) : null)}

          <Field label="Catatan">
            {(fid) => <Input id={fid} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />}
          </Field>
          <Field label="Bukti transfer / foto">
            {(fid) => <LampiranInput id={fid} value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
          {galat && <div className="sm:col-span-2"><PesanGalat>{galat}</PesanGalat></div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus termin?"
        message={menghapus && (
          <>
            Termin {menghapus.sequence} senilai {formatRupiah(menghapus.uj_amount)} akan dihapus.
            {menghapus.kasbon_deduction > 0 && (
              <span className="mt-2 block">Potongan kasbon {formatRupiah(menghapus.kasbon_deduction)} dikembalikan ke kasbon {drivers.get(menghapus.driver_id)?.driver_name ?? 'supirnya'}.</span>
            )}
          </>
        )}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </div>
  )
}
