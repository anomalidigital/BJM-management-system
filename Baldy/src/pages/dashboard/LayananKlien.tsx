import { Link } from 'react-router-dom'
import { formatNumber, formatRupiah } from '../../lib/format'
import { Panel, TautanPanel } from './Panel'

export interface KontrakBerjalan {
  id: string
  nomor: string
  klienId: string
  klien: string
  nilai: number
  sisa: number
}

/**
 * Dua cara BJM melayani klien: Callout untuk klien tetap (order per perjalanan)
 * dan Dedicated untuk klien kontrak.
 */
export function LayananKlien({
  callout,
  dedicated,
  kontrak,
}: {
  callout: { trip: number; pendapatan: number }
  dedicated: { trip: number }
  kontrak: KontrakBerjalan[]
}) {
  const total = Math.max(1, callout.trip + dedicated.trip)
  const layanan = [
    { nama: 'Callout', ket: 'klien tetap, order per perjalanan', trip: callout.trip, warna: 'bg-brand-600', tambahan: callout.pendapatan ? formatRupiah(callout.pendapatan, { compact: true }) : '' },
    { nama: 'Dedicated', ket: 'klien kontrak', trip: dedicated.trip, warna: 'bg-nav-700', tambahan: '' },
  ]

  return (
    <Panel
      title="Layanan & klien"
      subtitle="Pembagian trip bulan ini dan kontrak yang masih berjalan."
      actions={<Link to="/master/klien"><TautanPanel>Buka Klien</TautanPanel></Link>}
    >
      <div className="space-y-3 px-5">
        {layanan.map((l) => (
          <div key={l.nama}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] text-ink">
                {l.nama} <span className="text-[12px] text-ink-3">{l.ket}</span>
              </span>
              <span className="tnum font-rail text-[19px] leading-none font-semibold text-ink">
                {formatNumber(l.trip)}<span className="ml-1 text-[12px] font-medium text-ink-3">trip</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-sunken" aria-hidden="true">
              <div className={`h-full rounded-full ${l.warna}`} style={{ width: `${(l.trip / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-hairline px-5 py-4">
        <h3 className="text-[12.5px] font-medium text-ink-2">Kontrak Dedicated berjalan</h3>
        {kontrak.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-3">
            Belum ada kontrak berjalan di workspace ini. Kontrak ditambahkan dari halaman klien kontrak.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-3">
            {kontrak.slice(0, 3).map((k) => (
              <li key={k.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <Link to={`/master/klien/${k.klienId}`} className="min-w-0 truncate text-[13px] text-ink hover:text-brand-700 hover:underline">
                    <span className="tnum font-medium">{k.nomor}</span> <span className="text-ink-3">{k.klien}</span>
                  </Link>
                  <span className="tnum shrink-0 text-[12.5px] text-ink-2">
                    sisa <span className="font-semibold text-ink">{formatRupiah(k.sisa, { compact: true })}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-sunken" aria-hidden="true">
                  <div
                    className={k.sisa < 0 ? 'h-full rounded-full bg-[color:var(--color-critical)]' : 'h-full rounded-full bg-[#1f9d55]'}
                    style={{ width: `${Math.max(0, Math.min(1, k.sisa / Math.max(1, k.nilai))) * 100}%` }}
                  />
                </div>
                <span className="tnum mt-1 block text-[11.5px] text-ink-3">dari nilai kontrak {formatRupiah(k.nilai, { compact: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
