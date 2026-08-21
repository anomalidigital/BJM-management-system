import { useEffect, useRef, useState } from 'react'

/** Warna chart — satu tempat, mengacu ke token di index.css. */
export const VIZ = {
  series1: '#2a78d6',
  series2: '#eb6834',
  series3: '#1baf7a',
  surface: '#ffffff',
  grid: '#eceef1',
  axis: '#c3c2b7',
  muted: '#898781',
  ink2: '#52514e',
} as const

/** Ukur lebar container supaya SVG ikut responsif tanpa mendistorsi teks. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  return { ref, width }
}

/** Skala sumbu Y dengan angka bulat (0 / 1.000 / 2.000 ...). */
export function niceScale(max: number, tickCount = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] }
  const rough = max / tickCount
  const mag = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { max: niceMax, ticks }
}

/** Path garis lurus antar titik (tanpa smoothing, agar nilai tidak "dikarang"). */
export function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

export function areaPath(points: Array<{ x: number; y: number }>, baseline: number): string {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${linePath(points)} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`
}
