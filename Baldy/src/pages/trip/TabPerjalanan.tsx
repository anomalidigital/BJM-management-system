import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FaBan, FaBed, FaCheck, FaCircleExclamation, FaFlagCheckered, FaLocationDot, FaMugHot, FaPen, FaPrint, FaRotateLeft,
  FaRoute, FaTrashCan, FaTruckRampBox, FaWarehouse,
} from '../../components/ui/icons'
import type { IconComponent } from '../../components/ui/icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DateInput, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { LampiranInput, LampiranThumbs } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { hapusLampiran } from '../../lib/lampiran'
import { formatDate } from '../../lib/format'
import { formatWaktu, kejadianTrip, sekarangLokal } from '../../lib/trip'
import { cn } from '../../lib/utils'
import { JENIS_PERJALANAN, PERJALANAN_LABEL } from '../../types'
import type { JenisPerjalanan, TransactionRow, TripEvent } from '../../types'
import { KepalaTab, KosongTab, PesanGalat } from './bagian'

type Form = { jenis: JenisPerjalanan; tanggal: string; jam: string; lokasi: string; catatan: string; attachments: string[] }

const IKON: Record<JenisPerjalanan, IconComponent> = {
  pickup: FaTruckRampBox, istirahat: FaMugHot, menginap: FaBed, kendala: FaCircleExclamation, dialihkan: FaRoute,
  tiba: FaLocationDot, bongkar: FaFlagCheckered, retur: FaRotateLeft, pool: FaWarehouse,
}

/** Petunjuk tiap jenis: bukti apa yang dilampirkan dan ke mana biayanya dicatat. */
const PETUNJUK: Record<JenisPerjalanan, string> = {
  pickup: 'Jam barang diambil. Lampirkan manifest dan foto barang saat dimuat.',
  istirahat: 'Berhenti di rest area atau tempat istirahat.',
  menginap: 'Biaya menginap dicatat di Biaya Operasional jenis Nginap; ikut ditagihkan ke klien.',
  kendala: 'Ban, mogok, razia, macet, atau kejadian lain di jalan.',
  dialihkan: 'Tulis alasan dan lokasi baru. Ubah rute lewat Edit bila tujuannya berganti.',
  tiba: 'Jam tiba di lokasi bongkar (ATA). Dipakai di PI dan laporan.',
  bongkar: 'Lampirkan Berita Acara / SJ / TR yang sudah ditandatangani penerima dan foto barang diterima.',
  retur: 'Barang ditolak atau dikembalikan ke gudang: tulis alasannya.',
  pool: 'Mobil kembali ke pool. Tutup trip setelah dokumen fisik diterima.',
}

/** Jenis yang wajib diberi catatan (alasan). */
const WAJIB_CATATAN: JenisPerjalanan[] = ['dialihkan', 'retur', 'kendala']

interface Titik {
  kunci: string
  waktu: string
  judul: string
  lokasi?: string
  catatan?: string
  lampiran?: string[]
  ikon: IconComponent
  nada: 'kejadian' | 'sistem' | 'penting'
  event?: TripEvent
  tautan?: { to: string; label: string }
}

/** Jam lokal dari timestamp ISO (created_at): yyyy-mm-ddThh:mm. */
function lokal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dua = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}T${dua(d.getHours())}:${dua(d.getMinutes())}`
}

/**
 * Tab Perjalanan: riwayat trip dari dibuat sampai ditutup. Kejadian dicatat admin
 * dari kabar sopir (pick up, rest area, tiba, bongkar, retur, pool) beserta buktinya;
 * catatan sistem (dibuat, dicetak, ditutup, backload) ikut tampil di urutan yang sama.
 */
export function TabPerjalanan({ trip, bisaUbah }: { trip: TransactionRow; bisaUbah: boolean }) {
  const { dbAll, transactionRows, create, update, remove } = useData()
  const toast = useToast()
  const [terbuka, setTerbuka] = useState(false)
  const [editing, setEditing] = useState<TripEvent | null>(null)
  const [form, setForm] = useState<Form>({ jenis: 'pickup', tanggal: '', jam: '', lokasi: '', catatan: '', attachments: [] })
  const [galat, setGalat] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState<TripEvent | null>(null)

  const kejadian = useMemo(() => kejadianTrip(dbAll.tripEvents ?? [], trip.id), [dbAll.tripEvents, trip.id])
  const anak = transactionRows.filter((t) => t.backload_dari === trip.id)
  const induk = trip.backload_dari ? transactionRows.find((t) => t.id === trip.backload_dari) : undefined

  const titik = useMemo<Titik[]>(() => {
    const out: Titik[] = kejadian.map((e) => ({
      kunci: e.id, waktu: e.waktu, judul: PERJALANAN_LABEL[e.jenis], lokasi: e.lokasi, catatan: e.catatan, lampiran: e.attachments,
      ikon: IKON[e.jenis], nada: e.jenis === 'tiba' || e.jenis === 'bongkar' ? 'penting' : 'kejadian', event: e,
    }))
    out.push({
      kunci: 'dibuat', waktu: lokal(trip.created_at), judul: induk ? `Trip backload dibuat dari Trip ${induk.transaction_no}` : 'Trip dibuat',
      ikon: FaCheck, nada: 'sistem', tautan: induk ? { to: `/transaksi/trip/${induk.id}`, label: `Buka Trip ${induk.transaction_no}` } : undefined,
    })
    // Tanggal cetak & tutup tanpa jam: diletakkan di akhir hari itu.
    if (trip.printed_at) out.push({ kunci: 'cetak', waktu: `${trip.printed_at}T23:58`, judul: 'Berita Acara dicetak', ikon: FaPrint, nada: 'sistem' })
    if (trip.closed_at) {
      out.push({
        kunci: 'tutup', waktu: `${trip.closed_at}T23:59`, judul: 'Trip ditutup',
        catatan: trip.pod_fisik === false ? 'POD baru difoto; dokumen fisik menyusul.' : 'Dokumen fisik POD diterima di pool.',
        lampiran: trip.pod_attachments, ikon: FaFlagCheckered, nada: 'sistem',
      })
    }
    // Dokumen fisik yang menyusul setelah trip ditutup dengan foto.
    if (trip.pod_fisik && trip.pod_fisik_at && trip.closed_at && trip.pod_fisik_at !== trip.closed_at) {
      out.push({ kunci: 'fisik', waktu: `${trip.pod_fisik_at}T23:59`, judul: 'Dokumen fisik POD diterima di pool', ikon: FaCheck, nada: 'sistem' })
    }
    if (trip.status === 'batal' && trip.cancelled_at) {
      out.push({ kunci: 'batal', waktu: `${trip.cancelled_at}T23:59`, judul: 'Trip dibatalkan', catatan: trip.cancel_reason, ikon: FaBan, nada: 'sistem' })
    }
    for (const a of anak) {
      out.push({
        kunci: `bl-${a.id}`, waktu: lokal(a.created_at), judul: `Backload: Trip ${a.transaction_no}`, lokasi: `${a.muat || '?'} → ${a.bongkar || '?'}`,
        ikon: FaRoute, nada: 'sistem', tautan: { to: `/transaksi/trip/${a.id}`, label: `Buka Trip ${a.transaction_no}` },
      })
    }
    // Di menit yang sama: trip dibuat lebih dulu, catatan penutup paling akhir.
    const urutan = (t: Titik) => (t.kunci === 'dibuat' ? 0 : t.event ? 1 : t.kunci.startsWith('bl-') ? 3 : 2)
    return out.sort((x, y) => x.waktu.localeCompare(y.waktu) || urutan(x) - urutan(y))
  }, [kejadian, trip, anak, induk])

  const ada = (j: JenisPerjalanan) => kejadian.some((e) => e.jenis === j)
  /** Kejadian yang biasanya dicatat berikutnya, jadi admin tidak perlu memilih dari awal. */
  const berikutnya: JenisPerjalanan = !ada('pickup') ? 'pickup' : !ada('tiba') ? 'istirahat' : !ada('bongkar') ? 'bongkar' : 'pool'
  const lokasiAwal = (j: JenisPerjalanan) =>
    j === 'pickup' ? trip.muat : j === 'tiba' || j === 'bongkar' || j === 'retur' ? trip.bongkar : j === 'pool' ? 'POOL' : ''

  function buka(e?: TripEvent, jenis?: JenisPerjalanan) {
    setEditing(e ?? null)
    if (e) {
      const [tanggal, jam] = e.waktu.split('T')
      setForm({ jenis: e.jenis, tanggal, jam: jam ?? '', lokasi: e.lokasi, catatan: e.catatan, attachments: e.attachments ?? [] })
    } else {
      const j = jenis ?? berikutnya
      const [tanggal, jam] = sekarangLokal().split('T')
      setForm({ jenis: j, tanggal, jam, lokasi: lokasiAwal(j), catatan: '', attachments: [] })
    }
    setGalat(null); setTerbuka(true)
  }

  function gantiJenis(j: JenisPerjalanan) {
    setForm((f) => ({ ...f, jenis: j, lokasi: !f.lokasi.trim() || f.lokasi === lokasiAwal(f.jenis) ? lokasiAwal(j) : f.lokasi }))
  }

  function simpan() {
    if (!form.tanggal || !form.jam) { setGalat('Tanggal dan jam wajib diisi.'); return }
    if (WAJIB_CATATAN.includes(form.jenis) && !form.catatan.trim()) { setGalat(`Tulis keterangan untuk ${PERJALANAN_LABEL[form.jenis].toLowerCase()}.`); return }
    const isi = { jenis: form.jenis, waktu: `${form.tanggal}T${form.jam}`, lokasi: form.lokasi.trim(), catatan: form.catatan.trim(), attachments: form.attachments }
    if (editing) { update('tripEvents', editing.id, isi); toast.success('Catatan perjalanan diperbarui.') }
    else { create('tripEvents', { ...isi, trip_id: trip.id }); toast.success(`${PERJALANAN_LABEL[form.jenis]} tercatat.`) }
    setTerbuka(false)
  }

  function hapus() {
    if (!menghapus) return
    remove('tripEvents', menghapus.id)
    void hapusLampiran(menghapus.attachments ?? [])
    toast.success('Catatan perjalanan dihapus.')
    setMenghapus(null)
  }

  const pickup = kejadian.find((e) => e.jenis === 'pickup')
  const ringkas = [
    pickup ? `Pick up ${formatWaktu(pickup.waktu)}` : 'Belum pick up',
    trip.ata ? `ATA ${formatWaktu(trip.ata)}` : 'belum tiba',
    trip.posisi ? `terakhir: ${PERJALANAN_LABEL[trip.posisi.jenis].toLowerCase()}` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <KepalaTab
        keterangan={trip.status === 'batal' ? 'Trip dibatalkan: riwayat di bawah hanya arsip.' : `${ringkas}. Catat kabar dari sopir beserta buktinya; jam tiba (ATA) dipakai di PI.`}
        tombol="Catat kejadian"
        bisaUbah={bisaUbah}
        onTambah={() => buka()}
      />
      {kejadian.length === 0 && (
        <KosongTab judul="Belum ada kejadian perjalanan." keterangan="Mulai dari pick up barang di lokasi muat, lalu tiba dan selesai bongkar di tujuan." />
      )}
      <ol className={cn('px-4 py-4 sm:px-6', kejadian.length === 0 && 'border-t border-hairline')}>
        {titik.map((t, i) => (
          <li key={t.kunci} className="relative flex gap-3 pb-5 last:pb-0 sm:gap-4">
            {i < titik.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-hairline sm:left-[143px]" />}
            <span className="tnum hidden w-[112px] shrink-0 pt-1.5 text-right text-[12px] text-ink-3 sm:block">{t.nada === 'sistem' && t.kunci !== 'dibuat' && !t.kunci.startsWith('bl-') ? formatDate(t.waktu.slice(0, 10)) : formatWaktu(t.waktu)}</span>
            <span className={cn(
              'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border',
              t.nada === 'penting' ? 'border-brand-200 bg-brand-50 text-brand-700' : t.nada === 'sistem' ? 'border-hairline bg-sunken text-ink-3' : 'border-hairline bg-surface text-ink-2',
            )}>
              <t.ikon size={14} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn('text-[13px] font-semibold', t.nada === 'sistem' ? 'text-ink-2' : 'text-ink')}>{t.judul}</p>
                  <p className="tnum text-[12px] text-ink-3 sm:hidden">{formatWaktu(t.waktu)}</p>
                  {t.lokasi && <p className="text-[12.5px] text-ink-2">{t.lokasi}</p>}
                  {t.catatan && <p className="mt-0.5 text-[12.5px] whitespace-pre-line text-ink-3">{t.catatan}</p>}
                  {t.tautan && <Link to={t.tautan.to} className="mt-0.5 inline-block text-[12.5px] font-medium text-brand-700 hover:underline">{t.tautan.label}</Link>}
                </div>
                {t.event && (
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Ubah" icon={<FaPen size={13} />} disabled={!bisaUbah} onClick={() => buka(t.event)} />
                    <IconButton label="Hapus" tone="danger" icon={<FaTrashCan size={13} />} disabled={!bisaUbah} onClick={() => setMenghapus(t.event!)} />
                  </div>
                )}
              </div>
              {(t.lampiran?.length ?? 0) > 0 && <LampiranThumbs ids={t.lampiran!} ukuran={52} className="mt-2" />}
            </div>
          </li>
        ))}
      </ol>

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title={editing ? 'Ubah Kejadian' : 'Catat Kejadian'}
        subtitle={`Trip ${trip.transaction_no}${trip.plate_number ? ` · ${trip.plate_number}` : ''}`}
        size="md"
        footer={
          <>
            <Button onClick={() => setTerbuka(false)}>Batal</Button>
            <Button variant="primary" onClick={simpan}>Simpan</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kejadian" required className="sm:col-span-2" hint={PETUNJUK[form.jenis]}>
            {(fid) => (
              <Select id={fid} value={form.jenis} onChange={(e) => gantiJenis(e.target.value as JenisPerjalanan)}>
                {JENIS_PERJALANAN.map((j) => <option key={j} value={j}>{PERJALANAN_LABEL[j]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Tanggal" required>
            {(fid) => <DateInput id={fid} value={form.tanggal} onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} />}
          </Field>
          <Field label="Jam" required>
            {(fid) => <Input id={fid} type="time" value={form.jam} onChange={(e) => setForm((f) => ({ ...f, jam: e.target.value }))} />}
          </Field>
          <Field label="Lokasi" className="sm:col-span-2">
            {(fid) => <Input id={fid} value={form.lokasi} placeholder="mis. Rest area KM 57" onChange={(e) => setForm((f) => ({ ...f, lokasi: e.target.value }))} />}
          </Field>
          <Field label={WAJIB_CATATAN.includes(form.jenis) ? 'Keterangan' : 'Catatan'} required={WAJIB_CATATAN.includes(form.jenis)} className="sm:col-span-2">
            {(fid) => <Textarea id={fid} rows={3} value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} />}
          </Field>
          <Field label="Bukti" className="sm:col-span-2" hint="Foto barang, manifest, Berita Acara bertanda tangan, atau foto lokasi. Foto diperkecil otomatis.">
            {(fid) => <LampiranInput id={fid} label="Tambah bukti" value={form.attachments} onChange={(v) => setForm((f) => ({ ...f, attachments: v }))} />}
          </Field>
          <div className="sm:col-span-2"><PesanGalat>{galat}</PesanGalat></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!menghapus}
        title="Hapus catatan perjalanan?"
        message={`${menghapus ? PERJALANAN_LABEL[menghapus.jenis] : ''} ${menghapus ? formatWaktu(menghapus.waktu) : ''} akan dihapus beserta buktinya.`}
        onCancel={() => setMenghapus(null)}
        onConfirm={hapus}
      />
    </div>
  )
}
