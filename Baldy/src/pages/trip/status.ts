import type { TripStatus } from '../../types'

export const STATUS_LABEL: Record<TripStatus, string> = { draft: 'Draft', aktif: 'Aktif', selesai: 'Selesai', batal: 'Dibatalkan' }
export const STATUS_TONE: Record<TripStatus, 'neutral' | 'brand' | 'good' | 'critical'> = {
  draft: 'neutral', aktif: 'brand', selesai: 'good', batal: 'critical',
}

/** Status yang boleh dipilih di form. "Dibatalkan" hanya lewat tombol Batalkan Trip. */
export const STATUS_FORM: TripStatus[] = ['draft', 'aktif', 'selesai']
