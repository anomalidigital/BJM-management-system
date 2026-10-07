import { useEffect, useMemo, useState } from 'react'
import { FaTriangleExclamation } from '../../components/ui/icons'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Radio } from '../../components/ui/Field'
import { LampiranInput } from '../../components/ui/Lampiran'
import { useData } from '../../store/DataProvider'
import { useToast } from '../../store/ToastProvider'
import { formatWaktu, kejadianTrip } from '../../lib/trip'
import type { TransactionRow } from '../../types'
import { PesanGalat } from './bagian'

type Pod = 'fisik' | 'foto'

/**
 * Tutup Trip (Receive all POD / bukti dokumen fisik). Biasanya saat sopir sudah
 * kembali ke pool dengan semua berkas bertanda tangan; bila sopir langsung lanjut
 * backload, POD cukup difoto dulu dan fisiknya menyusul. Sebelum menutup selalu
 * ditanya soal backload, supaya muatan balik tidak terlewat.
 */
export function KonfirmasiTutupTrip({ trip, onClose, onClosed }: {
  trip: TransactionRow | null
  onClose: () => void
  /** Dipanggil setelah trip ditutup; adaBackload = buka form backload. */
  onClosed?: (adaBackload: boolean) => void
}) {
  const { dbAll, tutupTrip } = useData()
  const toast = useToast()
  const [pod, setPod] = useState<Pod | ''>('')
  const [foto, setFoto] = useState<string[]>([])
  const [backload, setBackload] = useState<'ya' | 'tidak' | ''>('')
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    setPod(''); setFoto(trip?.pod_attachments ?? []); setBackload(''); setGalat(null)
  }, [trip])

  const kejadian = useMemo(() => (trip ? kejadianTrip(dbAll.tripEvents ?? [], trip.id) : []), [dbAll.tripEvents, trip])
  if (!trip) return null
  const bongkar = kejadian.filter((e) => e.jenis === 'bongkar')
  const fotoBongkar = bongkar.flatMap((e) => e.attachments ?? [])
  const lokasi = trip.bongkar || 'lokasi bongkar'

  function konfirmasi() {
    if (!trip) return
    if (!pod) { setGalat('Pilih keadaan dokumen POD.'); return }
    if (pod === 'foto' && foto.length + fotoBongkar.length === 0) { setGalat('Lampirkan foto POD, karena dokumen fisiknya belum diterima.'); return }
    if (!backload) { setGalat('Jawab dulu: ada backload atau tidak.'); return }
    tutupTrip(trip.id, { podFisik: pod === 'fisik', podFoto: foto, adaBackload: backload === 'ya' })
    toast.success(`Trip ${trip.transaction_no} ditutup${backload === 'ya' ? '. Lanjutkan isi trip backload.' : ' dan siap dibuatkan PI di Tagihan.'}`)
    onClose()
    onClosed?.(backload === 'ya')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Tutup Trip ${trip.transaction_no}?`}
      subtitle={[trip.plate_number, trip.driver_names, trip.ata ? `ATA ${formatWaktu(trip.ata)}` : ''].filter(Boolean).join(' · ')}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={konfirmasi}>Tutup Trip</Button>
        </>
      }
    >
      <div className="space-y-5">
        {bongkar.length === 0 && (
          <p className="flex items-start gap-2 rounded-md border border-[#f6e2ac] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-[#8a6100]">
            <FaTriangleExclamation size={14} className="mt-0.5 shrink-0" />
            Belum ada catatan Selesai bongkar di tab Perjalanan. Trip tetap bisa ditutup.
          </p>
        )}

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Dokumen POD (Berita Acara / SJ / TR bertanda tangan penerima)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Radio name="pod" checked={pod === 'fisik'} onChange={() => { setPod('fisik'); setGalat(null) }} label="Dokumen fisik diterima"
              description="Sopir sudah menyerahkan hardcopy di pool." />
            <Radio name="pod" checked={pod === 'foto'} onChange={() => { setPod('foto'); setGalat(null) }} label="Foto dulu, fisik menyusul"
              description="Sopir lanjut jalan, mis. backload. PI tetap bisa dibuat." />
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

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Ada backload (muatan balik) dari {lokasi}?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Radio name="backload" checked={backload === 'ya'} onChange={() => { setBackload('ya'); setGalat(null) }} label="Ada backload"
              description="Setelah ditutup, form backload terbuka dengan mobil dan sopir yang sama." />
            <Radio name="backload" checked={backload === 'tidak'} onChange={() => { setBackload('tidak'); setGalat(null) }} label="Tidak ada"
              description="Sopir pulang kosong. Uang pulangnya dicatat sebagai termin Uang Pulang di tab Uang Jalan." />
          </div>
        </div>

        <PesanGalat>{galat}</PesanGalat>
      </div>
    </Modal>
  )
}
