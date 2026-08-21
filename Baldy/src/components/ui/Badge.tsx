import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Tone = 'neutral' | 'brand' | 'good' | 'warning' | 'critical' | 'serious'

const TONES: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2 border-hairline',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  good: 'bg-[#effaef] text-[#0a7d0a] border-[#cfeccf]',
  warning: 'bg-[#fff8e6] text-[#8a6100] border-[#f6e2ac]',
  serious: 'bg-[#fdf1eb] text-[#9c4a22] border-[#f6d8c8]',
  critical: 'bg-[#fdf2f2] text-[#b02c2c] border-[#f3d5d5]',
}

/**
 * Status selalu tampil sebagai warna + teks (dan ikon bila ada),
 * tidak pernah warna saja.
 */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] leading-4 font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Titik kecil + label, untuk legend chart dan status ringkas. */
export function DotLabel({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}
