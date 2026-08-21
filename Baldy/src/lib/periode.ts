/**
 * Penentu periode default laporan.
 *
 * Data operasional tidak selalu berakhir di bulan berjalan. Kalau laporan selalu
 * memakai bulan kalender hari ini, halaman bisa tampak kosong padahal datanya ada.
 * Jadi periode default mengikuti bulan terakhir yang benar-benar punya transaksi.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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

/**
 * State periode untuk halaman laporan.
 *
 * Nilai awal tidak bisa langsung dipakai karena saat render pertama data
 * belum selesai dimuat — periode akan jatuh ke bulan kalender dan laporan
 * tampak kosong. Karena itu periode disetel ulang sekali begitu data tiba,
 * selama pengguna belum mengubahnya sendiri.
 */
export function usePeriodeDefault(tanggal: string[]) {
  const kunci = tanggal.length === 0 ? '' : `${tanggal.length}:${tanggal.reduce((a, b) => (a > b ? a : b), '')}`
  const periode = useMemo(() => periodeAktif(tanggal), [kunci]) // eslint-disable-line react-hooks/exhaustive-deps

  const [from, setFrom] = useState(periode.start)
  const [to, setTo] = useState(periode.end)
  const sudahDisetel = useRef(false)

  useEffect(() => {
    if (sudahDisetel.current || tanggal.length === 0) return
    sudahDisetel.current = true
    setFrom(periode.start)
    setTo(periode.end)
  }, [periode, tanggal.length])

  return { from, setFrom, to, setTo, reset: () => { setFrom(periode.start); setTo(periode.end) } }
}
