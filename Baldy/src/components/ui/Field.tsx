import { Children, Fragment, isValidElement, useId } from 'react'
import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { SearchableSelect } from './SearchableSelect'
import type { Option } from './SearchableSelect'

/* Isian bergaya Bootstrap 5: .form-label, .form-control, .form-select, .form-text, .invalid-feedback. */

export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="form-label">
      {children}
      {required && <span className="wajib">*</span>}
    </label>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="invalid-feedback">{children}</p>
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="form-text">{children}</p>
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
  return <input className={cn('form-control', invalid && 'is-invalid', className)} {...rest} />
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cn('form-control', invalid && 'is-invalid', className)} {...rest} />
}

/** Teks dari isi elemen (mis. isi <option>{n} / halaman</option>). */
function teks(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(teks).join('')
  if (isValidElement(node)) return teks((node.props as { children?: ReactNode }).children)
  return ''
}

/** Pilihan dari anak <option> (juga di dalam <optgroup> atau fragment). */
function bacaOpsi(children: ReactNode): Option[] {
  const out: Option[] = []
  Children.forEach(children, (anak) => {
    if (!isValidElement(anak)) return
    const p = anak.props as { value?: unknown; children?: ReactNode; disabled?: boolean }
    if (anak.type === 'option') {
      const label = teks(p.children).trim()
      out.push({ value: p.value === undefined ? label : String(p.value), label: label || '—', disabled: p.disabled })
    } else if (anak.type === 'optgroup' || anak.type === Fragment) {
      out.push(...bacaOpsi(p.children))
    }
  })
  return out
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  invalid?: boolean
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  ukuran?: 'sm' | 'md'
}

/**
 * Pilihan dengan daftar <option> seperti select biasa, tetapi tampil memakai dropdown
 * SIKOTIS yang sama dengan dropdown trip (permintaan Baldy 13 Okt 2026: semua dropdown seragam).
 * onChange tetap menerima event dengan `e.target.value`, jadi pemakai lama tidak perlu diubah.
 * Daftar lebih dari 8 pilihan otomatis punya kotak pencarian.
 */
export function Select({ className, invalid, children, value, onChange, disabled, id, ukuran, 'aria-label': ariaLabel }: SelectProps) {
  const opsi = bacaOpsi(children)
  const nilai = value == null ? '' : String(value)
  const ada = opsi.some((o) => o.value === nilai)
  return (
    <SearchableSelect
      id={id}
      options={opsi}
      value={ada ? nilai : opsi[0]?.value ?? null}
      onChange={(v) => {
        const target = { value: v ?? '' }
        onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>)
      }}
      cari={opsi.length > 8}
      clearable={false}
      disabled={disabled}
      invalid={invalid}
      className={className}
      ukuran={ukuran}
      aria-label={ariaLabel}
      placeholder={opsi[0]?.label ?? 'Pilih...'}
    />
  )
}

/** Kolom tanggal bergaya papan jadwal depo (lihat DateInput.tsx). */
export { DateInput } from './DateInput'

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('cek', className)}>
      <input type="checkbox" className="form-check-input" {...rest} />
      {label}
    </label>
  )
}

/** Pilihan berbentuk kartu (radio): Callout / Dedicated, Ya / Tidak, ... */
export function Radio({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn('opsi-kartu', className)}>
      <input type="radio" className="form-check-input" {...rest} />
      <span>
        <span className="judul-opsi">{label}</span>
        {description && <span className="ket-opsi">{description}</span>}
      </span>
    </label>
  )
}
