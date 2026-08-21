import { useState } from 'react'
import { VIZ, areaPath, linePath, niceScale, useMeasure } from './chartUtils'
import { compactNumber, formatRupiah } from '../../lib/format'

export interface Series {
  name: string
  color: string
  values: number[]
}

/**
 * Line chart 2 seri pada SATU sumbu Y.
 * Dipakai untuk Pendapatan vs Komisi -- keduanya dalam Rupiah, jadi tidak
 * pernah butuh sumbu ganda.
 */
export function LineChart({ labels, series, height = 210 }: { labels: string[]; series: Series[]; height?: number }) {
  const { ref, width } = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const padL = 52
  const padR = 12
  const padT = 12
  const padB = 22
  const w = Math.max(width, 280)
  const innerW = w - padL - padR
  const innerH = height - padT - padB

  const maxValue = Math.max(...series.flatMap((s) => s.values), 1)
  const { max, ticks } = niceScale(maxValue)
  const step = labels.length > 1 ? innerW / (labels.length - 1) : 0
  const x = (i: number) => padL + i * step
  const y = (v: number) => padT + innerH - (v / max) * innerH

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={`Grafik ${series.map((s) => s.name).join(' dan ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={VIZ.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {compactNumber(t)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke={VIZ.axis} strokeWidth={1} />

        {series.map((s) => {
          const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }))
          return (
            <g key={s.name}>
              <path d={areaPath(pts, padT + innerH)} fill={s.color} opacity={0.1} />
              <path d={linePath(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke={VIZ.axis} strokeWidth={1} />
        )}

        {/* end-marker: r=4.5 dengan ring 2px warna surface agar tetap terbaca */}
        {series.map((s) => {
          const i = hover ?? s.values.length - 1
          return (
            <circle key={`m-${s.name}`} cx={x(i)} cy={y(s.values[i])} r={4.5} fill={s.color} stroke={VIZ.surface} strokeWidth={2} />
          )
        })}

        {labels.map((l, i) => {
          const every = Math.ceil(labels.length / Math.max(3, Math.floor(innerW / 62)))
          if (i % every !== 0 && i !== labels.length - 1) return null
          return (
            <text key={`${l}-${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10.5} fill={VIZ.muted}>
              {l}
            </text>
          )
        })}

        {labels.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - step / 2}
            y={padT}
            width={Math.max(step, 8)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-[168px] -translate-x-1/2 rounded-md border border-hairline bg-surface px-2.5 py-2 shadow-pop"
          style={{ left: Math.min(Math.max(x(hover), 92), w - 92), top: 0 }}
        >
          <p className="mb-1 text-[11px] font-medium text-ink-3">{labels[hover]}</p>
          {series.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-4 py-px">
              <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="tnum text-[12px] font-semibold text-ink">{formatRupiah(s.values[hover], { compact: true })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
