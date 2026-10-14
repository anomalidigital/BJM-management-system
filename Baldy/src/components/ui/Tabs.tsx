import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface TabItem {
  id: string
  label: string
  badge?: ReactNode
}

/** Tab bergaris bawah (Bootstrap .nav-underline); bisa digeser di layar sempit. */
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
    <div role="tablist" className={cn('nav nav-underline', className)}>
      {items.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn('nav-link', active && 'active')}
          >
            {t.label}
            {t.badge != null && <span className="jumlah">{t.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
