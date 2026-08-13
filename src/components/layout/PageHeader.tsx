import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
}

/** Judul halaman + breadcrumb + aksi utama. */
export function PageHeader({
  title,
  description,
  crumbs = [],
  actions,
}: {
  title: string
  description?: ReactNode
  crumbs?: Crumb[]
  actions?: ReactNode
}) {
  return (
    <header className="no-print mb-4">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-[12px] text-ink-3">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="text-ink-3/60" />}
              {c.to ? (
                <Link to={c.to} className="transition-colors hover:text-brand-600">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink-2">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[19px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
