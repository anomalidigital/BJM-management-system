import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaPrint } from '../../components/ui/icons'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Radio } from '../../components/ui/Field'
import { LampiranInput } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { formatRupiah } from '../../lib/format'
import { formatWaktu, kejadianTrip } from '../../lib/trip'
import type { TransactionRow } from '../../types'
import { PesanGalat } from './bagian'
import { CetakRekapTrip, DaftarCek, RekapTripIsi, useRekap } from './RekapTrip'
import type { CekRekap } from './rekap'

type Pod = 'fisik' | 'foto'
type Jawab = 'ya' | 'tidak' | ''

/**
 * Tutup Trip (Receive all POD / bukti dokumen fisik). Permintaan Ibu 13 Okt 2026: sebelum ditutup
 * tampil rekap keseluruhan trip beserta daftar yang masih kurang, supaya bisa dipastikan lengkap
 * (dan dicetak / disimpan PDF). Lalu dua pertanyaan: keadaan dokumen POD, dan apakah mobil sudah
 * kembali ke pool (selama belum, mobilnya tidak bisa dipilih trip lain). Backload / lanjutan tidak
 * ditanyakan di sini: dibuat dari menu ⋯ "Ada Backload / Lanjutan".
 *
 * Supaya muat tanpa scroll (Baldy 14 Okt 2026), rincian rekap dilipat: angka utamanya tetap tampil
 * di judulnya, rinciannya dibuka dengan satu klik atau dicetak lewat Cetak Rekap.
 */
export function KonfirmasiTutupTrip({ trip, onClose, onClosed }: {
  trip: TransactionRow | null
  onClose: () => void
  /** Dipanggil setelah trip ditutup. */
  onClosed?: () => void
}) {
  const { dbAll, tutupTrip } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const data = useRekap(trip)
  const [pod, setPod] = useState<Pod | ''>('')
  const [foto, setFoto] = useState<string[]>([])
  const [diPool, setDiPool] = useState<Jawab>('')
  const [galat, setGalat] = useState<string | null>(null)
  const [cetak, setCetak] = useState(false)
  const pertanyaanRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPod(''); setFoto(trip?.pod_attachments ?? []); setDiPool(''); setGalat(null); setCetak(false)
  }, [trip])

  const kejadian = useMemo(() => (trip ? kejadianTrip(dbAll.tripEvents ?? [], trip.id) : []), [dbAll.tripEvents, trip])
  if (!trip || !data) return null
  if (cetak) return <CetakRekapTrip data={data} onClose={() => setCetak(false)} />
  const fotoBongkar = kejadian.filter((e) => e.jenis === 'bongkar').flatMap((e) => e.attachments ?? [])
  /** Mobil sudah tercatat di pool sebelum ditutup (tab Perjalanan): tidak perlu ditanya lagi. */
  const catatanPool = trip.pool_at || kejadian.filter((e) => e.jenis === 'pool').at(-1)?.waktu || ''
  /** Pertanyaan pool hanya untuk trip yang memakai kendaraan dan belum tercatat di pool. */
  const tanyaPool = !!trip.vehicle_id && !catatanPool

  function gagal(pesan: string) {
    setGalat(pesan)
    pertanyaanRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function konfirmasi() {
    if (!trip) return
    if (!pod) { gagal('Pilih keadaan dokumen POD.'); return }
    if (pod === 'foto' && foto.length + fotoBongkar.length === 0) { gagal('Lampirkan foto POD, karena dokumen fisiknya belum diterima.'); return }
    if (tanyaPool && !diPool) { gagal('Jawab dulu: mobil sudah kembali ke pool atau belum.'); return }
    const masukPool = tanyaPool && diPool === 'ya'
    tutupTrip(trip.id, { podFisik: pod === 'fisik', podFoto: foto, diPool: masukPool })
    toast.success(`Trip ${trip.id_tampil} ditutup${tanyaPool && !masukPool
      ? '. Mobil belum tercatat di pool: tandai setelah kembali, atau buat backload / lanjutan dari menu ⋯.'
      : ' dan siap dibuatkan PI di Tagihan.'}`)
    onClose()
    onClosed?.()
  }

  const buka = (tab: NonNullable<CekRekap['tab']>) => {
    onClose()
    navigate(tab === 'edit' ? `/transaksi/trip/${trip.id}/edit` : `/transaksi/trip/${trip.id}${tab === 'overview' ? '' : `?tab=${tab}`}`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Tutup Trip ${trip.id_tampil}?`}
      subtitle={[trip.plate_number, trip.driver_names, trip.ata ? `ATA ${formatWaktu(trip.ata)}` : ''].filter(Boolean).join(' · ')}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button icon={<FaPrint size={14} />} onClick={() => setCetak(true)}>Cetak Rekap</Button>
          <Button variant="primary" onClick={konfirmasi}>Tutup Trip</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <DaftarCek cek={data.cek} onBuka={buka} sebelumTutup />

        <details className="group rounded-lg border border-hairline">
          <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-[12.5px] select-none">
            <span className="font-semibold text-ink-2">Rekap keseluruhan trip</span>
            <span className="tnum text-ink-3">
              Harga {formatRupiah(data.angka.harga)} · Uang jalan {formatRupiah(data.angka.ujDihitung)} · Biaya {formatRupiah(data.angka.biaya)} · Netto {formatRupiah(data.angka.netto)}
            </span>
            <span className="ml-auto font-semibold text-brand-700 group-open:hidden">Lihat rincian</span>
            <span className="ml-auto hidden font-semibold text-brand-700 group-open:inline">Lipat</span>
          </summary>
          <div className="border-t border-hairline px-3.5 py-3.5">
            <RekapTripIsi data={data} />
          </div>
        </details>

        <div ref={pertanyaanRef} className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/50 px-3.5 py-3">
          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Dokumen POD (Berita Acara / SJ / TR bertanda tangan penerima)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Radio name="pod" checked={pod === 'fisik'} onChange={() => { setPod('fisik'); setGalat(null) }} label="Dokumen fisik diterima"
                description="Supir sudah menyerahkan hardcopy di pool." />
              <Radio name="pod" checked={pod === 'foto'} onChange={() => { setPod('foto'); setGalat(null) }} label="Foto dulu, fisik menyusul"
                description="Supir lanjut jalan, mis. backload / lanjutan. PI tetap bisa dibuat." />
            </div>
            {pod && (
              <div className="mt-3">
                <LampiranInput label="Tambah foto POD" value={foto} onChange={(v) => { setFoto(v); setGalat(null) }} />
                {fotoBongkar.length > 0 && (
                  <p className="mt-1 text-[12px] text-ink-3">{fotoBongkar.length} foto dari catatan Selesai bongkar ikut menjadi bukti POD.</p>
                )}
              </div>
            )}
          </div>

          {tanyaPool ? (
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Mobil {trip.plate_number || 'trip ini'} sudah kembali ke pool?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Radio name="pool" checked={diPool === 'ya'} onChange={() => { setDiPool('ya'); setGalat(null) }} label="Ya, sudah di pool"
                  description="Mobil langsung bisa dipakai trip lain." />
                <Radio name="pool" checked={diPool === 'tidak'} onChange={() => { setDiPool('tidak'); setGalat(null) }} label="Belum"
                  description="Mobil tetap tertahan di trip ini. Lanjut backload? Buat dari menu ⋯ Ada Backload / Lanjutan." />
              </div>
            </div>
          ) : trip.vehicle_id && catatanPool ? (
            <p className="text-[12.5px] text-ink-3">Mobil sudah tercatat kembali di pool {formatWaktu(catatanPool)}.</p>
          ) : null}

          <PesanGalat>{galat}</PesanGalat>
        </div>
      </div>
    </Modal>
  )
}
