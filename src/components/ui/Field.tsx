import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '../../lib/utils'

const BASE =
  'w-full rounded-md border bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-3/70 transition-colors ' +
  'focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 read-only:bg-sunken read-only:text-ink-2'

export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-semibold tracking-wide text-ink-2">
      {children}
      {required && <span className="ml-0.5 text-[color:var(--color-critical)]">*</span>}
    </label>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1 text-[12px] font-medium text-[color:var(--color-critical)]">{children}</p>
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[12px] text-ink-3">{children}</p>
}

interface FieldWrapProps {
  label?: ReactNode
  required?: boolean
  error?: string
  hint?: ReactNode
  className?: string
  children: (id: string) => ReactNode
}

/** Pembungkus label + input + pesan error supaya form konsisten. */
export function Field({ label, required, error, hint, className, children }: FieldWrapProps) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {children(id)}
      {error ? <FieldError>{error}</FieldError> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  )
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(BASE, 'h-9', invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline', className)} {...rest} />
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cn(BASE, 'py-2 leading-relaxed', invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline', className)} {...rest} />
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cn(BASE, 'h-9 cursor-pointer pr-8', invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline', className)} {...rest}>
      {children}
    </select>
  )
}

/** Date picker native — konsisten & tanpa dependency tambahan. */
export function DateInput({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <Input type="date" className={cn('cursor-pointer', className)} invalid={invalid} {...rest} />
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink select-none', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-hairline accent-[color:var(--color-brand-500)]"
        {...rest}
      />
      {label}
    </label>
  )
}

export function Radio({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border border-hairline p-3 transition-colors',
        'hover:border-brand-200 hover:bg-brand-50/50 has-checked:border-brand-400 has-checked:bg-brand-50',
        className,
      )}
    >
      <input type="radio" className="mt-0.5 h-4 w-4 cursor-pointer accent-[color:var(--color-brand-500)]" {...rest} />
      <span>
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[12px] text-ink-3">{description}</span>}
      </span>
    </label>
  )
}
