import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface MenuAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

/** Menu overflow ringkas untuk aksi sekunder pada baris tabel. */
export function OverflowMenu({ actions, label = 'Aksi lainnya' }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={cn(
          'inline-flex h-7.5 w-7.5 items-center justify-center rounded-md border border-transparent text-ink-3 transition-colors hover:border-hairline hover:bg-sunken hover:text-ink',
          open && 'border-hairline bg-sunken text-ink',
        )}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div
          className="animate-in-pop absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-hairline bg-surface py-1 shadow-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                setOpen(false)
                a.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-40',
                a.tone === 'danger' ? 'text-[color:var(--color-critical)] hover:bg-[#fdf2f2]' : 'text-ink-2 hover:bg-sunken hover:text-ink',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
