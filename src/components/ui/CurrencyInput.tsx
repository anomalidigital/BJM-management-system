import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { currencyInputValue, parseCurrencyInput } from '../../lib/format'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onValueChange: (value: number) => void
  invalid?: boolean
}

/** Input nominal Rupiah: mengetik angka otomatis diformat 1.234.567. */
export function CurrencyInput({ value, onValueChange, invalid, className, ...rest }: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[12px] font-semibold text-ink-3">
        Rp
      </span>
      <input
        inputMode="numeric"
        value={currencyInputValue(value)}
        onChange={(e) => onValueChange(parseCurrencyInput(e.target.value))}
        className={cn(
          'tnum h-9 w-full rounded-md border bg-surface pr-2.5 pl-9 text-right text-[13px] text-ink transition-colors',
          'focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3',
          invalid ? 'border-[color:var(--color-critical)]' : 'border-hairline',
          className,
        )}
        {...rest}
      />
    </div>
  )
}
