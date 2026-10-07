import { cn } from '../../lib/utils'
import { formatNumber, formatRupiah } from '../../lib/format'
import { Panel } from './Panel'

/**
 * Perubahan dibanding bulan lalu. Naik = baik untuk pendapatan & netto; untuk uang
 * yang keluar (`keluar`) warnanya dibalik: naik merah, turun hijau.
 */
function Selisih({ persen, bulanLalu, keluar }: { persen: number | null; bulanLalu: string; keluar?: boolean }) {
  if (persen === null || !Number.isFinite(persen)) return null
  const baik = keluar ? persen < 0 : persen > 0
  const rata = Math.abs(persen) < 0.05
  return (
    <span className={cn('tnum block text-[11.5px]', rata ? 'text-ink-3' : baik ? 'text-[#0a7d0a]' : 'text-[color:var(--color-critical)]')}>
      {rata ? 'sama dengan' : `${persen > 0 ? '+' : ''}${persen.toFixed(1).replace('.', ',')}% dari`} {bulanLalu}
    </span>
  )
}

interface Baris {
  label: string
  keterangan: string
  nilai: number
  /** Posisi batang pada lintasan, dalam proporsi pendapatan. */
  dari: number
  sampai: number
  jenis: 'masuk' | 'kurang' | 'hasil'
  persen?: number | null
}

/**
 * Jembatan uang: bagaimana pendapatan bulan ini menjadi netto, dan berapa
 * uang yang benar-benar keluar ke sopir.
 */
export function JembatanUang({
  bulanLalu,
  pendapatan,
  ditagihkan,
  uangJalan,
  biayaPerusahaan,
  komisi,
  netto,
  deltaPendapatan,
  deltaUangJalan,
  deltaKomisi,
  deltaNetto,
  deltaUj,
  deltaBiaya,
  uj,
  kasbon,
  tf,
  termin,
  biaya,
}: {
  bulanLalu: string
  pendapatan: number
  /** Biaya di jalan yang ditagihkan kembali ke klien (Additional Cost PI). */
  ditagihkan: number
  uangJalan: number
  /** Biaya di jalan yang dibayar perusahaan langsung, di luar uang jalan. */
  biayaPerusahaan: number
  komisi: number
  netto: number
  deltaPendapatan: number | null
  deltaUangJalan: number | null
  deltaKomisi: number | null
  deltaNetto: number | null
  deltaUj: number | null
  deltaBiaya: number | null
  uj: number
  kasbon: number
  tf: number
  termin: number
  biaya: number
}) {
  const masuk = pendapatan + ditagihkan
  const perjalanan = uangJalan + biayaPerusahaan
  const skala = Math.max(masuk, perjalanan + komisi, 1)
  const p = (v: number) => Math.max(0, Math.min(1, v / skala))
  const baris: Baris[] = [
    { label: 'Pendapatan', keterangan: 'jumlah harga trip', nilai: pendapatan, dari: 0, sampai: p(pendapatan), jenis: 'masuk', persen: deltaPendapatan },
    { label: 'Ditagihkan ke klien', keterangan: 'tol, solar, SPSI, nginap', nilai: ditagihkan, dari: p(pendapatan), sampai: p(masuk), jenis: 'masuk' },
    { label: 'Uang jalan', keterangan: 'dibayar ke sopir; patokan bila masih jalan', nilai: -uangJalan, dari: p(masuk - uangJalan), sampai: p(masuk), jenis: 'kurang', persen: deltaUangJalan },
    ...(biayaPerusahaan > 0 ? [{ label: 'Dibayar perusahaan', keterangan: 'solar / tol di luar uang jalan', nilai: -biayaPerusahaan, dari: p(masuk - perjalanan), sampai: p(masuk - uangJalan), jenis: 'kurang' as const }] : []),
    { label: 'Komisi sopir', keterangan: 'dari master Komisi', nilai: -komisi, dari: p(masuk - perjalanan - komisi), sampai: p(masuk - perjalanan), jenis: 'kurang', persen: deltaKomisi },
    { label: 'Netto', keterangan: 'sisa untuk perusahaan', nilai: netto, dari: 0, sampai: p(netto), jenis: 'hasil', persen: deltaNetto },
  ]
  const ke_sopir: Array<[string, number, string, (number | null)?]> = [
    ['Uang jalan dibayar', uj, `${formatNumber(termin)} termin`, deltaUj],
    ['Potong kasbon', kasbon, 'dipotong dari uang jalan'],
    ['Transfer ke sopir', tf, 'uang jalan − potong kasbon'],
    ['Biaya operasional', biaya, 'nota solar, tol, SPSI, nginap', deltaBiaya],
  ]

  return (
    <Panel title="Dari pendapatan ke netto" subtitle="Biaya di jalan dibayar dari uang jalan, kecuali yang dibayar perusahaan langsung; yang ditagihkan ke klien menambah pendapatan.">
      <div className="space-y-3 px-5 pb-5">
        {baris.map((b) => (
          <div key={b.label} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[10.5rem_minmax(0,1fr)_9.5rem]">
            <div className="leading-tight">
              <span className={cn('block text-[13.5px]', b.jenis === 'hasil' ? 'font-semibold text-ink' : 'text-ink')}>{b.label}</span>
              <span className="block text-[11.5px] text-ink-3">{b.keterangan}</span>
            </div>
            <div className="relative h-6 rounded-[3px] bg-sunken" aria-hidden="true">
              <div
                className={cn('absolute inset-y-0 rounded-[3px]',
                  b.jenis === 'masuk' && 'bg-brand-600',
                  b.jenis === 'kurang' && 'bg-[#b9c6d6]',
                  b.jenis === 'hasil' && (b.nilai >= 0 ? 'bg-[#1f9d55]' : 'bg-[color:var(--color-critical)]'))}
                style={{ left: `${b.dari * 100}%`, width: `${Math.max(b.sampai - b.dari, b.nilai ? 0.004 : 0) * 100}%` }}
              />
            </div>
            <div className="text-right sm:text-right">
              <span className={cn('tnum block font-rail text-[19px] leading-tight font-semibold',
                b.jenis === 'kurang' ? 'text-ink-2' : b.jenis === 'hasil' && b.nilai < 0 ? 'text-[color:var(--color-critical)]' : 'text-ink')}>
                {b.jenis === 'kurang' ? `− ${formatRupiah(-b.nilai, { compact: true })}` : formatRupiah(b.nilai, { compact: true })}
              </span>
              {b.persen !== undefined && <Selisih persen={b.persen} bulanLalu={bulanLalu} keluar={b.jenis === 'kurang'} />}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-hairline px-5 py-4">
        <h3 className="text-[12.5px] font-medium text-ink-2">Uang yang keluar ke sopir bulan ini</h3>
        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
          {ke_sopir.map(([label, nilai, ket, persen]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[12px] text-ink-3">{label}</dt>
              <dd className="tnum font-rail text-[19px] leading-tight font-semibold text-ink">{formatRupiah(nilai, { compact: true })}</dd>
              {persen !== undefined && <dd><Selisih persen={persen} bulanLalu={bulanLalu} keluar /></dd>}
              <dd className="text-[11.5px] text-ink-3">{ket}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}
