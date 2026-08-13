/**
 * Penentu periode default laporan.
 *
 * Data operasional tidak selalu berakhir di bulan berjalan. Kalau laporan selalu
 * memakai bulan kalender hari ini, halaman bisa tampak kosong padahal datanya ada.
 * Jadi periode default mengikuti bulan terakhir yang benar-benar punya transaksi.
 */
import { endOfMonthISO, startOfMonthISO, todayISO } from './format'

export interface Periode {
  start: string
  end: string
  /** Tanggal acuan, dipakai untuk menghitung bulan sebelumnya. */
  ref: Date
  /** true bila periode diambil dari data, bukan dari bulan kalender hari ini. */
  dariData: boolean
}

function periodeDari(iso: string, dariData: boolean): Periode {
  const ref = new Date(iso + 'T00:00:00')
  return { start: startOfMonthISO(ref), end: endOfMonthISO(ref), ref, dariData }
}

/** Bulan terakhir yang memiliki transaksi; jatuh ke bulan berjalan bila data kosong. */
export function periodeAktif(tanggal: string[]): Periode {
  const terakhir = tanggal.filter(Boolean).sort().at(-1)
  const kini = todayISO()
  if (!terakhir) return periodeDari(kini, false)
  // Bila data memang sampai bulan ini, pakai bulan ini seperti biasa.
  if (terakhir.slice(0, 7) === kini.slice(0, 7)) return periodeDari(kini, false)
  return periodeDari(terakhir, true)
}

/** Satu bulan sebelum periode yang diberikan, untuk pembanding. */
export function periodeSebelumnya(p: Periode): Periode {
  const ref = new Date(p.ref.getFullYear(), p.ref.getMonth() - 1, 1)
  return { start: startOfMonthISO(ref), end: endOfMonthISO(ref), ref, dariData: p.dariData }
}
