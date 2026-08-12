import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface TabItem {
  id: string
  label: string
  badge?: ReactNode
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex items-end gap-1 border-b border-hairline', className)}>
      {items.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
              active
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-ink-3 hover:border-hairline hover:text-ink',
            )}
          >
            {t.label}
            {t.badge != null && (
              <span
                className={cn(
                  'tnum rounded-full px-1.5 py-px text-[11px] font-semibold',
                  active ? 'bg-brand-100 text-brand-700' : 'bg-sunken text-ink-3',
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
