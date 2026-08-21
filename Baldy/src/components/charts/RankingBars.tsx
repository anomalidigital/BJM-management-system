import { VIZ } from './chartUtils'
import { formatNumber } from '../../lib/format'

export interface RankRow {
  id: string
  label: string
  meta?: string
  value: number
}

/**
 * Bar ranking horizontal, satu seri (mis. Top Sopir berdasarkan jumlah ritan).
 * Nilai ditulis langsung di ujung bar, jadi tidak perlu sumbu X.
 */
export function RankingBars({ rows, unit = '' }: { rows: RankRow[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)

  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.id} className="grid grid-cols-[1.35rem_minmax(0,1fr)_auto] items-center gap-2.5">
          <span className="tnum text-[12px] font-semibold text-ink-3">{i + 1}.</span>
          <span className="min-w-0">
            <span className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-medium text-ink">{r.label}</span>
              {r.meta && <span className="shrink-0 text-[11.5px] text-ink-3">{r.meta}</span>}
            </span>
            <span className="block h-2 w-full overflow-hidden rounded-full bg-grid">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max((r.value / max) * 100, 3)}%`, background: VIZ.series1 }}
              />
            </span>
          </span>
          <span className="tnum text-[13px] font-semibold whitespace-nowrap text-ink">
            {formatNumber(r.value)}
            {unit && <span className="ml-1 text-[11.5px] font-normal text-ink-3">{unit}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}
