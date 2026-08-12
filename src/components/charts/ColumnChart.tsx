import { useState } from 'react'
import { VIZ, niceScale, useMeasure } from './chartUtils'
import { formatNumber } from '../../lib/format'

export interface ColumnPoint {
  label: string
  value: number
  /** Label penuh untuk tooltip (mis. tanggal lengkap). */
  fullLabel?: string
}

/**
 * Column chart satu seri (mis. jumlah transaksi per hari).
 * Satu seri -> tidak perlu legend; judul card sudah menyebut isinya.
 */
export function ColumnChart({ data, height = 200, valueSuffix = '' }: { data: ColumnPoint[]; height?: number; valueSuffix?: string }) {
  const { ref, width } = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const padL = 38
  const padR = 8
  const padT = 10
  const padB = 22
  const w = Math.max(width, 260)
  const innerW = w - padL - padR
  const innerH = height - padT - padB

  const { max, ticks } = niceScale(Math.max(...data.map((d) => d.value), 1))
  const band = data.length > 0 ? innerW / data.length : innerW
  const barW = Math.min(24, Math.max(3, band - 2)) // sisakan gap 2px antar kolom

  const y = (v: number) => padT + innerH - (v / max) * innerH
  const active = hover !== null ? data[hover] : null

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label="Grafik jumlah transaksi per hari">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={VIZ.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke={VIZ.axis} strokeWidth={1} />

        {data.map((d, i) => {
          const cx = padL + i * band + band / 2
          const barH = Math.max(d.value > 0 ? 2 : 0, padT + innerH - y(d.value))
          const r = Math.min(4, barW / 2)
          const top = padT + innerH - barH
          // sudut atas membulat 4px, dasar tetap siku di baseline
          const path =
            barH <= r
              ? `M${cx - barW / 2},${top} h${barW} v${barH} h${-barW} Z`
              : `M${cx - barW / 2},${top + r} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${barH - r} h${-barW} Z`
          return (
            <g key={d.label}>
              {/* hit target lebih lebar dari kolomnya */}
              <rect
                x={padL + i * band}
                y={padT}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <path d={path} fill={VIZ.series1} opacity={hover === null || hover === i ? 1 : 0.45} pointerEvents="none" />
            </g>
          )
        })}

        {data.map((d, i) => {
          // Label sumbu X dijarangkan supaya tidak bertabrakan.
          const every = Math.ceil(data.length / Math.max(4, Math.floor(innerW / 46)))
          if (i % every !== 0 && i !== data.length - 1) return null
          return (
            <text
              key={`lbl-${d.label}`}
              x={padL + i * band + band / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={10.5}
              fill={VIZ.muted}
            >
              {d.label}
            </text>
          )
        })}
      </svg>

      {active && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-hairline bg-surface px-2.5 py-1.5 shadow-pop"
          style={{ left: Math.min(Math.max(padL + hover * band + band / 2, 60), w - 60), top: 0 }}
        >
          <p className="text-[11px] font-medium text-ink-3">{active.fullLabel ?? active.label}</p>
          <p className="tnum text-[13px] font-semibold text-ink">
            {formatNumber(active.value)}
            {valueSuffix}
          </p>
        </div>
      )}
    </div>
  )
}
