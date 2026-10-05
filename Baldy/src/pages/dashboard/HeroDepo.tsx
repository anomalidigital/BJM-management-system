import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { formatNumber } from '../../lib/format'
import { STATUS_LABEL } from '../trip/status'

/** Status yang dihitung di papan, urut dari dasar tumpukan ke atas. */
export const URUT_TUMPUK = ['selesai', 'aktif', 'menunggu_sopir', 'draft'] as const
export type StatusPapan = (typeof URUT_TUMPUK)[number]

/** Warna status di atas pelat baja: hijau beres, biru di jalan, kuning perlu sopir, abu belum mulai. */
export const WARNA_STATUS: Record<StatusPapan, string> = {
  selesai: '#46c58a',
  aktif: '#6fb5ff',
  menunggu_sopir: 'var(--color-signal)',
  draft: '#8da2bf',
}

export interface HariPapan {
  iso: string
  tanggal: number
  /** "Sel, 9 Sep" untuk keterangan. */
  label: string
  trip: Array<{ id: string; status: StatusPapan }>
  /** Hari setelah hari ini: belum terjadi. */
  mendatang: boolean
  hariIni: boolean
}

const TINGGI_PAPAN = 148
const JARAK = 2
/** Ruang angka jumlah trip di atas tiap tumpukan. */
const RUANG_ANGKA = 14

/** Draft = kontainer kosong: hanya garis tepi, tanpa isi dan rusuk. */
const KOSONG = { background: 'transparent', backgroundImage: 'none', boxShadow: `inset 0 0 0 1.5px ${WARNA_STATUS.draft}` }
const isi = (s: StatusPapan) => (s === 'draft' ? KOSONG : { background: WARNA_STATUS[s] })

/**
 * Papan depo: trip sebulan sebagai tumpukan kontainer per hari.
 * Satu kotak = satu trip, warnanya status trip itu.
 */
export function HeroDepo({
  bulan,
  bulanLalu,
  jumlah,
  jumlahLalu,
  deltaTrip,
  perStatus,
  batal,
  hari,
  sopirBertugas,
  sopirAktif,
  karyawanAktif,
  karyawanTotal,
  mobilTerpakai,
  mobilTotal,
}: {
  bulan: string
  bulanLalu: string
  jumlah: number
  jumlahLalu: number
  /** Persen perubahan jumlah trip dari bulan lalu; null bila bulan lalu kosong. */
  deltaTrip: number | null
  perStatus: Record<StatusPapan, number>
  batal: number
  hari: HariPapan[]
  sopirBertugas: number
  sopirAktif: number
  /** Semua karyawan (sopir + manager), seperti kartu "Total Sopir Aktif" dulu. */
  karyawanAktif: number
  karyawanTotal: number
  mobilTerpakai: number
  mobilTotal: number
}) {
  const tertinggi = Math.max(1, ...hari.map((h) => h.trip.length))
  const tinggiKotak = Math.max(3, Math.min(18, Math.floor((TINGGI_PAPAN - RUANG_ANGKA - (tertinggi - 1) * JARAK) / tertinggi)))
  const selisih = jumlah - jumlahLalu
  const persen = deltaTrip !== null && Number.isFinite(deltaTrip) && selisih !== 0
    ? `, ${selisih > 0 ? 'naik' : 'turun'} ${Math.abs(deltaTrip).toFixed(1).replace('.', ',')}%`
    : ''
  const angka: Array<[string, number, string]> = [
    ['Sopir bertugas', sopirBertugas, `dari ${formatNumber(sopirAktif)} sopir aktif`],
    ['Karyawan aktif', karyawanAktif, `dari ${formatNumber(karyawanTotal)} terdaftar`],
    ['Mobil terpakai', mobilTerpakai, `dari ${formatNumber(mobilTotal)} aktif`],
  ]
  const ringkas = URUT_TUMPUK.filter((s) => perStatus[s] > 0)
    .map((s) => `${perStatus[s]} ${STATUS_LABEL[s].toLowerCase()}`)
    .join(', ')
  let urut = 0

  return (
    <section className="rail-steel relative flex h-full flex-col overflow-hidden rounded-xl text-white" aria-labelledby="papan-judul">
      <div className="grid flex-1 gap-6 p-5 md:grid-cols-[14.5rem_minmax(0,1fr)] md:p-6">
        <div className="flex flex-col">
          <h2 id="papan-judul" className="font-rail text-[15px] font-semibold text-nav-ink">Trip {bulan}</h2>
          <p className="mt-1 font-stencil text-[88px] leading-[.82] font-extrabold tracking-[.02em] text-white tnum">
            {formatNumber(jumlah)}
          </p>
          <p className="mt-3 text-[12.5px] leading-snug text-nav-ink">
            {jumlahLalu > 0
              ? <>{selisih === 0 ? 'Sama dengan' : selisih > 0 ? `${formatNumber(selisih)} lebih banyak dari` : `${formatNumber(-selisih)} lebih sedikit dari`} {bulanLalu} ({formatNumber(jumlahLalu)} trip){persen}.</>
              : `Belum ada trip di ${bulanLalu} untuk dibandingkan.`}
            {batal > 0 && <> {formatNumber(batal)} trip dibatalkan tidak dihitung.</>}
          </p>
          <dl className="mt-auto space-y-2 border-t border-white/10 pt-4">
            {angka.map(([label, nilai, dari]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-[12px] text-nav-ink">{label}</dt>
                <dd className="tnum text-right text-[12px] text-nav-ink">
                  <span className="font-rail text-[19px] leading-none font-semibold text-white">{formatNumber(nilai)}</span> {dari}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex min-w-0 flex-col">
          {/* Lajur status: proporsi trip per status, berikut keterangannya. */}
          <div className="flex h-8 overflow-hidden rounded-md bg-white/[.06] ring-1 ring-white/10" aria-hidden="true">
            {URUT_TUMPUK.map((s) => perStatus[s] > 0 && (
              <div
                key={s}
                className={cn(
                  'flex items-center justify-center overflow-hidden border-r border-[color:var(--color-nav-900)] text-[12.5px] font-semibold last:border-r-0',
                  s === 'draft' ? 'rounded-r-md text-white' : 'text-[#0d2240]',
                )}
                style={{ flexGrow: perStatus[s], ...isi(s) }}
              >
                {perStatus[s] / Math.max(1, jumlah) >= 0.09 && <span className="tnum font-rail text-[14px]">{perStatus[s]}</span>}
              </div>
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-nav-ink">
            {URUT_TUMPUK.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px]" style={isi(s)} aria-hidden="true" />
                {STATUS_LABEL[s]}
                <span className="tnum font-rail text-[14px] font-semibold text-white">{formatNumber(perStatus[s])}</span>
              </li>
            ))}
          </ul>

          {/* Tumpukan kontainer per hari. */}
          <div
            className="relative mt-5 flex items-end gap-[3px] border-b border-white/20"
            style={{ height: TINGGI_PAPAN }}
            role="img"
            aria-label={`Trip per hari selama ${bulan}: ${formatNumber(jumlah)} trip${ringkas ? `, ${ringkas}` : ''}.`}
          >
            {hari.map((h) => (
              <div
                key={h.iso}
                className={cn('flex h-full min-w-0 flex-1 flex-col-reverse', h.mendatang && 'opacity-60')}
                style={{ gap: JARAK }}
                title={h.trip.length
                  ? `${h.label}: ${URUT_TUMPUK.map((s) => [s, h.trip.filter((t) => t.status === s).length] as const).filter(([, n]) => n).map(([s, n]) => `${n} ${STATUS_LABEL[s].toLowerCase()}`).join(', ')}`
                  : `${h.label}: ${h.mendatang ? 'belum terjadi' : 'tidak ada trip'}`}
              >
                {h.mendatang && <div className="h-[3px] rounded-full border-t border-dashed border-white/25" />}
                {h.trip.map((t) => (
                  <div
                    key={t.id}
                    className="blok-kontainer shrink-0 rounded-[2px]"
                    style={{ height: tinggiKotak, ...isi(t.status), ['--urut' as string]: urut++ }}
                  />
                ))}
                {/* Jumlah trip hari itu; di layar sempit kolomnya terlalu kecil untuk angka. */}
                {h.trip.length > 0 && (
                  <span
                    className={cn('tnum hidden text-center font-rail text-[11px] leading-none font-semibold sm:block', h.hariIni ? 'text-[color:var(--color-signal)]' : 'text-nav-ink')}
                    aria-hidden="true"
                  >
                    {h.trip.length}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px] text-[11px] text-nav-ink" aria-hidden="true">
            {hari.map((h) => (
              <span key={h.iso} className={cn('tnum min-w-0 flex-1 text-center', h.hariIni && 'font-semibold text-[color:var(--color-signal)]')}>
                {h.hariIni || h.tanggal === 1 || h.tanggal % 5 === 0 ? h.tanggal : ''}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-nav-ink">
            <span>Satu kotak = satu trip, ditumpuk per tanggal. Kotak kosong = draft.</span>
            <Link to="/transaksi/trip" className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
              Buka daftar trip
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
