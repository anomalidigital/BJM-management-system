import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 border border-transparent shadow-[0_1px_2px_rgba(11,11,11,.12)]',
  secondary: 'bg-surface text-ink border border-hairline hover:bg-sunken active:bg-grid',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-black/[.045] hover:text-ink',
  danger: 'bg-[color:var(--color-critical)] text-white border border-transparent hover:brightness-95 active:brightness-90',
  subtle: 'bg-brand-50 text-brand-700 border border-brand-100 hover:bg-brand-100',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-md',
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
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
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
      className={cn(
        'inline-flex h-7.5 w-7.5 items-center justify-center rounded-md border border-transparent transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        tone === 'danger'
          ? 'text-ink-3 hover:border-[#f3d5d5] hover:bg-[#fdf2f2] hover:text-[color:var(--color-critical)]'
          : 'text-ink-3 hover:border-hairline hover:bg-sunken hover:text-brand-600',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
}
