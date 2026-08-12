import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  footer?: ReactNode
  width?: string
  children: ReactNode
}

/** Panel geser dari kanan — dipakai untuk detail record & form panjang. */
export function Drawer({ open, onClose, title, subtitle, footer, width = 'max-w-lg', children }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="no-print fixed inset-0 z-[90] flex justify-end">
      <div className="animate-in-fade absolute inset-0 bg-ink/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn('animate-in-drawer relative flex h-full w-full flex-col border-l border-hairline bg-surface shadow-pop', width)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] leading-tight font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-mt-1 -mr-1 rounded-md p-1.5 text-ink-3 transition hover:bg-sunken hover:text-ink"
          >
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-hairline bg-sunken px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  )
}
