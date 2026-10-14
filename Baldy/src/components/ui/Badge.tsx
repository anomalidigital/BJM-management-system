import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Tone = 'neutral' | 'brand' | 'good' | 'warning' | 'critical' | 'serious'

/**
 * Status selalu tampil sebagai warna + teks (dan ikon bila ada), tidak pernah warna saja.
 * Badge Bootstrap (.badge) dengan nada lunak SIKOTIS (.badge-good, .badge-warning, ...).
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
    <span className={cn('badge', `badge-${tone}`, className)}>
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
