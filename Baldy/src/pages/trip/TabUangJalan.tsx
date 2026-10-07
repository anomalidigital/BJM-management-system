import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaPen, FaTrashCan } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, Input, DateInput, Select } from '../../components/ui/Field'
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

/** Petunjuk tiap jenis termin. */
const PETUNJUK_JENIS: Record<JenisTermin, string> = {
  uj: 'Uang perjalanan dari patokan UJROUTE: solar, tol, ASDP, SPSI, nginap dibayar sopir dari sini.',
  uang_dorong: 'Uang untuk lanjut membawa muatan balik. Catat di trip backload-nya.',
  uang_pulang: 'Sopir pulang kosong tanpa backload.',
  tambahan: 'Kekurangan uang jalan di luar patokan, mis. perjalanan lebih lama.',
}
import { KepalaTab, KepalaTabel, KosongTab, PakaiNilai, PesanGalat } from './bagian'

/**
 * Tab Uang Jalan. Uang jalan = seluruh uang untuk sopir selama perjalanan (uang jalan,
 * uang dorong, uang pulang, tambahan). UJROUTE route hanya patokan: termin dicatat saat
 * uang benar-benar dibayar. Potong kasbon mengurangi kasbon sopir penerima termin itu.
 */
export function TabUangJalan({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, simpanTermin, hapusTermin } = useData()
  const toast = useToast()

  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<UjPayment | null>(null)
  const [form, setForm] = useState<TerminForm>({ payment_date: '', driver_id: '', jenis: 'uj', uj_amount: 0, kasbon_deduction: 0, notes: '', attachments: [] })
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
  const { bisa } = useAuth()
  const patokan = trip.ujroute
  const sisa = patokan - uj.uj
  const penyelesaian = new Map((trip.cancel_settlement ?? []).map((x) => [x.uj_payment_id, x]))

  /** Penerima termin: sopir trip ini; bila trip belum punya sopir, seluruh sopir aktif. */
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

  // Saldo sopir terpilih tanpa potongan termin yang sedang diubah.
  const saldo = form.driver_id ? hitungSaldo(dbAll.kasbonEntries, form.driver_id, editing?.id) : 0
  const maksPotong = Math.max(0, Math.min(saldo, form.uj_amount))
  const namaSopir = drivers.get(form.driver_id)?.driver_name ?? ''
  /** Potongan melebihi kasbon yang masih ada: tidak bisa disimpan. */
  const potongLebih = !!form.driver_id && form.kasbon_deduction > Math.max(0, saldo)
  /** Sopir tanpa kasbon: tidak ada yang bisa dipotong, jadi kolomnya dikunci. */
  const tanpaKasbon = !!form.driver_id && saldo <= 0 && form.kasbon_deduction === 0
  /** Total UJ setelah termin ini disimpan, untuk dibandingkan dengan patokan. */
  const totalSetelah = uj.uj - (editing?.uj_amount ?? 0) + form.uj_amount
  const sisaSebelumIni = patokan - (uj.uj - (editing?.uj_amount ?? 0))

  function buka(p?: UjPayment) {
    setEditing(p ?? null)
    setForm(p
      ? { payment_date: p.payment_date, driver_id: p.driver_id, jenis: p.jenis ?? 'uj', uj_amount: p.uj_amount, kasbon_deduction: p.kasbon_deduction, notes: p.notes, attachments: p.attachments ?? [] }
      : {
          payment_date: trip.transaction_date,
          driver_id: trip.driver_ids[0] ?? '',
          jenis: 'uj',
          // Termin baru langsung diisi sisa dari patokan; tetap bisa diubah.
          uj_amount: Math.max(0, sisa),
          kasbon_deduction: 0,
          notes: '',
          attachments: [],
        })
    setGalat(null); setTerbuka(true)
  }

  function simpan() {
    if (!form.payment_date) { setGalat('Tanggal wajib diisi.'); return }
    if (form.uj_amount <= 0) { setGalat('Nilai UJ harus lebih dari 0.'); return }
    if (form.kasbon_deduction > form.uj_amount) { setGalat('Potong kasbon tidak boleh melebihi UJ.'); return }
    if (!bisa('override') && patokan > 0 && form.uj_amount > Math.max(0, sisaSebelumIni)) {
      setGalat((form.jenis ?? 'uj') === 'uj'
        ? `Melebihi patokan UJROUTE (sisa ${formatRupiah(Math.max(0, sisaSebelumIni))}). Uang jalan di atas patokan perlu Manager atau Owner.`
        : `${JENIS_TERMIN_LABEL[form.jenis ?? 'uj']} di luar patokan UJROUTE perlu Manager atau Owner.`)
      return
    }
    if (form.kasbon_deduction > 0 && !form.driver_id) { setGalat('Pilih sopir yang kasbonnya dipotong.'); return }
    if (form.kasbon_deduction > saldo) {
      setGalat(`Kasbon ${namaSopir || 'sopir ini'} tinggal ${formatRupiah(Math.max(0, saldo))}. Potongan tidak boleh melebihinya.`)
      return
    }
    simpanTermin(trip.id, form, editing ?? undefined)
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
      Patokan UJROUTE route <span className="font-semibold text-ink-2">{trip.route_name || trip.route_code}</span>: {formatRupiah(patokan)} ·
      dibayar {formatRupiah(uj.uj)} ·{' '}
      {sisa >= 0
        ? <>sisa <span className="tnum font-semibold text-ink-2">{formatRupiah(sisa)}</span></>
        : <span className="font-semibold text-[#8a6100]">melebihi patokan {formatRupiah(-sisa)}</span>}
      . Catat termin saat uang benar-benar dibayar.
    </>
  ) : (
    'Route trip ini belum punya patokan UJROUTE. Catat termin saat uang dibayar; potong kasbon mengurangi kasbon sopir penerima.'
  )

  return (
    <div>
      <KepalaTab keterangan={keterangan} tombol="Tambah Termin" bisaUbah={bisaUbah} onTambah={() => buka()} />
      {payments.length === 0 ? (
        <KosongTab
          judul="Belum ada uang jalan yang dibayar."
          keterangan={patokan > 0 ? `Patokan dari route: ${formatRupiah(patokan)}. Termin pertama akan terisi nilai itu.` : 'Tambahkan termin saat uang jalan dibayar.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <KepalaTabel kolom={[
              { label: 'Termin' }, { label: 'Tanggal' }, { label: 'Sopir' }, { label: 'UJ', kanan: true },
              { label: 'Potong Kasbon', kanan: true }, { label: 'TF', kanan: true },
              ...(batal ? [{ label: 'Setelah batal' }] : []),
              { label: 'Catatan' }, { label: 'Bukti' }, { label: 'Action', kanan: true },
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
                          ? <Badge tone={selesai.cara === 'kasbon' ? 'warning' : 'good'}>{selesai.cara === 'kasbon' ? 'Jadi kasbon sopir' : 'Dikembalikan tunai'}</Badge>
                          : <span className="text-ink-3">—</span>}
                      </td>
                    )}
                    <td className="max-w-64 px-3 py-2.5 text-ink-3">{p.notes || '—'}</td>
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
                <td colSpan={batal ? 4 : 3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title={editing ? `Ubah Termin ${editing.sequence}` : 'Tambah Termin Uang Jalan'}
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
          <Field label="Jenis" required className="sm:col-span-2" hint={PETUNJUK_JENIS[form.jenis ?? 'uj']}>
            {(fid) => (
              <Select id={fid} value={form.jenis ?? 'uj'} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as JenisTermin }))}>
                {JENIS_TERMIN.map((j) => <option key={j} value={j}>{JENIS_TERMIN_LABEL[j]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} />}
          </Field>
          <Field label="Sopir penerima" hint="Kasbon yang dipotong milik sopir ini.">
            {(fid) => (
              <SearchableSelect
                id={fid}
                options={opsiSopir}
                value={form.driver_id || null}
                placeholder="Pilih sopir..."
                onChange={(v) => setForm((f) => ({ ...f, driver_id: v ?? '' }))}
              />
            )}
          </Field>
          <Field
            label="UJ"
            required
            hint={patokan > 0 && sisaSebelumIni > 0 && form.uj_amount !== sisaSebelumIni
              ? <>Sisa patokan {formatRupiah(sisaSebelumIni)} · <PakaiNilai label="Pakai" onClick={() => setForm((f) => ({ ...f, uj_amount: sisaSebelumIni }))} /></>
              : patokan > 0 ? `Patokan UJROUTE ${formatRupiah(patokan)}.` : undefined}
          >
            {(fid) => <CurrencyInput id={fid} value={form.uj_amount} onValueChange={(v) => setForm((f) => ({ ...f, uj_amount: v }))} />}
          </Field>
          <Field
            label="Potong Kasbon"
            error={potongLebih ? `Melebihi kasbon ${namaSopir} (${formatRupiah(Math.max(0, saldo))}). Kosongkan, atau catat kasbonnya dulu.` : undefined}
            hint={!form.driver_id
              ? 'Pilih sopir untuk melihat kasbonnya.'
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
              <span className="text-[12.5px] font-medium text-brand-800">TF ke sopir</span>
              <span className="tnum text-[16px] font-semibold text-brand-800">{formatRupiah(form.uj_amount - form.kasbon_deduction)}</span>
            </p>
            <p className="mt-1 text-[11.5px] text-brand-700">
              Dihitung otomatis: UJ − Potong Kasbon
              {form.kasbon_deduction > 0 && form.driver_id && !potongLebih && <> · sisa kasbon {namaSopir} menjadi {formatRupiah(saldo - form.kasbon_deduction)}</>}
            </p>
            {patokan > 0 && totalSetelah > patokan && (
              <p className="mt-1 text-[11.5px] font-medium text-[#8a6100]">
                Total UJ trip menjadi {formatRupiah(totalSetelah)}, melebihi patokan {formatRupiah(patokan)}. Tetap boleh disimpan.
              </p>
            )}
          </div>
          <Field label="Catatan" className="sm:col-span-2">
            {(fid) => <Input id={fid} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />}
          </Field>
          <Field label="Bukti transfer / foto" className="sm:col-span-2">
            {(fid) => <LampiranInput id={fid} value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
          <div className="sm:col-span-2"><PesanGalat>{galat}</PesanGalat></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus termin?"
        message={menghapus && (
          <>
            Termin {menghapus.sequence} senilai {formatRupiah(menghapus.uj_amount)} akan dihapus.
            {menghapus.kasbon_deduction > 0 && (
              <span className="mt-2 block">Potongan kasbon {formatRupiah(menghapus.kasbon_deduction)} dikembalikan ke kasbon {drivers.get(menghapus.driver_id)?.driver_name ?? 'sopirnya'}.</span>
            )}
          </>
        )}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </div>
  )
}
