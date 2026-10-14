import type { TripStatus } from '../../types'

export const STATUS_LABEL: Record<TripStatus, string> = {
  draft: 'Draft', menunggu_sopir: 'Menunggu Supir', aktif: 'Aktif', selesai: 'Selesai', batal: 'Dibatalkan',
}
export const STATUS_TONE: Record<TripStatus, 'neutral' | 'warning' | 'brand' | 'good' | 'critical'> = {
  draft: 'neutral', menunggu_sopir: 'warning', aktif: 'brand', selesai: 'good', batal: 'critical',
}

/** Urutan alur trip, dipakai filter dan pilihan status. */
export const STATUS_URUT: TripStatus[] = ['draft', 'menunggu_sopir', 'aktif', 'selesai', 'batal']

/** Status yang boleh dipilih di form. "Dibatalkan" hanya lewat tombol Batalkan Trip. */
export const STATUS_FORM: TripStatus[] = ['draft', 'menunggu_sopir', 'aktif', 'selesai']

/**
 * Karawang tidak memakai status Draft (keputusan 12 Okt 2026). Trip lama yang masih
 * berstatus draft tetap tampil, jadi pilihan Draft hanya muncul bila memang ada isinya.
 */
export const STATUS_URUT_KARAWANG: TripStatus[] = STATUS_URUT.filter((s) => s !== 'draft')
export const STATUS_FORM_KARAWANG: TripStatus[] = STATUS_FORM.filter((s) => s !== 'draft')

/** Pilihan filter status: Karawang tanpa Draft, kecuali masih ada trip draft. */
export function pilihanStatus(karawang: boolean, adaDraft: boolean): TripStatus[] {
  return karawang && !adaDraft ? STATUS_URUT_KARAWANG : STATUS_URUT
}

/** Trip yang bisa ditutup lewat Tutup Trip (Karawang): yang masih aktif atau menunggu supir. */
export const bisaDitutup = (s: TripStatus) => s === 'aktif' || s === 'menunggu_sopir'
