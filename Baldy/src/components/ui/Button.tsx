import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { FaFileLines } from './icons'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'outlineDanger'
type Size = 'sm' | 'md'

/** Varian tombol → kelas Bootstrap (btn-ghost & btn-subtle tambahan SIKOTIS, lihat styles/bootstrap.scss). */
const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-outline-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  subtle: 'btn-subtle',
  outlineDanger: 'btn-outline-danger',
}

const SIZES: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn('btn', VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

/** Tombol ikon kotak untuk kolom aksi di tabel. */
export function IconButton({
  label,
  icon,
  tone = 'default',
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn('btn btn-icon', tone === 'danger' && 'btn-icon-danger', className)}
      {...rest}
    >
      {icon}
    </button>
  )
}

/**
 * Tombol "Lihat detail" di kolom Action: ikon dokumen yang sama di semua daftar,
 * supaya pengguna tahu tombol inilah yang membuka isi lengkap satu baris.
 */
export function DetailButton({ label = 'Lihat detail', ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label?: string }) {
  return <IconButton label={label} icon={<FaFileLines size={14} />} {...rest} />
}
