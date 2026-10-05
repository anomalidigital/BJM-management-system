import { Link } from 'react-router-dom'
import { formatNumber } from '../../lib/format'
import { Panel, TautanPanel } from './Panel'

export interface BarisRitan {
  id: string
  nama: string
  keterangan: string
  ritan: number
}

/** Peringkat sopir menurut jumlah ritan bulan ini. Nomor urut memang peringkat. */
export function PapanRitan({ rows, bulan }: { rows: BarisRitan[]; bulan: string }) {
  const tertinggi = Math.max(1, ...rows.map((r) => r.ritan))
  return (
    <Panel
      title="Ritan sopir"
      subtitle={`Sopir dengan trip terbanyak, ${bulan}.`}
      actions={<Link to="/laporan/ritan"><TautanPanel>Cek ritan</TautanPanel></Link>}
    >
      {rows.length === 0 ? (
        <p className="px-5 pb-6 text-[13px] text-ink-3">Belum ada trip bulan ini.</p>
      ) : (
        <ol className="space-y-3 px-5 pb-5">
          {rows.map((r, i) => (
            <li key={r.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3">
              <span className="tnum font-rail text-[15px] font-semibold text-ink-3">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium text-ink">{r.nama}</span>
                  {r.keterangan && <span className="tnum shrink-0 text-[11.5px] text-ink-3">{r.keterangan}</span>}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-sunken" aria-hidden="true">
                  <div className="h-full rounded-full bg-nav-700" style={{ width: `${(r.ritan / tertinggi) * 100}%` }} />
                </div>
              </div>
              <span className="tnum font-rail text-[20px] leading-none font-semibold text-ink">
                {formatNumber(r.ritan)}<span className="ml-0.5 text-[11.5px] font-medium text-ink-3">rit</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
