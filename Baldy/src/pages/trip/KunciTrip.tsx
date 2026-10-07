import { FaLock, FaLockOpen } from '../../components/ui/icons'
import { Button } from '../../components/ui/Button'
import type { TripStatus } from '../../types'
import { STATUS_LABEL } from './status'

/** Trip Draft / Menunggu Sopir masih bebas diubah; Aktif dan Selesai dikunci. */
export const tripSudahJalan = (status: TripStatus | undefined) => !!status && status !== 'draft' && status !== 'menunggu_sopir'

/**
 * Peringatan di atas form ubah trip yang sudah jalan: rute, layanan, kendaraan, sopir,
 * dan nomor trip dikunci supaya data yang sudah dipakai uang jalan, Berita Acara, dan
 * tagihan tidak berubah tanpa sengaja. Manager / Owner boleh membuka kuncinya secara sadar.
 */
export function KunciTrip({ status, terbuka, bolehBuka, onBuka }: {
  status: TripStatus
  terbuka: boolean
  bolehBuka: boolean
  onBuka: () => void
}) {
  if (terbuka) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f6e2ac] bg-[#fff8e6] px-3.5 py-2.5 text-[12.5px] text-[#8a6100]">
        <FaLockOpen size={15} className="mt-px shrink-0" />
        Kunci dibuka: rute, layanan, kendaraan, sopir, dan nomor trip boleh diubah. Periksa uang jalan, Berita Acara, dan tagihan trip ini setelah disimpan.
      </div>
    )
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-sunken px-3.5 py-2.5 text-[12.5px] text-ink-2">
      <FaLock size={15} className="shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1">
        Trip sudah <span className="font-semibold text-ink">{STATUS_LABEL[status]}</span>: rute, layanan, kendaraan, sopir, dan nomor trip dikunci.
        {bolehBuka ? ' Perlu diubah? Buka kuncinya.' : ' Perubahan perlu Manager atau Owner.'}
      </span>
      {bolehBuka && <Button size="sm" icon={<FaLockOpen size={13} />} onClick={onBuka}>Buka kunci</Button>}
    </div>
  )
}
