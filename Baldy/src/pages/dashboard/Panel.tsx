import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Panel kertas di bawah papan depo: polos, tanpa bayangan, judul berhuruf rambu. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex h-full flex-col rounded-xl border border-hairline bg-surface', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-rail text-[18px] leading-tight font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0 pt-0.5">{actions}</div>}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  )
}

/** Tautan kecil di pojok kanan judul panel. */
export function TautanPanel({ children }: { children: ReactNode }) {
  return <span className="text-[12.5px] font-medium text-brand-700 hover:underline">{children}</span>
}
