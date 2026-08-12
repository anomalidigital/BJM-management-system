import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

export function Modal({ open, onClose, title, subtitle, footer, size = 'md', children }: ModalProps) {
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
    <div className="no-print fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="animate-in-fade fixed inset-0 bg-ink/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('animate-in-pop relative my-auto w-full rounded-xl border border-hairline bg-surface shadow-pop', SIZES[size])}
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
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 rounded-b-xl border-t border-hairline bg-sunken px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  title?: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Dialog konfirmasi — dipakai untuk semua aksi hapus (UX Rules bagian 16). */
export function ConfirmDialog({
  open,
  title = 'Hapus Data?',
  message = 'Data yang sudah dihapus mungkin tidak dapat dikembalikan.',
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  tone = 'danger',
  loading,
  onCancel,
  onConfirm,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-2">{message}</p>
    </Modal>
  )
}
