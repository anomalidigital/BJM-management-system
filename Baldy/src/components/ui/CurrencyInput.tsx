import { useLayoutEffect, useRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { currencyInputValue, parseCurrencyInput } from '../../lib/format'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onValueChange: (value: number) => void
  invalid?: boolean
}

/**
 * Input nominal Rupiah: mengetik angka otomatis diformat 1.234.567.
 * Nilai 0 ditampilkan kosong (placeholder "0"), supaya angka yang diketik tidak
 * tersambung dengan "0" lama (500000 menjadi 5000000), dan kursor tetap di
 * tempatnya walau titik ribuan bertambah.
 */
export function CurrencyInput({ value, onValueChange, invalid, className, placeholder = '0', ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  /** Jumlah digit di kanan kursor saat mengetik, dipulihkan setelah angka diformat ulang. */
  const digitKanan = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const kanan = digitKanan.current
    digitKanan.current = null
    if (!el || kanan === null || document.activeElement !== el) return
    let pos = el.value.length
    for (let n = 0; pos > 0 && n < kanan; ) {
      pos--
      if (/\d/.test(el.value[pos])) n++
    }
    el.setSelectionRange(pos, pos)
  })

  return (
    <div className="input-group">
      <span className="input-group-text">Rp</span>
      <input
        ref={ref}
        inputMode="numeric"
        value={value ? currencyInputValue(value) : ''}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value
          digitKanan.current = raw.slice(e.target.selectionStart ?? raw.length).replace(/\D/g, '').length
          onValueChange(parseCurrencyInput(raw))
        }}
        className={cn('form-control tnum text-right', invalid && 'is-invalid', className)}
        {...rest}
      />
    </div>
  )
}
