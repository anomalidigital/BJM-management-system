import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('shadow-card rounded-xl border border-hairline bg-surface', className)}>{children}</section>
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] leading-tight font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4', className)}>{children}</div>
}

/** Blok kanan-kiri untuk menampilkan pasangan label + nilai. */
export function InfoItem({ label, value, mono }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-[13px] font-medium text-ink', mono && 'tnum')}>{value}</dd>
    </div>
  )
}
