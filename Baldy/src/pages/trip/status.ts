import type { TripStatus } from '../../types'

export const STATUS_LABEL: Record<TripStatus, string> = {
  draft: 'Draft', menunggu_sopir: 'Menunggu Sopir', aktif: 'Aktif', selesai: 'Selesai', batal: 'Dibatalkan',
}
export const STATUS_TONE: Record<TripStatus, 'neutral' | 'warning' | 'brand' | 'good' | 'critical'> = {
  draft: 'neutral', menunggu_sopir: 'warning', aktif: 'brand', selesai: 'good', batal: 'critical',
}

/** Urutan alur trip, dipakai filter dan pilihan status. */
export const STATUS_URUT: TripStatus[] = ['draft', 'menunggu_sopir', 'aktif', 'selesai', 'batal']

/** Status yang boleh dipilih di form. "Dibatalkan" hanya lewat tombol Batalkan Trip. */
export const STATUS_FORM: TripStatus[] = ['draft', 'menunggu_sopir', 'aktif', 'selesai']
