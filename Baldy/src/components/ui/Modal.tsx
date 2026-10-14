import { useEffect } from 'react'
import type { ReactNode } from 'react'
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

/**
 * Dialog bergaya modal Bootstrap (.modal-content / -header / -body / -footer).
 * Buka-tutupnya diatur React, jadi JavaScript Bootstrap tidak dipakai.
 */
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
    <div className="modal no-print fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="animate-in-fade fixed inset-0 bg-ink/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className={cn('modal-content animate-in-pop relative my-auto w-full', SIZES[size])}>
        <header className="modal-header">
          <div className="min-w-0">
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="btn-close" />
        </header>
        {/* Setinggi layar dikurangi kepala, kaki, dan jarak tepi; form dirancang muat tanpa scroll (Baldy 14 Okt 2026). */}
        <div className="modal-body max-h-[calc(100dvh-12rem)] overflow-y-auto">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
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
